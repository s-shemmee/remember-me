-- pgTAP: people editing (`pnpm db:test`, CI `database` job): save_person(),
-- relation_kind and description, archive and restore, and RLS as two users.
-- A (Sara) owns people; B (Khalid) is the denied side.
begin;
select plan(44);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000aa01', 'sara.people@test.local',   '{"first_name": "Sara"}'),
  ('00000000-0000-0000-0000-00000000bb01', 'khalid.people@test.local', '{"first_name": "Khalid"}');

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

-- Ids shared between steps (pg_temp tables are visible to every role here).
create temp table ids (key text primary key, id uuid);
grant all on ids to authenticated;

-- Structure -----------------------------------------------------------------
select has_column('public', 'people', 'relation_kind', 'people.relation_kind exists');
select is((select prosecdef from pg_proc where proname = 'save_person'), false,
  'save_person runs as the caller (security invoker)');
select is(
  has_function_privilege('anon', 'public.save_person(uuid, text, text, text, text, integer, integer, integer, text[], jsonb)', 'execute'),
  false, 'anonymous visitors cannot call save_person');

-- A: add a person with days and little things --------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000aa01');
select lives_ok($$
  insert into ids select 'mom', public.save_person(
    p_name => ' Mom ', p_relation_kind => 'Family', p_relation => ' Mom & Dad ',
    p_birthday_day => 9, p_birthday_month => 1, p_birthday_year => 1965,
    p_little_things => array[' roses ', '', '  ', 'mint tea'],
    p_days => '[{"kind": "anniversary", "title": " Wedding ", "day": 16, "month": 11, "year": 1993}]')
$$, 'A adds a person with a birthday, an anniversary and little things');

select is(
  (select name || '|' || relation_kind || '|' || relation || '|' || "group" || '|' || color || '|' || array_to_string(little_things, ',')
   from public.people where id = (select id from ids where key = 'mom')),
  'Mom|Family|Mom & Dad|family|sky|roses,mint tea',
  'trimmed name and description, Family → family and sky, empty little things dropped');
select is(
  (select string_agg(kind || ':' || coalesce(title, '-') || ':' || day || '/' || month || '/' || year, ' ' order by kind)
   from public.occasions where person_id = (select id from ids where key = 'mom')),
  'birthday:-:9/1/1965 anniversary:Wedding:16/11/1993',
  'the birthday and the anniversary are saved; titles are kept (trimmed) for every type');
select is(
  (select owner_id from public.people where id = (select id from ids where key = 'mom')),
  '00000000-0000-0000-0000-00000000aa01'::uuid, 'the person belongs to A');

insert into ids select 'anniversary', id from public.occasions
  where person_id = (select id from ids where key = 'mom') and kind = 'anniversary';

-- A: edit, keeping the anniversary's id and adding another day ----------------
select lives_ok(format($$
  select public.save_person(
    p_id => %L, p_name => 'Mom', p_relation_kind => 'Family', p_color => 'butter',
    p_birthday_day => 10, p_birthday_month => 1,
    p_days => '[{"id": "%s", "kind": "anniversary", "day": 17, "month": 11},
                {"kind": "other", "title": " Name day ", "day": 3, "month": 5, "recurring": true}]')
$$, (select id from ids where key = 'mom'), (select id from ids where key = 'anniversary')),
  'A edits the person: new colour, birthday, the anniversary moved, a new day');

select is(
  (select coalesce(relation, '-') || ' ' || color from public.people where id = (select id from ids where key = 'mom')),
  '- butter', 'the description can be cleared; a chosen colour wins over the relation colour');
select is(
  (select day || '/' || month || ' ' || coalesce(year::text, 'no year') from public.occasions
   where id = (select id from ids where key = 'anniversary')),
  '17/11 no year', 'the anniversary keeps its id when edited');
select is(
  (select string_agg(kind || ':' || coalesce(title, '-') || ':' || day || '/' || month, ' ' order by kind)
   from public.occasions where person_id = (select id from ids where key = 'mom')),
  'birthday:-:10/1 anniversary:-:17/11 other:Name day:3/5',
  'one birthday, the edited anniversary and the new day');

select lives_ok(format($$
  select public.save_person(p_id => %L, p_name => 'Mom', p_relation_kind => 'Family',
    p_birthday_day => 10, p_birthday_month => 1, p_days => '[]')
$$, (select id from ids where key = 'mom')), 'A removes the other days');
select is(
  (select count(*)::int from public.occasions where person_id = (select id from ids where key = 'mom')),
  1, 'only the birthday is left');

-- A: a second person, used to try borrowing a day id ---------------------------
select lives_ok($$
  insert into ids select 'yasmine', public.save_person(p_name => 'Yasmine', p_relation_kind => 'Friend',
    p_birthday_day => 29, p_birthday_month => 2, p_birthday_year => 2004,
    p_days => '[{"kind": "graduation", "day": 24, "month": 11, "year": 2027}]')
$$, 'a person born on 29 February 2004 with a graduation next year is accepted');
select is((select "group" || ' ' || color from public.people where id = (select id from ids where key = 'yasmine')),
  'friends lilac', 'Friend → friends and lilac');
insert into ids select 'graduation', id from public.occasions
  where person_id = (select id from ids where key = 'yasmine') and kind = 'graduation';

-- Validation (A) ----------------------------------------------------------------
select throws_ok($$ select public.save_person(p_name => repeat('x', 41), p_relation_kind => 'Friend',
  p_birthday_day => 1, p_birthday_month => 1) $$, '22023', 'invalid_name', 'a 41-character name is refused');
select throws_ok($$ select public.save_person(p_name => '  ', p_relation_kind => 'Friend',
  p_birthday_day => 1, p_birthday_month => 1) $$, '22023', 'invalid_name', 'an empty name is refused');
select throws_ok($$ select public.save_person(p_name => 'Ali', p_relation_kind => 'Cousin',
  p_birthday_day => 1, p_birthday_month => 1) $$, '22023', 'invalid_relation', 'only the five relation chips are accepted');
select throws_ok($$ select public.save_person(p_name => 'Ali', p_relation_kind => 'Friend', p_relation => repeat('x', 31),
  p_birthday_day => 1, p_birthday_month => 1) $$, '22023', 'invalid_relation', 'a description over 30 characters is refused');
select throws_ok($$ select public.save_person(p_name => 'Ali', p_relation_kind => 'Friend', p_color => 'black',
  p_birthday_day => 1, p_birthday_month => 1) $$, '22023', 'invalid_color', 'only our six pastels are accepted');
select throws_ok($$ select public.save_person(p_name => 'Ali', p_relation_kind => 'Friend',
  p_birthday_day => 1, p_birthday_month => 1, p_little_things => array_fill('x'::text, array[21])) $$,
  '22023', 'invalid_little_things', '21 little things are refused');
select throws_ok($$ select public.save_person(p_name => 'Ali', p_relation_kind => 'Friend',
  p_birthday_day => 1, p_birthday_month => 1, p_little_things => array[repeat('x', 61)]) $$,
  '22023', 'invalid_little_things', 'a little thing over 60 characters is refused');
select throws_ok($$ select public.save_person(p_name => 'Ali', p_relation_kind => 'Friend') $$,
  '22023', 'invalid_birthday', 'a birthday is required');
select throws_ok($$ select public.save_person(p_name => 'Ali', p_relation_kind => 'Friend',
  p_birthday_day => 29, p_birthday_month => 2, p_birthday_year => 2023) $$,
  '22023', 'invalid_birthday', '29 February in a non-leap year is refused');
select throws_ok($$ select public.save_person(p_name => 'Ali', p_relation_kind => 'Friend',
  p_birthday_day => 1, p_birthday_month => 1, p_birthday_year => 2999) $$,
  '22023', 'invalid_birthday', 'a birth year in the future is refused');
select throws_ok($$ select public.save_person(p_name => 'Ali', p_relation_kind => 'Friend',
  p_birthday_day => 1, p_birthday_month => 1, p_days => '[{"kind": "other", "day": 1, "month": 5}]') $$,
  '22023', 'invalid_days', 'an "other" day needs a title');
select throws_ok($$ select public.save_person(p_name => 'Ali', p_relation_kind => 'Friend',
  p_birthday_day => 1, p_birthday_month => 1, p_days => '[{"kind": "birthday", "day": 1, "month": 5}]') $$,
  '22023', 'invalid_days', 'a second birthday is refused');
select throws_ok($$ select public.save_person(p_name => 'Ali', p_relation_kind => 'Friend',
  p_birthday_day => 1, p_birthday_month => 1, p_days => '[{"kind": "anniversary", "day": 31, "month": 4}]') $$,
  '22023', 'invalid_days', '31 April is refused');
select throws_ok($$ select public.save_person(p_name => 'Ali', p_relation_kind => 'Friend',
  p_birthday_day => 1, p_birthday_month => 1,
  p_days => (select jsonb_agg(jsonb_build_object('kind', 'anniversary', 'day', 1, 'month', 1)) from generate_series(1, 11))) $$,
  '22023', 'invalid_days', 'more than 10 other days are refused');
select throws_ok(format($$ select public.save_person(p_id => %L, p_name => 'Mom', p_relation_kind => 'Family',
  p_birthday_day => 10, p_birthday_month => 1, p_days => '[{"id": "%s", "kind": "graduation", "day": 1, "month": 6, "recurring": true}]') $$,
  (select id from ids where key = 'mom'), (select id from ids where key = 'graduation')),
  '22023', 'invalid_days', 'a day id from another person cannot be taken over');
select is((select count(*)::int from public.people where name = 'Ali'), 0,
  'nothing was saved by the refused calls');

-- B: denied ----------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000bb01');
select is((select count(*)::int from public.people), 0, 'B sees none of A''s people');
select is((select count(*)::int from public.occasions), 0, 'B sees none of A''s days');
select throws_ok(format($$ select public.save_person(p_id => %L, p_name => 'Hacked', p_relation_kind => 'Friend',
  p_birthday_day => 1, p_birthday_month => 1) $$, (select id from ids where key = 'mom')),
  'P0002', 'not_found', 'B cannot edit A''s person through save_person');
update public.people set archived_at = now() where id = (select id from ids where key = 'mom');
delete from public.people where id = (select id from ids where key = 'yasmine');
select throws_ok(format($$ insert into public.occasions (person_id, day, month) values (%L, 1, 1) $$,
  (select id from ids where key = 'mom')),
  '42501', null, 'B cannot add a day to A''s person');

-- A: B's attempts changed nothing; archive and restore --------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000aa01');
select is(
  (select string_agg(name || ':' || (archived_at is null), ',' order by name) from public.people),
  'Mom:true,Yasmine:true', 'B could not archive or delete A''s people');

update public.people set archived_at = now() where id = (select id from ids where key = 'mom');
select is((select archived_at is not null from public.people where id = (select id from ids where key = 'mom')),
  true, 'A removes (archives) a person');
select is((select count(*)::int from public.people where archived_at is null), 1,
  'the archived person is left out of the active list');
select is((select count(*)::int from public.occasions where person_id = (select id from ids where key = 'mom')),
  1, 'their days are kept while archived, so Undo brings everything back');
select throws_ok(format($$ select public.save_person(p_id => %L, p_name => 'Mom', p_relation_kind => 'Family',
  p_birthday_day => 10, p_birthday_month => 1) $$, (select id from ids where key = 'mom')),
  'P0002', 'not_found', 'an archived person cannot be edited');

update public.people set archived_at = null where id = (select id from ids where key = 'mom');
select lives_ok(format($$ select public.save_person(p_id => %L, p_name => 'Mom', p_relation_kind => 'Family',
  p_birthday_day => 10, p_birthday_month => 1) $$, (select id from ids where key = 'mom')),
  'Undo restores the person, who can be edited again');

select throws_ok($$ insert into public.people (name, relation_kind) values ('Ali', 'Cousin') $$,
  '23514', null, 'the table itself refuses an unknown relation chip');
select throws_ok($$ insert into public.people (name, relation) values ('Ali', repeat('x', 31)) $$,
  '23514', null, 'the table itself refuses a description over 30 characters');

-- Anonymous ------------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$ select public.save_person(p_name => 'X', p_relation_kind => 'Friend',
  p_birthday_day => 1, p_birthday_month => 1) $$, '42501', null, 'anonymous visitors cannot call save_person');
reset role;

select * from finish();
rollback;
