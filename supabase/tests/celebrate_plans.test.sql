-- pgTAP: birthday plans, the Gift tick, the sealed note and own-day reminders (`pnpm db:test`).
-- A (Amal) plans. B (Badr) is connected to A and is "Badr" in A's people: the
-- person themselves. D (Dounia) is another connection of A. C (Chama) is a stranger.
-- The rule above all: nobody but A ever sees A's plans.
begin;
select plan(61);

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000a801', 'amal.plan@test.local',  '{"first_name": "Amal"}', now()),
  ('00000000-0000-0000-0000-00000000b801', 'badr.plan@test.local',  '{"first_name": "Badr"}', now()),
  ('00000000-0000-0000-0000-00000000c801', 'chama.plan@test.local', '{"first_name": "Chama"}', now()),
  ('00000000-0000-0000-0000-00000000d801', 'dounia.plan@test.local', '{"first_name": "Dounia"}', now());
update public.profiles set onboarded_at = now(), timezone = 'Europe/London'
  where id in ('00000000-0000-0000-0000-00000000a801', '00000000-0000-0000-0000-00000000b801',
               '00000000-0000-0000-0000-00000000c801', '00000000-0000-0000-0000-00000000d801');
insert into public.connections (user_low, user_high) values
  ('00000000-0000-0000-0000-00000000a801', '00000000-0000-0000-0000-00000000b801'),
  ('00000000-0000-0000-0000-00000000a801', '00000000-0000-0000-0000-00000000d801');

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;
create temp table t (key text primary key, val text);
grant all on t to authenticated, service_role;

-- Dates on London's wall clock: Badr's birthday in 10 days, A's own in 20.
insert into t values
  ('today', ((now() at time zone 'Europe/London')::date)::text),
  ('bd', ((now() at time zone 'Europe/London')::date + 10)::text),
  ('mine', ((now() at time zone 'Europe/London')::date + 20)::text);
insert into t select 'bd_next', public.next_occurrence(
  extract(day from (select val::date from t where key = 'bd'))::int,
  extract(month from (select val::date from t where key = 'bd'))::int,
  (select val::date from t where key = 'bd') + 1)::text;
update public.profiles
  set birthday_day = extract(day from (select val::date from t where key = 'mine')),
      birthday_month = extract(month from (select val::date from t where key = 'mine'))
  where id = '00000000-0000-0000-0000-00000000a801';

-- B has a wish on the birthday list (shared with connections).
select pg_temp.act_as('00000000-0000-0000-0000-00000000b801');
with added as (
  insert into public.wishes (wishlist_id, title)
  select id, 'Football' from public.wishlists where kind = 'birthday'
  returning id)
insert into t select 'ball', id::text from added;

-- A's people: Badr (linked to B), Grandma (in memory), Dad (a day of remembrance).
select pg_temp.act_as('00000000-0000-0000-0000-00000000a801');
insert into t select 'badr', public.save_person(p_name => 'Badr', p_relation_kind => 'Friend',
  p_birthday_day => extract(day from (select val::date from t where key = 'bd'))::int,
  p_birthday_month => extract(month from (select val::date from t where key = 'bd'))::int)::text;
select public.link_person((select val::uuid from t where key = 'badr'), '00000000-0000-0000-0000-00000000b801');
insert into t select 'badr_bd', id::text from public.occasions
  where person_id = (select val::uuid from t where key = 'badr') and kind = 'birthday';
insert into t select 'grandma', public.save_person(p_name => 'Grandma', p_relation_kind => 'Family',
  p_birthday_day => extract(day from (select val::date from t where key = 'bd'))::int,
  p_birthday_month => extract(month from (select val::date from t where key = 'bd'))::int)::text;
update public.people set in_memory = true where id = (select val::uuid from t where key = 'grandma');
insert into t select 'dad', public.save_person(p_name => 'Dad', p_relation_kind => 'Family',
  p_birthday_day => 1, p_birthday_month => 1, p_days =>jsonb_build_array(jsonb_build_object('kind', 'remembrance', 'title', 'In memory of Dad',
    'day', extract(day from (select val::date from t where key = 'bd'))::int,
    'month', extract(month from (select val::date from t where key = 'bd'))::int)))::text;

-- A plans Badr's day ------------------------------------------------------------------------------
select lives_ok($$ insert into t select 'plan', public.start_plan(
  (select val::uuid from t where key = 'badr_bd'), (select val::date from t where key = 'bd'))::text $$,
  'A starts a plan for Badr''s birthday');
select is((select string_agg(label, ',' order by position) from public.plan_steps
           where plan_id = (select val::uuid from t where key = 'plan')),
  'Gift,Message,Call,Cake,Something else', 'with the suggested steps');
select is(public.start_plan((select val::uuid from t where key = 'badr_bd'), (select val::date from t where key = 'bd'))::text,
  (select val from t where key = 'plan'), 'one plan per occurrence: starting again opens the same one');
select lives_ok($$ update public.plan_steps set done_at = now(), ticked_by = 'me'
  where plan_id = (select val::uuid from t where key = 'plan') and kind = 'message' $$, 'A ticks Message');
select lives_ok($$ update public.plan_steps set label = 'Bake his fig cake'
  where plan_id = (select val::uuid from t where key = 'plan') and kind = 'cake' $$, 'A renames a step');
select lives_ok($$ delete from public.plan_steps
  where plan_id = (select val::uuid from t where key = 'plan') and kind = 'other' $$, 'A removes a step');
select lives_ok($$ insert into public.plan_steps (plan_id, kind, label, position)
  values ((select val::uuid from t where key = 'plan'), 'other', 'Book the rooftop', 5) $$, 'A adds her own step');
select lives_ok($$ update public.plans set note = 'He loves the rooftop at sunset'
  where id = (select val::uuid from t where key = 'plan') $$, 'A writes a short note');
select throws_ok($$ update public.plans set note = repeat('x', 281)
  where id = (select val::uuid from t where key = 'plan') $$, '23514', null, 'the note stays short');
select throws_ok($$ select public.start_plan((select val::uuid from t where key = 'badr_bd'),
  (select val::date from t where key = 'bd') + 1) $$, '22023', 'invalid_occurrence', 'only a real occurrence of the day');
select throws_ok($$ select public.start_plan((select val::uuid from t where key = 'badr_bd'),
  (select val::date from t where key = 'today') - 400) $$, '22023', 'invalid_occurrence', 'not a long-gone year');
select throws_ok($$ insert into public.plans (occasion_id, occurs_on)
  values ((select val::uuid from t where key = 'badr_bd'), (select val::date from t where key = 'bd') + 365) $$,
  '42501', null, 'no direct inserts: plans start through start_plan()');
select throws_ok($$ insert into public.plan_steps (plan_id, label)
  select (select val::uuid from t where key = 'plan'), 'Step ' || g from generate_series(1, 10) g $$,
  '23514', 'too_many_steps', 'at most 12 steps');

-- Gentle days: no celebrating -------------------------------------------------------------------------
insert into t select 'grandma_plan', public.start_plan(
  (select id from public.occasions where person_id = (select val::uuid from t where key = 'grandma')),
  (select val::date from t where key = 'bd'))::text;
insert into t select 'dad_plan', public.start_plan(
  (select id from public.occasions where person_id = (select val::uuid from t where key = 'dad') and kind = 'remembrance'),
  (select val::date from t where key = 'bd'))::text;
select is((select string_agg(s.label, ',' order by s.position) from public.plan_steps s
           where s.plan_id = (select val::uuid from t where key = 'grandma_plan')),
  'Send a kind word,Call them,Visit', '"In memory": gentle steps only');
select is((select string_agg(s.label, ',' order by s.position) from public.plan_steps s
           where s.plan_id = (select val::uuid from t where key = 'dad_plan')),
  'Send a kind word,Call them,Visit', 'a day of remembrance: gentle steps only');

-- Your own day ------------------------------------------------------------------------------------------
select lives_ok($$ insert into t select 'my_plan', public.start_plan(null, (select val::date from t where key = 'mine'))::text $$,
  'A starts "My plan" for her own birthday');
select is((select string_agg(label, ',' order by position) from public.plan_steps
           where plan_id = (select val::uuid from t where key = 'my_plan')),
  'Plan something with friends,Cake,Treat yourself,Something just for me', 'with her own-day steps');
select is(public.start_plan(null, (select val::date from t where key = 'mine'))::text,
  (select val from t where key = 'my_plan'), 'one own-day plan per year');

-- Next year starts fresh ------------------------------------------------------------------------------------
select isnt(public.start_plan((select val::uuid from t where key = 'badr_bd'),
  (select val::date from t where key = 'bd_next'))::text,
  (select val from t where key = 'plan'), 'next year''s birthday is a different plan');
reset role;
select is(public.next_occurrence(29, 2, '2027-01-10'), '2027-02-28'::date, '29 February falls on the 28th in 2027');
select is(public.next_occurrence(29, 2, '2028-01-10'), '2028-02-29'::date, '...and on the 29th in 2028');
select is(public.next_occurrence(22, 11, '2026-11-23'), '2027-11-22'::date, 'the day after: next year');
select pg_temp.act_as('00000000-0000-0000-0000-00000000a801');
select is((select count(*)::int from public.plan_steps s join public.plans p on p.id = s.plan_id
           where p.occasion_id = (select val::uuid from t where key = 'badr_bd')
             and p.occurs_on > (select val::date from t where key = 'bd') and s.done_at is not null), 0,
  'nothing is ticked on a fresh year');

-- Nobody else sees A's plans ----------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000b801');
select is((select count(*)::int from public.plans), 0, 'Badr himself can''t see the plan for his day');
select is((select count(*)::int from public.plan_steps), 0, '...or any of its steps');
select lives_ok($$ update public.plan_steps set label = 'peek' $$, 'Badr updating steps...');
select lives_ok($$ delete from public.plans $$, '...or deleting plans...');
select throws_ok(format($$ insert into public.plan_steps (plan_id, label) values (%L, 'Hi') $$,
  (select val from t where key = 'plan')), '42501', null, '...or adding a step to A''s plan fails');
select throws_ok($$ select public.start_plan((select val::uuid from t where key = 'badr_bd'),
  (select val::date from t where key = 'bd')) $$, 'P0002', 'plan_not_found', '...as does starting one on A''s day');
select pg_temp.act_as('00000000-0000-0000-0000-00000000d801');
select is((select count(*)::int from public.plans) + (select count(*)::int from public.plan_steps), 0,
  'another connection of A sees nothing');
select pg_temp.act_as('00000000-0000-0000-0000-00000000c801');
select is((select count(*)::int from public.plans) + (select count(*)::int from public.plan_steps), 0,
  'a stranger sees nothing');
select throws_ok($$ select public.start_plan(null, (select val::date from t where key = 'mine')) $$,
  'P0002', 'no_birthday', 'no own-day plan without a birthday');
reset role;
select is((select count(*)::int from public.plan_steps where label = 'peek'), 0, 'nothing of A''s changed');
select is((select count(*)::int from public.plans where id = (select val::uuid from t where key = 'plan')), 1,
  'A''s plan is still there');

-- Reserving a gift ticks "Gift" (and tells Badr nothing) -----------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000a801');
select lives_ok($$ select public.reserve_wish((select val::uuid from t where key = 'ball')) $$, 'A reserves Badr''s football');
select is((select ticked_by from public.plan_steps
           where plan_id = (select val::uuid from t where key = 'plan') and kind = 'gift'),
  'reservation', 'Gift is ticked in A''s plan');
select pg_temp.act_as('00000000-0000-0000-0000-00000000b801');
select is((select count(*)::int from public.plans) + (select count(*)::int from public.reservations), 0,
  'Badr sees no plan and no reservation');
select pg_temp.act_as('00000000-0000-0000-0000-00000000a801');
select lives_ok($$ delete from public.reservations where wish_id = (select val::uuid from t where key = 'ball') $$,
  'A cancels her reservation');
select is((select done_at from public.plan_steps
           where plan_id = (select val::uuid from t where key = 'plan') and kind = 'gift'), null,
  'Gift is unticked again');
-- No plan yet: reserving starts one with Gift ticked.
delete from public.plans where id = (select val::uuid from t where key = 'plan');
select public.reserve_wish((select val::uuid from t where key = 'ball'));
select is((select s.ticked_by from public.plan_steps s join public.plans p on p.id = s.plan_id
           where p.occasion_id = (select val::uuid from t where key = 'badr_bd')
             and p.occurs_on = (select val::date from t where key = 'bd') and s.kind = 'gift'),
  'reservation', 'with no plan yet, reserving starts one with Gift ticked');
-- Badr removes the wish: the reservation is cancelled, so is the tick.
select pg_temp.act_as('00000000-0000-0000-0000-00000000b801');
update public.wishes set removed_at = now() where id = (select val::uuid from t where key = 'ball');
select pg_temp.act_as('00000000-0000-0000-0000-00000000a801');
select is((select s.done_at from public.plan_steps s join public.plans p on p.id = s.plan_id
           where p.occasion_id = (select val::uuid from t where key = 'badr_bd')
             and p.occurs_on = (select val::date from t where key = 'bd') and s.kind = 'gift'),
  null, 'a removed wish unticks Gift too');
-- Ticked by hand: cancelling a reservation leaves it alone.
select pg_temp.act_as('00000000-0000-0000-0000-00000000b801');
update public.wishes set removed_at = null where id = (select val::uuid from t where key = 'ball');
select pg_temp.act_as('00000000-0000-0000-0000-00000000a801');
update public.plan_steps s set done_at = now(), ticked_by = 'me'
  from public.plans p where p.id = s.plan_id and p.occasion_id = (select val::uuid from t where key = 'badr_bd') and s.kind = 'gift';
reset role;
delete from public.reservations where wish_id = (select val::uuid from t where key = 'ball');
insert into public.reservations (wish_id, reserver_id) values
  ((select val::uuid from t where key = 'ball'), '00000000-0000-0000-0000-00000000a801');
delete from public.reservations where wish_id = (select val::uuid from t where key = 'ball');
select is((select s.ticked_by from public.plan_steps s join public.plans p on p.id = s.plan_id
           where p.occasion_id = (select val::uuid from t where key = 'badr_bd')
             and p.occurs_on = (select val::date from t where key = 'bd') and s.kind = 'gift'),
  'me', 'a Gift A ticked herself stays ticked');

-- A note to future me: sealed until the day ---------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000a801');
select is(public.seal_future_note('  Dear me, you did it.  '), (select val::date from t where key = 'mine'),
  'A seals a note until her birthday');
select is((select count(*)::int from public.future_notes), 0, 'before the day, not even A can read it');
select is((select opens_on from public.my_sealed_note()), (select val::date from t where key = 'mine'),
  '...she only knows when it opens');
select throws_ok($$ select public.seal_future_note('Another one') $$, '23505', 'note_sealed',
  'a sealed note can''t be replaced...');
select throws_ok($$ update public.future_notes set body = 'edited' $$, '42501', null, '...or edited');
select lives_ok($$ delete from public.future_notes where opens_on > '2000-01-01' $$, 'a filtered delete...');
select is((select opens_on from public.my_sealed_note()), (select val::date from t where key = 'mine'),
  '...can''t reach a sealed note (it isn''t readable)');
select lives_ok($$ select public.throw_away_future_note() $$, '"Throw away and write a new one"');
select is((select count(*)::int from public.my_sealed_note()), 0, 'it''s gone');
select throws_ok($$ select public.seal_future_note('   ') $$, '22023', 'invalid_note', 'an empty note isn''t sealed');
reset role;
-- A note that opens today (written a year ago), in A's timezone.
insert into public.future_notes (owner_id, opens_on, body) values
  ('00000000-0000-0000-0000-00000000a801', (select val::date from t where key = 'today'), 'Happy birthday, me');
select pg_temp.act_as('00000000-0000-0000-0000-00000000a801');
select is((select body from public.future_notes), 'Happy birthday, me', 'on the day, A reads it');
select pg_temp.act_as('00000000-0000-0000-0000-00000000b801');
select is((select count(*)::int from public.future_notes), 0, 'nobody else ever can');

-- Own-day reminders ----------------------------------------------------------------------------------------------------
reset role;
insert into public.reminder_settings (profile_id) values ('00000000-0000-0000-0000-00000000a801')
  on conflict (profile_id) do nothing;
select is((select remind_my_day from public.reminder_settings where profile_id = '00000000-0000-0000-0000-00000000a801'),
  false, 'own-day reminders are off by default');
set local role service_role;
select is((select count(*)::int from public.own_day_candidates()
           where profile_id = '00000000-0000-0000-0000-00000000a801'), 0, 'off: not a candidate');
reset role;
update public.reminder_settings set remind_my_day = true where profile_id = '00000000-0000-0000-0000-00000000a801';
set local role service_role;
select is((select birthday_day || '/' || birthday_month || ' ' || email_on::text from public.own_day_candidates()
           where profile_id = '00000000-0000-0000-0000-00000000a801'),
  extract(day from (select val::date from t where key = 'mine')) || '/' ||
  extract(month from (select val::date from t where key = 'mine')) || ' true', 'on: a candidate, with her day');
select is((select count(*)::int from public.claim_reminders('00000000-0000-0000-0000-00000000a801',
  '44444444-4444-4444-4444-444444444444', array['you|7|' || (select val from t where key = 'mine')], 'email')), 1,
  'the 7-day own-day reminder is claimed');
select is((select count(*)::int from public.claim_reminders('00000000-0000-0000-0000-00000000a801',
  '55555555-5555-5555-5555-555555555555', array['you|7|' || (select val from t where key = 'mine')], 'email')), 0,
  'and never twice');
select is((select count(*)::int from public.reminder_log_keys()
           where profile_id = '00000000-0000-0000-0000-00000000a801' and key = 'you|7|' || (select val from t where key = 'mine')), 1,
  'its key is logged as "you|7|date"');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000a801');
select throws_ok($$ select * from public.own_day_candidates() $$, '42501', null, 'users can''t list candidates');

select * from finish();
rollback;
