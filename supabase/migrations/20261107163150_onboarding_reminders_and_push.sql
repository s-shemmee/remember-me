-- Onboarding follow-up (M1 part 2 UI):
-- * reminders may also be 14 days before ("2 weeks before" chip),
-- * complete_onboarding() takes p_reminder_push (stored only; web push is M4),
-- * relation "Partner" maps to the family group (was other).
-- Spec: docs/data-model.md. Tests: supabase/tests/onboarding.test.sql.
--
-- Roll back: re-run the complete_onboarding() definition from
-- 20261107155617_onboarding.sql after
--   drop function if exists public.complete_onboarding(text, integer, integer, integer, public.avatar_kind, text, text, text, text, text, text, integer, integer, integer, text, integer[], boolean, boolean, text);
-- and restore the old check:
--   alter table public.reminder_settings drop constraint reminder_settings_offsets_days_check,
--     add constraint reminder_settings_offsets_days_check
--     check (offsets_days <@ array[7, 3, 1, 0] and cardinality(offsets_days) <= 4);

alter table public.reminder_settings
  drop constraint reminder_settings_offsets_days_check,
  add constraint reminder_settings_offsets_days_check
    check (offsets_days <@ array[14, 7, 3, 1, 0] and cardinality(offsets_days) <= 5);

comment on column public.reminder_settings.offsets_days is
  'Days before the occasion: any of 14, 7, 3, 1, 0 (0 = the morning of).';

-- The signature changes (new parameter), so drop the old function first;
-- create or replace cannot add a parameter.
drop function public.complete_onboarding(
  text, integer, integer, integer, public.avatar_kind, text, text, text, text, text, text,
  integer, integer, integer, text, integer[], boolean, text
);

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
  p_reminder_push boolean default false,
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

  -- Reminders: 14, 7, 3, 1 and/or 0 days before, stored largest first, no repeats.
  if p_reminder_offsets is null or not (p_reminder_offsets <@ array[14, 7, 3, 1, 0]) then
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
         when 'partner' then 'family'
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

  -- push stores the choice only; nothing is sent until web push exists (M4).
  insert into public.reminder_settings (offsets_days, email, push)
  values (v_offsets, coalesce(p_reminder_email, true), coalesce(p_reminder_push, false))
  on conflict (profile_id) do update
    set offsets_days = excluded.offsets_days, email = excluded.email, push = excluded.push,
        updated_at = now();

  update public.profiles p set onboarded_at = now() where p.id = v_uid;

  return v_person_id;
end;
$$;

comment on function public.complete_onboarding is
  'Saves onboarding in one transaction (security invoker: RLS applies). Returns the first person id, or null if skipped. Push is stored as a choice only until M4.';

revoke execute on function public.complete_onboarding from public, anon;
grant execute on function public.complete_onboarding to authenticated;
