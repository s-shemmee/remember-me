-- pgTAP: no duplicate people when someone connects (`pnpm db:test`).
-- A (Asmaa) has two people for Badr: "Badr" (kept) and "Badr B." (linked to
-- Badr's account, the duplicate). C (Chama) connects through A's link and
-- doesn't share her birthday. D (Dina) is a stranger.
begin;
select plan(20);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000a801', 'asmaa.link@test.local', '{"first_name": "Asmaa"}'),
  ('00000000-0000-0000-0000-00000000b801', 'badr.link@test.local',  '{"first_name": "Badr"}'),
  ('00000000-0000-0000-0000-00000000c801', 'chama.link@test.local', '{"first_name": "Chama"}'),
  ('00000000-0000-0000-0000-00000000d801', 'dina.link@test.local',  '{"first_name": "Dina"}');
update public.profiles set birthday_day = 3, birthday_month = 3, avatar_color = 'mint'
  where id = '00000000-0000-0000-0000-00000000b801';
update public.profiles set birthday_day = 9, birthday_month = 9, share_birthday = false, avatar_color = 'sky'
  where id = '00000000-0000-0000-0000-00000000c801';
insert into public.connections (user_low, user_high) values
  (least('00000000-0000-0000-0000-00000000a801'::uuid, '00000000-0000-0000-0000-00000000b801'::uuid),
   greatest('00000000-0000-0000-0000-00000000a801'::uuid, '00000000-0000-0000-0000-00000000b801'::uuid)),
  (least('00000000-0000-0000-0000-00000000a801'::uuid, '00000000-0000-0000-0000-00000000c801'::uuid),
   greatest('00000000-0000-0000-0000-00000000a801'::uuid, '00000000-0000-0000-0000-00000000c801'::uuid));

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;
create temp table t (key text primary key, val text);
grant all on t to authenticated, anon;

-- A's two records for Badr ---------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000a801');
insert into t select 'keep', public.save_person(p_name => 'Badr', p_relation_kind => 'Best friend',
  p_color => 'peach', p_birthday_day => 1, p_birthday_month => 6,
  p_little_things => array['coffee', 'football'])::text;
insert into t select 'dup', public.save_person(p_name => 'Badr B.', p_relation_kind => 'Friend',
  p_birthday_day => 1, p_birthday_month => 6,
  p_little_things => array['Coffee', 'jazz'],
  p_days => '[{"kind": "anniversary", "title": "Friendiversary", "day": 2, "month": 2, "recurring": true}]')::text;
select public.link_person((select val::uuid from t where key = 'dup'), '00000000-0000-0000-0000-00000000b801');
-- A plan on each birthday for the same year, and one on the duplicate's other day.
insert into t select 'keep_bd', id::text from public.occasions
  where person_id = (select val::uuid from t where key = 'keep') and kind = 'birthday';
insert into t select 'dup_bd', id::text from public.occasions
  where person_id = (select val::uuid from t where key = 'dup') and kind = 'birthday';
insert into t select 'dup_day', id::text from public.occasions
  where person_id = (select val::uuid from t where key = 'dup') and kind <> 'birthday';
insert into t select 'keep_plan', public.start_plan((select val::uuid from t where key = 'keep_bd'), '2027-06-01')::text;
insert into t select 'dup_plan', public.start_plan((select val::uuid from t where key = 'dup_bd'), '2027-06-01')::text;
insert into t select 'day_plan', public.start_plan((select val::uuid from t where key = 'dup_day'), '2027-02-02')::text;
insert into public.plan_steps (plan_id, kind, label, position)
  values ((select val::uuid from t where key = 'dup_plan'), 'other', 'Book the rooftop', 50);
insert into t select 'keep_steps', count(*)::text from public.plan_steps
  where plan_id = (select val::uuid from t where key = 'keep_plan');

-- Link "Badr" to Badr's account: "Badr B." merges into it ------------------------------------------------
select is(public.link_person_to_account((select val::uuid from t where key = 'keep'), '00000000-0000-0000-0000-00000000b801'),
  'Badr B.', 'linking says which duplicate was merged');
select is((select linked_profile_id from public.people where id = (select val::uuid from t where key = 'keep')),
  '00000000-0000-0000-0000-00000000b801'::uuid, 'the kept person is linked to the account');
select ok((select archived_at is not null and linked_profile_id is null from public.people
           where id = (select val::uuid from t where key = 'dup')),
  'the duplicate is removed (archived, unlinked): the daily clean-up deletes it');
select is((select name || ' · ' || relation_kind || ' · ' || color from public.people
           where id = (select val::uuid from t where key = 'keep')),
  'Badr · Best friend · peach', 'my fields on the kept person win: name, relation, colour');
select is((select little_things from public.people where id = (select val::uuid from t where key = 'keep')),
  array['coffee', 'football', 'jazz'], 'little things combined, no repeats (any case)');
select is((select cardinality(little_thing_emojis) from public.people where id = (select val::uuid from t where key = 'keep')),
  3, 'one emoji per little thing still');
select is((select person_id from public.occasions where id = (select val::uuid from t where key = 'dup_day')),
  (select val::uuid from t where key = 'keep'), 'the duplicate''s other day moved here');
select is((select occasion_id from public.plans where id = (select val::uuid from t where key = 'day_plan')),
  (select val::uuid from t where key = 'dup_day'), 'with its plan');
select is((select count(*)::int from public.occasions
           where person_id = (select val::uuid from t where key = 'keep') and kind = 'birthday'), 1,
  'still one birthday (mine: 1 June)');
select is((select count(*)::int from public.plans where id = (select val::uuid from t where key = 'dup_plan')), 0,
  'the duplicate''s birthday plan for the same year joined mine');
select is((select count(*)::int from public.plan_steps
           where plan_id = (select val::uuid from t where key = 'keep_plan')),
  (select val::int + 1 from t where key = 'keep_steps'),
  'one plan, both lists: my steps plus "Book the rooftop" (no repeated suggestions)');
select is(public.link_person_to_account((select val::uuid from t where key = 'keep'), '00000000-0000-0000-0000-00000000b801'),
  null, 'linking again changes nothing');

-- Refused --------------------------------------------------------------------------------------------------
select throws_ok($$ select public.link_person_to_account((select val::uuid from t where key = 'keep'),
  '00000000-0000-0000-0000-00000000d801') $$, '22023', 'not_connected', 'only a connection''s account');
select throws_ok($$ select public.add_person_from_connection('00000000-0000-0000-0000-00000000b801') $$,
  '22023', 'already_linked', '"add as new" for someone already in my people is refused');

-- C joined through A's link: "No, add as new" ---------------------------------------------------------------
select throws_ok($$ select public.add_person_from_connection('00000000-0000-0000-0000-00000000c801') $$,
  '22023', 'birthday_needed', 'C doesn''t share her birthday: A has to give one');
insert into t select 'chama', public.add_person_from_connection('00000000-0000-0000-0000-00000000c801', 12, 4)::text;
select is((select name || ' · ' || color || ' · ' || linked_profile_id::text from public.people
           where id = (select val::uuid from t where key = 'chama')),
  'Chama · sky · 00000000-0000-0000-0000-00000000c801', 'a new person with her first name and colour, linked to her');
select is((select day || '/' || month from public.occasions
           where person_id = (select val::uuid from t where key = 'chama') and kind = 'birthday'),
  '12/4', 'with the birthday A gave (never C''s private one)');

-- Someone else ---------------------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000d801');
select throws_ok(format($$ select public.link_person_to_account(%L, '00000000-0000-0000-0000-00000000a801') $$,
  (select val from t where key = 'keep')), 'P0002', 'person_not_found', 'never someone else''s person');
select throws_ok($$ select public.add_person_from_connection('00000000-0000-0000-0000-00000000a801', 1, 1) $$,
  '22023', 'not_connected', 'a stranger can''t add anyone from an account');
select pg_temp.act_as('00000000-0000-0000-0000-00000000b801');
select is((select count(*)::int from public.people), 0, 'Badr sees none of A''s people');

select * from finish();
rollback;
