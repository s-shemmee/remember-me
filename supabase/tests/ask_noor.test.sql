-- pgTAP: Ask Noor (`pnpm db:test`).
-- help_chunks is read-only for users, written only by the server; the AI
-- usage counts and their claim function are server only; the caps hold.
begin;
select plan(17);

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000a501', 'ask.one@test.local', '{"first_name": "Amal"}', now()),
  ('00000000-0000-0000-0000-00000000a502', 'ask.two@test.local', '{"first_name": "Badr"}', now());

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;
-- A unit vector along one axis (384 dims): easy, exact similarities.
create function pg_temp.axis(i int) returns extensions.vector language sql as $$
  select (array_fill(0::real, array[i - 1]) || array[1::real] || array_fill(0::real, array[384 - i]))::extensions.vector
$$;
grant execute on function pg_temp.axis(int) to authenticated, anon, service_role;

-- The server writes the knowledge base ------------------------------------------------------------
set local role service_role;
insert into public.help_chunks (key, source, title, heading, url, content, content_hash, embedding) values
  ('help/reminders#choose-when#0', 'help/reminders', 'Reminders', 'Choose when', '/help/reminders#choose-when',
   'Reminders arrive at 9:00.', '0123456789abcdef', pg_temp.axis(1)),
  ('help/people#add-someone#0', 'help/people-and-days', 'People', 'Add someone', '/help/people-and-days#add-someone',
   'Tap Add someone.', 'fedcba9876543210', pg_temp.axis(2));
select is((select count(*)::int from public.help_chunks where key in ('help/reminders#choose-when#0', 'help/people#add-someone#0')), 2, 'the server writes help chunks');
reset role;

-- Users read, never write -------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000a501');
select is((select count(*)::int from public.help_chunks where key in ('help/reminders#choose-when#0', 'help/people#add-someone#0')), 2, 'a signed-in user can read the help chunks');
select throws_ok($$ insert into public.help_chunks (key, source, title, heading, url, content, content_hash, embedding)
  values ('x#y#0', 'x', 'X', 'Y', '/x', 'evil', '0000000000000000', pg_temp.axis(3)) $$,
  '42501', null, '...but can''t add one');
select throws_ok($$ update public.help_chunks set content = 'evil' $$, '42501', null, '...or change one');
select throws_ok($$ delete from public.help_chunks $$, '42501', null, '...or delete them');

-- Retrieval: best first, above the threshold only ----------------------------------------------------
select is((select key from public.match_help_chunks(pg_temp.axis(1), 0.8, 5) limit 1),
  'help/reminders#choose-when#0', 'match_help_chunks returns the closest chunk first');
select is((select count(*)::int from public.match_help_chunks(pg_temp.axis(1), 0.8, 5) m where m.key like 'help/%#0'), 1,
  'only chunks above the similarity threshold come back');
select is((select count(*)::int from public.match_help_chunks(pg_temp.axis(9), 0.8, 5)), 0,
  'nothing close enough: nothing comes back (no AI call follows)');

-- Usage counts and claims: server only ----------------------------------------------------------------
select throws_ok($$ select * from public.ai_usage_daily $$, '42501', null, 'a user can''t read the AI usage counts');
select throws_ok($$ select public.claim_ai_use('00000000-0000-0000-0000-00000000a501', 'ask_noor', 20, 500) $$,
  '42501', null, '...or claim a use themselves');
reset role;
set local role anon;
select throws_ok($$ select * from public.help_chunks $$, '42501', null, 'a visitor can''t read the chunks through the API');
reset role;

-- The caps ------------------------------------------------------------------------------------------
-- The cap is shared by every feature: start from no uses today (rolled back at the end).
delete from public.ai_usage_daily where day = (now() at time zone 'utc')::date;
set local role service_role;
select is(public.claim_ai_use('00000000-0000-0000-0000-00000000a501', 'ask_noor', 2, 3), 'ok', 'first question: ok');
select is(public.claim_ai_use('00000000-0000-0000-0000-00000000a501', 'ask_noor', 2, 3), 'ok', 'second: ok');
select is(public.claim_ai_use('00000000-0000-0000-0000-00000000a501', 'ask_noor', 2, 3), 'user_limit',
  'third for the same user: the daily limit');
select is(public.claim_ai_use('00000000-0000-0000-0000-00000000a502', 'ask_noor', 2, 3), 'ok',
  'another user still can (3 of 3 globally now)');
select is(public.claim_ai_use('00000000-0000-0000-0000-00000000a502', 'ask_noor', 2, 3), 'global_limit',
  'the global daily cap stops everyone');
select is((select count from public.ai_usage_daily where profile_id = '00000000-0000-0000-0000-00000000a501'),
  2, 'only a count is kept (no question, no answer)');
reset role;

select * from finish();
rollback;
