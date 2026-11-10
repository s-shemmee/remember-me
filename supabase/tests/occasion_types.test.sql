-- pgTAP: occasion types, repeat and titles (`pnpm db:test`, CI `database` job).
-- A (Mira) owns a person; B (Tarik) is the denied side.
begin;
select plan(24);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000ac001', 'mira.types@test.local',  '{"first_name": "Mira"}'),
  ('00000000-0000-0000-0000-0000000bc001', 'tarik.types@test.local', '{"first_name": "Tarik"}');

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;
create temp table ids (key text primary key, id uuid);
grant all on ids to authenticated;

-- Structure ---------------------------------------------------------------------
select ok('work_milestone' = any (enum_range(null::public.occasion_kind)::text[]), 'occasion_kind has work_milestone');
select ok('remembrance' = any (enum_range(null::public.occasion_kind)::text[]), 'occasion_kind has remembrance');
select col_not_null('public', 'occasions', 'recurring', 'occasions.recurring is required');

-- A: every type, with and without titles and years ---------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000ac001');
select lives_ok($$
  insert into ids select 'karim', public.save_person(
    p_name => 'Karim', p_relation_kind => 'Friend', p_birthday_day => 3, p_birthday_month => 4,
    p_days => '[
      {"kind": "work_milestone", "title": "New job", "day": 1, "month": 9, "year": 2026, "recurring": false},
      {"kind": "work_milestone", "title": "Work anniversary", "day": 1, "month": 9, "year": 2019},
      {"kind": "anniversary", "day": 14, "month": 2},
      {"kind": "remembrance", "title": "In memory of Dad", "day": 20, "month": 6},
      {"kind": "remembrance", "day": 21, "month": 6},
      {"kind": "graduation", "title": "Master''s", "day": 30, "month": 6, "year": 2027},
      {"kind": "other", "title": "Moved to a new city", "day": 5, "month": 1, "year": 2024}
    ]')
$$, 'A adds a person with one day of every type');

select is(
  (select string_agg(kind || ':' || coalesce(title, '-') || ':' || recurring, ' | ' order by kind, title nulls first)
   from public.occasions where person_id = (select id from ids where key = 'karim') and kind <> 'birthday'),
  'anniversary:-:true | graduation:Master''s:false | work_milestone:New job:false | work_milestone:Work anniversary:true | remembrance:-:true | remembrance:In memory of Dad:true | other:Moved to a new city:false',
  'titles are optional and kept; repeat defaults: Graduation and Something else once, the rest yearly; an explicit repeat wins');
select is(
  (select recurring from public.occasions where person_id = (select id from ids where key = 'karim') and kind = 'birthday'),
  true, 'the birthday repeats');

-- Validation (A) ------------------------------------------------------------------------
select throws_ok($$ select public.save_person(p_name => 'X', p_relation_kind => 'Friend', p_birthday_day => 1, p_birthday_month => 1,
  p_days => '[{"kind": "graduation", "day": 1, "month": 6}]') $$,
  '22023', 'invalid_days', 'a graduation (once by default) needs a year');
select throws_ok($$ select public.save_person(p_name => 'X', p_relation_kind => 'Friend', p_birthday_day => 1, p_birthday_month => 1,
  p_days => '[{"kind": "other", "title": "First marathon", "day": 1, "month": 6}]') $$,
  '22023', 'invalid_days', 'Something else (once by default) needs a year');
select lives_ok($$ select public.save_person(p_name => 'Name day', p_relation_kind => 'Friend', p_birthday_day => 1, p_birthday_month => 1,
  p_days => '[{"kind": "other", "title": "Name day", "day": 1, "month": 6, "recurring": true}]') $$,
  'Something else set to yearly needs no year');
select throws_ok($$ select public.save_person(p_name => 'X', p_relation_kind => 'Friend', p_birthday_day => 1, p_birthday_month => 1,
  p_days => '[{"kind": "anniversary", "day": 1, "month": 6, "recurring": false}]') $$,
  '22023', 'invalid_days', 'any day set to once needs a year');
select throws_ok($$ select public.save_person(p_name => 'X', p_relation_kind => 'Friend', p_birthday_day => 1, p_birthday_month => 1,
  p_days => '[{"kind": "other", "day": 1, "month": 6, "year": 2024}]') $$,
  '22023', 'invalid_days', 'Something else needs a title');
select lives_ok($$ select public.save_person(p_name => 'Y', p_relation_kind => 'Friend', p_birthday_day => 1, p_birthday_month => 1,
  p_days => '[{"kind": "remembrance", "title": "  ", "day": 1, "month": 6}]') $$,
  'Remembrance with a blank title is fine (the type name is used)');
select throws_ok(format($$ select public.save_person(p_name => 'X', p_relation_kind => 'Friend', p_birthday_day => 1, p_birthday_month => 1,
  p_days => '[{"kind": "anniversary", "title": "%s", "day": 1, "month": 6}]') $$, repeat('x', 41)),
  '22023', 'invalid_days', 'a title over 40 characters is refused');
select throws_ok($$ select public.save_person(p_name => 'X', p_relation_kind => 'Friend', p_birthday_day => 1, p_birthday_month => 1,
  p_days => '[{"kind": "health", "title": "Surgery", "day": 1, "month": 6, "year": 2025}]') $$,
  '22023', 'invalid_days', 'there is no health type (health goes under Something else)');
select throws_ok($$ select public.save_person(p_name => 'X', p_relation_kind => 'Friend', p_birthday_day => 1, p_birthday_month => 1,
  p_days => '[{"kind": "anniversary", "day": 1, "month": 6, "recurring": "sometimes"}]') $$,
  '22023', 'invalid_days', 'repeat must be true or false');

-- Table checks (A, directly) ------------------------------------------------------------------
select throws_ok(format($$ update public.occasions set recurring = false, year = 1990
  where person_id = %L and kind = 'birthday' $$, (select id from ids where key = 'karim')),
  '23514', null, 'a birthday can never be set to once');
select throws_ok(format($$ insert into public.occasions (person_id, kind, title, day, month, recurring)
  values (%L, 'work_milestone', 'Promotion', 1, 3, false) $$, (select id from ids where key = 'karim')),
  '23514', null, 'the table refuses a once day without a year');
select lives_ok(format($$ insert into public.occasions (person_id, kind, title, day, month, year, recurring)
  values (%L, 'work_milestone', 'Promotion', 1, 3, 2026, false) $$, (select id from ids where key = 'karim')),
  'the table accepts a once day with its year');

-- Editing keeps ids and updates repeat --------------------------------------------------------
insert into ids select 'newjob', id from public.occasions
  where person_id = (select id from ids where key = 'karim') and title = 'New job';
select lives_ok(format($$ select public.save_person(p_id => %L, p_name => 'Karim', p_relation_kind => 'Friend',
  p_birthday_day => 3, p_birthday_month => 4,
  p_days => '[{"id": "%s", "kind": "work_milestone", "title": "New job", "day": 1, "month": 9, "year": 2026, "recurring": true}]') $$,
  (select id from ids where key = 'karim'), (select id from ids where key = 'newjob')),
  'A switches the new job to yearly');
select is((select recurring::text || ' ' || title from public.occasions where id = (select id from ids where key = 'newjob')),
  'true New job', 'the day keeps its id; repeat and title are saved');
select is((select count(*)::int from public.occasions where person_id = (select id from ids where key = 'karim')),
  2, 'the days left out of the edit are removed (birthday + new job)');

-- B: denied ---------------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000bc001');
select is((select count(*)::int from public.occasions where person_id = (select id from ids where key = 'karim')),
  0, 'B sees none of A''s days');
select throws_ok(format($$ select public.save_person(p_id => %L, p_name => 'Hacked', p_relation_kind => 'Friend',
  p_birthday_day => 1, p_birthday_month => 1,
  p_days => '[{"kind": "remembrance", "day": 1, "month": 1}]') $$, (select id from ids where key = 'karim')),
  'P0002', 'not_found', 'B cannot edit A''s person or their days');
update public.occasions set recurring = false, year = 2000 where person_id = (select id from ids where key = 'karim');

select pg_temp.act_as('00000000-0000-0000-0000-0000000ac001');
select is((select recurring from public.occasions where id = (select id from ids where key = 'newjob')),
  true, 'B''s direct update changed nothing');

reset role;
select * from finish();
rollback;
