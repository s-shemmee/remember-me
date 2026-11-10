-- People editing (M2 part 1): add, edit and remove people from /people.
-- * people.relation_kind: the relation chip (Best friend, Family, Partner,
--   Friend, Colleague). people.relation becomes the optional "How you'd
--   describe them" (at most 30 characters, e.g. "Little sister"); the app
--   shows it when set, otherwise the chip. Existing rows are backfilled.
-- * save_person(): creates or edits a person with their birthday, other
--   days and little things in one transaction (security invoker: RLS
--   applies). Archived people can't be edited.
-- * complete_onboarding() takes p_person_description and saves the chip
--   in relation_kind.
-- * Removing a person sets people.archived_at (Undo clears it). Archived
--   people are hidden everywhere: every app query filters
--   archived_at is null, and the reminder job (M4) must too. A job in M4
--   deletes people archived more than 30 days ago (docs/roadmap.md).
-- Spec: docs/data-model.md. Tests: supabase/tests/people.test.sql, onboarding.test.sql.
--
-- Roll back (in this order):
--   drop function if exists public.save_person(uuid, text, text, text, text, integer, integer, integer, text[], jsonb);
--   drop function if exists public.complete_onboarding(text, integer, integer, integer, public.avatar_kind, text, text, text, text, text, text, integer, integer, integer, text, integer[], boolean, boolean, text, text);
--   update public.people set relation = coalesce(relation, relation_kind);
--   alter table public.people drop constraint people_relation_check,
--     add constraint people_relation_check check (char_length(relation) <= 40);
--   alter table public.people drop column relation_kind;
-- then re-run complete_onboarding() from 20261109230900_name_limits_and_relation_colours.sql
-- and its revoke/grant lines.

-- people.relation_kind ----------------------------------------------------------

alter table public.people
  add column relation_kind text
    check (relation_kind in ('Best friend', 'Family', 'Partner', 'Friend', 'Colleague'));

comment on column public.people.relation_kind is
  'The relation chip. Sets the default colour and the group (docs/design-system.md).';
comment on column public.people.relation is
  'Optional "How you''d describe them" (e.g. "Little sister"), at most 30 characters. Shown instead of the chip when set.';

-- Rows saved so far hold the chip text in relation: move it across.
update public.people
  set relation_kind = relation, relation = null
  where relation in ('Best friend', 'Family', 'Partner', 'Friend', 'Colleague');
update public.people
  set relation = nullif(left(btrim(relation), 30), '')
  where relation is not null;

alter table public.people
  drop constraint people_relation_check,
  add constraint people_relation_check check (char_length(relation) between 1 and 30);

grant insert (relation_kind) on public.people to authenticated;
grant update (relation_kind) on public.people to authenticated;

-- Lists filter on archived_at is null.
create index people_owner_active_idx on public.people (owner_id) where archived_at is null;

-- save_person() -----------------------------------------------------------------

create function public.save_person(
  p_id uuid default null,
  p_name text default null,
  p_relation_kind text default null,
  p_relation text default null,
  p_color text default null,
  p_birthday_day integer default null,
  p_birthday_month integer default null,
  p_birthday_year integer default null,
  p_little_things text[] default '{}',
  p_days jsonb default '[]'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := nullif(btrim(p_name), '');
  v_relation text := nullif(btrim(p_relation), '');
  v_kinds text[] := array['Best friend', 'Family', 'Partner', 'Friend', 'Colleague'];
  v_pastels text[] := array['peach', 'lilac', 'mint', 'sky', 'rose', 'butter'];
  v_this_year integer := extract(year from now())::integer;
  v_things text[];
  v_group public.person_group;
  v_color text;
  v_id uuid;
  v_day jsonb;
  v_day_id uuid;
  v_kind text;
  v_title text;
  v_d integer;
  v_m integer;
  v_y integer;
  v_keep uuid[] := '{}';
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- The person
  if v_name is null or char_length(v_name) > 40 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if p_relation_kind is null or not (p_relation_kind = any (v_kinds))
     or char_length(coalesce(v_relation, '')) > 30 then
    raise exception 'invalid_relation' using errcode = '22023';
  end if;
  if p_color is not null and not (p_color = any (v_pastels)) then
    raise exception 'invalid_color' using errcode = '22023';
  end if;

  -- Little things: trimmed, empty ones dropped, at most 20 of 1-60 characters.
  v_things := array(
    select btrim(t) from unnest(coalesce(p_little_things, '{}')) with ordinality as u(t, n)
    where nullif(btrim(t), '') is not null order by n
  );
  if cardinality(v_things) > 20
     or exists (select 1 from unnest(v_things) as t where char_length(t) > 60) then
    raise exception 'invalid_little_things' using errcode = '22023';
  end if;

  -- Birthday (required)
  if p_birthday_day is null or p_birthday_month is null
     or p_birthday_month not between 1 and 12 or p_birthday_day < 1
     or p_birthday_day > (case
          when p_birthday_month = 2 then 29
          when p_birthday_month in (4, 6, 9, 11) then 30
          else 31 end)
     or (p_birthday_year is not null and (
          p_birthday_year not between 1900 and v_this_year
          or (p_birthday_month = 2 and p_birthday_day = 29
              and not ((p_birthday_year % 4 = 0 and p_birthday_year % 100 <> 0)
                       or p_birthday_year % 400 = 0)))) then
    raise exception 'invalid_birthday' using errcode = '22023';
  end if;

  if p_days is null or jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) > 10 then
    raise exception 'invalid_days' using errcode = '22023';
  end if;

  v_group := (case p_relation_kind
      when 'Family' then 'family' when 'Partner' then 'family'
      when 'Colleague' then 'work'
      else 'friends' end)::public.person_group;
  v_color := coalesce(p_color, case p_relation_kind
      when 'Best friend' then 'rose' when 'Family' then 'sky' when 'Partner' then 'peach'
      when 'Colleague' then 'mint' else 'lilac' end);

  if p_id is null then
    insert into public.people (name, relation_kind, relation, "group", color, little_things)
    values (v_name, p_relation_kind, v_relation, v_group, v_color, v_things)
    returning id into v_id;
  else
    -- RLS hides other people's rows, so theirs look the same as missing ones.
    update public.people p set
      name = v_name, relation_kind = p_relation_kind, relation = v_relation,
      "group" = v_group, color = v_color, little_things = v_things
    where p.id = p_id and p.archived_at is null
    returning p.id into v_id;
    if v_id is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  end if;

  -- Birthday: one per person.
  update public.occasions o
    set day = p_birthday_day, month = p_birthday_month, year = p_birthday_year
    where o.person_id = v_id and o.kind = 'birthday';
  if not found then
    insert into public.occasions (person_id, kind, day, month, year)
    values (v_id, 'birthday', p_birthday_day, p_birthday_month, p_birthday_year);
  end if;

  -- Other days: rows with an id are edited (ids stay stable for the
  -- reminder log), rows without are added, and missing ones are removed.
  for v_day in select value from jsonb_array_elements(p_days) loop
    begin
      v_day_id := nullif(v_day ->> 'id', '')::uuid;
      v_kind := v_day ->> 'kind';
      v_title := nullif(btrim(v_day ->> 'title'), '');
      v_d := (v_day ->> 'day')::integer;
      v_m := (v_day ->> 'month')::integer;
      v_y := (v_day ->> 'year')::integer;
    exception when others then
      raise exception 'invalid_days' using errcode = '22023';
    end;

    if v_kind is null or v_kind not in ('anniversary', 'graduation', 'other')
       or (v_kind = 'other' and v_title is null)
       or char_length(coalesce(v_title, '')) > 40
       or v_d is null or v_m is null or v_m not between 1 and 12 or v_d < 1
       or v_d > (case when v_m = 2 then 29 when v_m in (4, 6, 9, 11) then 30 else 31 end)
       or (v_y is not null and (
            v_y not between 1900 and 2100
            or (v_m = 2 and v_d = 29 and not ((v_y % 4 = 0 and v_y % 100 <> 0) or v_y % 400 = 0)))) then
      raise exception 'invalid_days' using errcode = '22023';
    end if;
    if v_kind <> 'other' then
      v_title := null;
    end if;

    if v_day_id is null then
      insert into public.occasions (person_id, kind, title, day, month, year)
      values (v_id, v_kind::public.occasion_kind, v_title, v_d, v_m, v_y)
      returning id into v_day_id;
    else
      update public.occasions o
        set kind = v_kind::public.occasion_kind, title = v_title, day = v_d, month = v_m, year = v_y
        where o.id = v_day_id and o.person_id = v_id and o.kind <> 'birthday';
      if not found then
        raise exception 'invalid_days' using errcode = '22023';
      end if;
    end if;
    v_keep := v_keep || v_day_id;
  end loop;

  delete from public.occasions o
    where o.person_id = v_id and o.kind <> 'birthday' and not (o.id = any (v_keep));

  return v_id;
end;
$$;

comment on function public.save_person is
  'Creates (p_id null) or edits one of your people with their birthday, other days (jsonb array of {id?, kind, title?, day, month, year?}) and little things, in one transaction. Security invoker: RLS applies. Archived or other people''s rows raise not_found.';

revoke execute on function public.save_person from public, anon;
grant execute on function public.save_person to authenticated;

-- complete_onboarding(): adds p_person_description ------------------------------

drop function public.complete_onboarding(
  text, integer, integer, integer, public.avatar_kind, text, text, text, text, text, text,
  integer, integer, integer, text, integer[], boolean, boolean, text);

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
  p_timezone text default null,
  p_person_description text default null
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
  v_relation_kind text := nullif(btrim(p_person_relation), '');
  v_description text := nullif(btrim(p_person_description), '');
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
  if v_first_name is null or char_length(v_first_name) > 40 then
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
       or v_little_thing is not null or v_description is not null then
      raise exception 'person_name_required' using errcode = '22023';
    end if;
  else
    if char_length(v_person_name) > 40
       or (v_relation_kind is not null
           and v_relation_kind not in ('Best friend', 'Family', 'Partner', 'Friend', 'Colleague'))
       or char_length(coalesce(v_description, '')) > 30
       or char_length(coalesce(v_little_thing, '')) > 60
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
    insert into public.people (name, relation_kind, relation, "group", color, little_things)
    values (
      v_person_name,
      v_relation_kind,
      v_description,
      (case v_relation_kind
         when 'Family' then 'family'
         when 'Partner' then 'family'
         when 'Colleague' then 'work'
         when 'Best friend' then 'friends'
         when 'Friend' then 'friends'
         else 'other'
       end)::public.person_group,
      -- No colour given: the relation's colour (docs/design-system.md).
      coalesce(p_person_color, case v_relation_kind
         when 'Best friend' then 'rose'
         when 'Family' then 'sky'
         when 'Partner' then 'peach'
         when 'Friend' then 'lilac'
         when 'Colleague' then 'mint'
         else 'lilac'
       end),
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
  'Saves onboarding in one transaction (security invoker: RLS applies). Returns the first person id, or null if skipped. p_person_relation is the relation chip (saved as people.relation_kind), p_person_description the optional "How you''d describe them" (people.relation, max 30). Names up to 40 characters; the person gets their relation''s colour unless one is passed. Push is stored as a choice only until M4.';

revoke execute on function public.complete_onboarding from public, anon;
grant execute on function public.complete_onboarding to authenticated;
