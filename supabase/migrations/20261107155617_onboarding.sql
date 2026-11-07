-- Onboarding (M1 part 2): profiles.onboarded_at, people, occasions,
-- reminder_settings, and complete_onboarding(), which saves the whole flow
-- in one transaction. people and occasions are pulled forward from M2
-- because onboarding adds the first person.
-- Spec: docs/data-model.md. Tests: supabase/tests/onboarding.test.sql.
--
-- Roll back (in this order):
--   drop function if exists public.complete_onboarding(text, integer, integer, integer, public.avatar_kind, text, text, text, text, text, text, integer, integer, integer, text, integer[], boolean, text);
--   drop table if exists public.reminder_settings;
--   drop table if exists public.occasions;
--   drop table if exists public.people;
--   drop type if exists public.occasion_kind;
--   drop type if exists public.person_group;
--   revoke update (onboarded_at) on public.profiles from authenticated;
--   alter table public.profiles drop column if exists onboarded_at;

-- profiles ------------------------------------------------------------------

alter table public.profiles add column onboarded_at timestamptz;
comment on column public.profiles.onboarded_at is
  'Set by complete_onboarding(). Null means the person still needs onboarding.';

-- complete_onboarding() runs as the user (security invoker), so it needs this.
grant update (onboarded_at) on public.profiles to authenticated;

-- types ---------------------------------------------------------------------

create type public.person_group as enum ('family', 'friends', 'work', 'other');
create type public.occasion_kind as enum ('birthday', 'anniversary', 'graduation', 'other');

-- people --------------------------------------------------------------------

create table public.people (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  relation text check (char_length(relation) <= 40),
  "group" public.person_group not null default 'other',
  -- Their pastel, used everywhere they appear (avatar, countdown, calendar).
  color text not null default 'lilac'
    check (color in ('peach', 'lilac', 'mint', 'sky', 'rose', 'butter')),
  -- Set when connected (M3), never by the client.
  linked_profile_id uuid references public.profiles (id) on delete set null,
  little_things text[] not null default '{}' check (cardinality(little_things) <= 20),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.people is 'Someone you remember. They may or may not use the app.';

create index people_owner_id_idx on public.people (owner_id);
create index people_linked_profile_id_idx on public.people (linked_profile_id)
  where linked_profile_id is not null;

alter table public.people enable row level security;

create policy "People: read own"
  on public.people for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "People: add own"
  on public.people for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy "People: update own"
  on public.people for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "People: delete own"
  on public.people for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.people from anon, authenticated;
grant select, delete on public.people to authenticated;
-- owner_id comes from its default (auth.uid()); linked_profile_id is server-only.
grant insert (name, relation, "group", color, little_things, archived_at)
  on public.people to authenticated;
grant update (name, relation, "group", color, little_things, archived_at)
  on public.people to authenticated;

-- occasions -----------------------------------------------------------------

create table public.occasions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Null = one of your own days. Your birthday itself lives on profiles.
  person_id uuid references public.people (id) on delete cascade,
  kind public.occasion_kind not null default 'birthday',
  title text check (char_length(title) <= 80),
  day smallint not null check (day between 1 and 31),
  month smallint not null check (month between 1 and 12),
  year smallint check (year between 1900 and 2100),
  recurring boolean not null default true,
  created_at timestamptz not null default now(),

  -- A real day of the year (29 February allowed: it falls on the 28th in
  -- non-leap years, see src/lib/dates.ts).
  constraint occasions_date_valid check (
    (month = 2 and day <= 29)
    or (month in (4, 6, 9, 11) and day <= 30)
    or (month in (1, 3, 5, 7, 8, 10, 12) and day <= 31)
  ),
  -- With a year, 29 February must be a leap year.
  constraint occasions_leap_day_year check (
    not (month = 2 and day = 29 and year is not null
         and not ((year % 4 = 0 and year % 100 <> 0) or year % 400 = 0))
  )
);

comment on table public.occasions is 'A day to remember, for a person or for yourself.';

create index occasions_owner_id_idx on public.occasions (owner_id);
create index occasions_person_id_idx on public.occasions (person_id);
-- For the reminder job (M4): "whose day is in N days".
create index occasions_month_day_idx on public.occasions (month, day);
-- One birthday per person.
create unique index occasions_one_birthday_per_person
  on public.occasions (person_id) where kind = 'birthday' and person_id is not null;

alter table public.occasions enable row level security;

create policy "Occasions: read own"
  on public.occasions for select to authenticated
  using ((select auth.uid()) = owner_id);
-- New and changed rows must be yours, and any person on them must be yours.
create policy "Occasions: add own"
  on public.occasions for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and (person_id is null or exists (
      select 1 from public.people p where p.id = person_id and p.owner_id = (select auth.uid())
    ))
  );
create policy "Occasions: update own"
  on public.occasions for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and (person_id is null or exists (
      select 1 from public.people p where p.id = person_id and p.owner_id = (select auth.uid())
    ))
  );
create policy "Occasions: delete own"
  on public.occasions for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.occasions from anon, authenticated;
grant select, delete on public.occasions to authenticated;
grant insert (person_id, kind, title, day, month, year, recurring)
  on public.occasions to authenticated;
grant update (person_id, kind, title, day, month, year, recurring)
  on public.occasions to authenticated;

-- reminder_settings ---------------------------------------------------------

create table public.reminder_settings (
  profile_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  -- Days before the occasion: 7, 3, 1 and/or 0 (the morning of).
  offsets_days integer[] not null default '{7,1,0}'
    check (offsets_days <@ array[7, 3, 1, 0] and cardinality(offsets_days) <= 4),
  send_time time not null default '09:00',
  email boolean not null default true,
  push boolean not null default false,
  remind_my_people boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.reminder_settings is 'One row per person using the app: when and how to remind them.';

alter table public.reminder_settings enable row level security;

create policy "Reminder settings: read own"
  on public.reminder_settings for select to authenticated
  using ((select auth.uid()) = profile_id);
create policy "Reminder settings: add own"
  on public.reminder_settings for insert to authenticated
  with check ((select auth.uid()) = profile_id);
create policy "Reminder settings: update own"
  on public.reminder_settings for update to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);
-- No delete: the row goes with the profile.

revoke all on public.reminder_settings from anon, authenticated;
grant select on public.reminder_settings to authenticated;
grant insert (offsets_days, send_time, email, push, remind_my_people, updated_at)
  on public.reminder_settings to authenticated;
grant update (offsets_days, send_time, email, push, remind_my_people, updated_at)
  on public.reminder_settings to authenticated;

-- complete_onboarding -------------------------------------------------------

-- Saves the whole onboarding flow in one transaction: your name, birthday and
-- look, the first person and their birthday (optional: no name = skipped),
-- reminder settings, then onboarded_at. Runs as the caller (security
-- invoker), so every write still goes through RLS and column grants.
-- Errors are raised with errcode 22023 and a short code as the message
-- (invalid_birthday, person_name_required, ...) for the app to translate.
create function public.complete_onboarding(
  p_first_name text,
  p_birthday_day integer,
  p_birthday_month integer,
  p_birth_year integer default null,
  p_avatar_kind public.avatar_kind default 'initials',
  p_avatar_color text default null,
  p_avatar_character text default null,
  p_avatar_path text default null,
  p_person_name text default null,
  p_person_relation text default null,
  p_person_color text default null,
  p_person_birthday_day integer default null,
  p_person_birthday_month integer default null,
  p_person_birthday_year integer default null,
  p_person_little_thing text default null,
  p_reminder_offsets integer[] default '{7,1,0}',
  p_reminder_email boolean default true,
  p_timezone text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_first_name text := nullif(btrim(p_first_name), '');
  v_person_name text := nullif(btrim(p_person_name), '');
  v_relation text := nullif(btrim(p_person_relation), '');
  v_little_thing text := nullif(btrim(p_person_little_thing), '');
  v_pastels text[] := array['peach', 'lilac', 'mint', 'sky', 'rose', 'butter'];
  v_this_year integer := extract(year from now())::integer;
  v_onboarded_at timestamptz;
  v_person_id uuid;
  v_offsets integer[];
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Lock the profile row so a double submit cannot onboard twice.
  select p.onboarded_at into v_onboarded_at
  from public.profiles p where p.id = v_uid for update;
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  if v_onboarded_at is not null then
    raise exception 'already_onboarded' using errcode = '22023';
  end if;

  -- You
  if v_first_name is null or char_length(v_first_name) > 50 then
    raise exception 'invalid_first_name' using errcode = '22023';
  end if;
  if p_birthday_day is null or p_birthday_month is null
     or p_birthday_month not between 1 and 12 or p_birthday_day < 1
     -- CASE in parentheses: an IF condition otherwise ends at the first THEN.
     or p_birthday_day > (case
          when p_birthday_month = 2 then 29
          when p_birthday_month in (4, 6, 9, 11) then 30
          else 31 end) then
    raise exception 'invalid_birthday' using errcode = '22023';
  end if;
  if p_birth_year is not null and (
       p_birth_year not between 1900 and v_this_year
       or (p_birthday_month = 2 and p_birthday_day = 29
           and not ((p_birth_year % 4 = 0 and p_birth_year % 100 <> 0) or p_birth_year % 400 = 0))) then
    raise exception 'invalid_birth_year' using errcode = '22023';
  end if;
  if p_timezone is not null
     and not exists (select 1 from pg_catalog.pg_timezone_names tz where tz.name = p_timezone) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;

  -- Your look
  if p_avatar_color is not null and not (p_avatar_color = any (v_pastels)) then
    raise exception 'invalid_avatar' using errcode = '22023';
  end if;
  if p_avatar_kind = 'character'
     and (p_avatar_character is null or char_length(btrim(p_avatar_character)) not between 1 and 40) then
    raise exception 'invalid_avatar' using errcode = '22023';
  end if;
  -- Photos live under the user's own Storage prefix.
  if p_avatar_kind = 'photo'
     and (p_avatar_path is null or not starts_with(p_avatar_path, v_uid::text || '/')) then
    raise exception 'invalid_avatar' using errcode = '22023';
  end if;

  -- First person (optional: no name means skipped)
  if v_person_name is null then
    if p_person_birthday_day is not null or p_person_birthday_month is not null
       or v_little_thing is not null then
      raise exception 'person_name_required' using errcode = '22023';
    end if;
  else
    if char_length(v_person_name) > 80 or char_length(coalesce(v_relation, '')) > 40
       or char_length(coalesce(v_little_thing, '')) > 80
       or (p_person_color is not null and not (p_person_color = any (v_pastels))) then
      raise exception 'invalid_person' using errcode = '22023';
    end if;
    if (p_person_birthday_day is null) <> (p_person_birthday_month is null)
       or (p_person_birthday_month is not null and (
            p_person_birthday_month not between 1 and 12 or p_person_birthday_day < 1
            or p_person_birthday_day > (case
                 when p_person_birthday_month = 2 then 29
                 when p_person_birthday_month in (4, 6, 9, 11) then 30
                 else 31 end)))
       or (p_person_birthday_year is not null and (
            p_person_birthday_month is null
            or p_person_birthday_year not between 1900 and v_this_year
            or (p_person_birthday_month = 2 and p_person_birthday_day = 29
                and not ((p_person_birthday_year % 4 = 0 and p_person_birthday_year % 100 <> 0)
                         or p_person_birthday_year % 400 = 0)))) then
      raise exception 'invalid_person_birthday' using errcode = '22023';
    end if;
  end if;

  -- Reminders: 7, 3, 1 and/or 0 days before, stored largest first, no repeats.
  if p_reminder_offsets is null or not (p_reminder_offsets <@ array[7, 3, 1, 0]) then
    raise exception 'invalid_reminders' using errcode = '22023';
  end if;
  v_offsets := array(select distinct o from unnest(p_reminder_offsets) as o order by o desc);

  -- Writes (all or nothing)
  update public.profiles p set
    first_name = v_first_name,
    birthday_day = p_birthday_day,
    birthday_month = p_birthday_month,
    birth_year = p_birth_year,
    avatar_kind = p_avatar_kind,
    avatar_color = p_avatar_color,
    avatar_character = case when p_avatar_kind = 'character' then btrim(p_avatar_character) end,
    avatar_path = case when p_avatar_kind = 'photo' then p_avatar_path end,
    timezone = coalesce(p_timezone, p.timezone)
  where p.id = v_uid;

  if v_person_name is not null then
    insert into public.people (name, relation, "group", color, little_things)
    values (
      v_person_name,
      v_relation,
      (case lower(v_relation)
         when 'family' then 'family'
         when 'colleague' then 'work'
         when 'best friend' then 'friends'
         when 'friend' then 'friends'
         else 'other'
       end)::public.person_group,
      coalesce(p_person_color, 'lilac'),
      case when v_little_thing is null then '{}'::text[] else array[v_little_thing] end
    )
    returning id into v_person_id;

    if p_person_birthday_day is not null then
      insert into public.occasions (person_id, kind, day, month, year)
      values (v_person_id, 'birthday', p_person_birthday_day, p_person_birthday_month,
              p_person_birthday_year);
    end if;
  end if;

  insert into public.reminder_settings (offsets_days, email)
  values (v_offsets, coalesce(p_reminder_email, true))
  on conflict (profile_id) do update
    set offsets_days = excluded.offsets_days, email = excluded.email, updated_at = now();

  update public.profiles p set onboarded_at = now() where p.id = v_uid;

  return v_person_id;
end;
$$;

comment on function public.complete_onboarding is
  'Saves onboarding in one transaction (security invoker: RLS applies). Returns the first person id, or null if skipped.';

revoke execute on function public.complete_onboarding from public, anon;
grant execute on function public.complete_onboarding to authenticated;
