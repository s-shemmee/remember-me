-- Occasion types (part 2 of 2): repeat and titles.
-- * Every day repeats yearly or happens once (occasions.recurring). Existing
--   graduations with a year become once; every other existing day yearly.
-- * Birthdays always repeat; a day that happens once needs its year.
-- * save_person() takes `recurring` per day (default: once for Graduation
--   and Something else, yearly for the rest), accepts Work milestone and
--   Remembrance, and keeps titles for every type (optional, except for
--   Something else).
-- Spec: docs/decisions.md ("Occasion types"), docs/data-model.md.
-- Tests: supabase/tests/occasion_types.test.sql, people.test.sql.
--
-- Roll back:
--   alter table public.occasions drop constraint occasions_birthday_yearly,
--     drop constraint occasions_once_has_year;
--   update public.occasions set recurring = true;
--   update public.occasions set title = null where kind not in ('other');
-- then re-run save_person() from 20261110003718_people_editing.sql (same signature).

-- Existing days: graduations with a year happened once; the rest repeat.
update public.occasions
  set recurring = not (kind = 'graduation' and year is not null);

alter table public.occasions
  add constraint occasions_birthday_yearly check (kind <> 'birthday' or recurring),
  add constraint occasions_once_has_year check (recurring or year is not null);

comment on column public.occasions.recurring is
  'True: every year on day/month. False: once, on day/month/year. Birthdays always repeat.';

create or replace function public.save_person(
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
  v_recurring boolean;
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
      v_recurring := (v_day ->> 'recurring')::boolean;
    exception when others then
      raise exception 'invalid_days' using errcode = '22023';
    end;

    -- Without a repeat, each type's default: Graduation and Something else
    -- happen once, the rest every year.
    v_recurring := coalesce(v_recurring, v_kind not in ('graduation', 'other'));

    if v_kind is null
       or v_kind not in ('anniversary', 'graduation', 'work_milestone', 'remembrance', 'other')
       -- The title is optional, except for Something else.
       or (v_kind = 'other' and v_title is null)
       -- A day that happens once needs its year.
       or (not v_recurring and v_y is null)
       or char_length(coalesce(v_title, '')) > 40
       or v_d is null or v_m is null or v_m not between 1 and 12 or v_d < 1
       or v_d > (case when v_m = 2 then 29 when v_m in (4, 6, 9, 11) then 30 else 31 end)
       or (v_y is not null and (
            v_y not between 1900 and 2100
            or (v_m = 2 and v_d = 29 and not ((v_y % 4 = 0 and v_y % 100 <> 0) or v_y % 400 = 0)))) then
      raise exception 'invalid_days' using errcode = '22023';
    end if;
    if v_day_id is null then
      insert into public.occasions (person_id, kind, title, day, month, year, recurring)
      values (v_id, v_kind::public.occasion_kind, v_title, v_d, v_m, v_y, v_recurring)
      returning id into v_day_id;
    else
      update public.occasions o
        set kind = v_kind::public.occasion_kind, title = v_title, day = v_d, month = v_m,
            year = v_y, recurring = v_recurring
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
  'Creates (p_id null) or edits one of your people with their birthday, other days (jsonb array of {id?, kind, title?, day, month, year?, recurring?}) and little things, in one transaction. Kinds: anniversary, graduation, work_milestone, remembrance, other. A day that happens once needs a year; the title is optional except for other. Security invoker: RLS applies. Archived or other people''s rows raise not_found.';

revoke execute on function public.save_person from public, anon;
grant execute on function public.save_person to authenticated;
