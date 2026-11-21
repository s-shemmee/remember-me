-- pgTAP: Help & feedback (`pnpm db:test`).
-- People send their own feedback and can never read it back; 5 in 24 hours;
-- only the server reads it and marks it emailed; it goes with the account.
begin;
select plan(16);

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000f701', 'fb.one@test.local', '{"first_name": "Amal"}', now()),
  ('00000000-0000-0000-0000-00000000f702', 'fb.two@test.local', '{"first_name": "Badr"}', now());

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

select has_table('public', 'feedback', 'the feedback table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.feedback'::regclass), 'RLS is on');

-- Sending ---------------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000f701');
select lives_ok($$ insert into public.feedback (type, message, meta)
  values ('idea', 'A dark calendar, please', '{"route": "/calendar", "screen": "390x844"}') $$,
  'you can send feedback (user_id is you)');
select throws_ok($$ insert into public.feedback (user_id, type, message)
  values ('00000000-0000-0000-0000-00000000f702', 'idea', 'As someone else') $$,
  '42501', null, 'you can''t choose who it''s from');
select throws_ok($$ insert into public.feedback (type, message, emailed_at)
  values ('idea', 'Pretend it was emailed', now()) $$,
  '42501', null, '...or set emailed_at');
select throws_ok($$ insert into public.feedback (type, message) values ('rant', 'x') $$,
  '23514', null, 'only the three types');
select throws_ok($$ insert into public.feedback (type, message) values ('idea', '   ') $$,
  '23514', null, 'an empty message is refused');
select throws_ok($$ insert into public.feedback (type, message) values ('idea', repeat('x', 1001)) $$,
  '23514', null, 'more than 1000 characters is refused');

-- Never read back -------------------------------------------------------------------------------
select throws_ok($$ select * from public.feedback $$, '42501', null,
  'you can''t read feedback, not even your own');
select throws_ok($$ update public.feedback set message = 'edited' $$, '42501', null,
  '...or change it');
select throws_ok($$ delete from public.feedback $$, '42501', null, '...or delete it');

-- The limit: 5 in 24 hours ----------------------------------------------------------------------
insert into public.feedback (type, message) values
  ('broken', 'two'), ('other', 'three'), ('idea', 'four'), ('idea', 'five');
select throws_ok($$ insert into public.feedback (type, message) values ('idea', 'six') $$,
  'P0001', 'feedback_limit', 'the sixth in 24 hours is refused');

-- Someone else has their own five.
select pg_temp.act_as('00000000-0000-0000-0000-00000000f702');
select lives_ok($$ insert into public.feedback (type, message) values ('idea', 'mine') $$,
  'another person isn''t affected by your limit');
reset role;

-- The server reads it and marks it emailed -------------------------------------------------------
set local role service_role;
select is((select count(*)::int from public.feedback
  where user_id = '00000000-0000-0000-0000-00000000f701' and emailed_at is null), 5,
  'the server sees the five messages, none emailed yet');
update public.feedback set emailed_at = now() where user_id = '00000000-0000-0000-0000-00000000f701';
select is((select count(*)::int from public.feedback where emailed_at is not null), 5,
  'the server marks them emailed');
reset role;

-- With the account ------------------------------------------------------------------------------
delete from auth.users where id = '00000000-0000-0000-0000-00000000f701';
select is((select count(*)::int from public.feedback
  where user_id = '00000000-0000-0000-0000-00000000f701'), 0,
  'a deleted account takes its feedback with it');

select * from finish();
rollback;
