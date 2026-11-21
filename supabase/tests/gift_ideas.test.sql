-- pgTAP: Noor's gift ideas (`pnpm db:test`).
-- gift_idea_results is owner-only (read and delete), written only by the
-- server, and goes with the person; the AI global cap is shared by features.
begin;
select plan(17);

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000b601', 'gift.owner@test.local', '{"first_name": "Amal"}', now()),
  ('00000000-0000-0000-0000-00000000b602', 'gift.other@test.local', '{"first_name": "Badr"}', now()),
  ('00000000-0000-0000-0000-00000000b603', 'gift.third@test.local', '{"first_name": "Chama"}', now());
insert into public.connections (user_low, user_high) values
  ('00000000-0000-0000-0000-00000000b601', '00000000-0000-0000-0000-00000000b602'),
  ('00000000-0000-0000-0000-00000000b602', '00000000-0000-0000-0000-00000000b603');

insert into public.people (id, owner_id, name, relation_kind, color) values
  ('00000000-0000-0000-0000-00000000b611', '00000000-0000-0000-0000-00000000b601', 'Khalid', 'Best friend', 'rose');

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

-- The server writes ------------------------------------------------------------------------------
set local role service_role;
insert into public.gift_idea_results (person_id, owner_id, occasion_kind, budget, ideas) values
  ('00000000-0000-0000-0000-00000000b611', '00000000-0000-0000-0000-00000000b601', 'birthday', 'small',
   '[{"title":"A","why":"a"},{"title":"B","why":"b"},{"title":"C","why":"c"}]');
select is((select count(*)::int from public.gift_idea_results), 1, 'the server saves the last ideas');
select throws_ok($$ insert into public.gift_idea_results (person_id, owner_id, occasion_kind, ideas) values
  ('00000000-0000-0000-0000-00000000b611', '00000000-0000-0000-0000-00000000b601', 'birthday', '[{"title":"A"}]') $$,
  '23514', null, 'fewer than 3 ideas are refused');
reset role;

-- The owner reads and deletes -----------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000b601');
select is((select count(*)::int from public.gift_idea_results), 1, 'the owner reads their ideas');
select throws_ok($$ insert into public.gift_idea_results (person_id, owner_id, occasion_kind, ideas) values
  ('00000000-0000-0000-0000-00000000b611', '00000000-0000-0000-0000-00000000b601', 'birthday',
   '[{"title":"A","why":"a"},{"title":"B","why":"b"},{"title":"C","why":"c"}]') $$,
  '42501', null, '...but can''t write them (only the server makes ideas)');
select throws_ok($$ update public.gift_idea_results set budget = 'treat' $$, '42501', null, '...or edit them');

-- Nobody else ---------------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000b602');
select is((select count(*)::int from public.gift_idea_results), 0, 'another user sees nothing');
delete from public.gift_idea_results;
reset role;
select is((select count(*)::int from public.gift_idea_results), 1, '...and can''t delete them');
set local role anon;
select throws_ok($$ select * from public.gift_idea_results $$, '42501', null, 'a visitor can''t read them');
reset role;

-- Wish titles for the prompt: free, shared, connected only ---------------------------------------
-- Khalid (Amal's person) is linked to Badr, who has three wishes: one free,
-- one reserved by Chama, one on the private "Treat yourself" list.
update public.people set linked_profile_id = '00000000-0000-0000-0000-00000000b602'
  where id = '00000000-0000-0000-0000-00000000b611';
update public.wishlists set visibility = 'connections'
  where owner_id = '00000000-0000-0000-0000-00000000b602' and kind = 'birthday';
insert into public.wishes (id, owner_id, wishlist_id, title, price_amount, note)
  select '00000000-0000-0000-0000-00000000b621'::uuid, owner_id, id, 'Film camera', 120, 'the blue one'
  from public.wishlists where owner_id = '00000000-0000-0000-0000-00000000b602' and kind = 'birthday'
  union all
  select '00000000-0000-0000-0000-00000000b622'::uuid, owner_id, id, 'Hiking boots', null, null
  from public.wishlists where owner_id = '00000000-0000-0000-0000-00000000b602' and kind = 'birthday'
  union all
  select '00000000-0000-0000-0000-00000000b623'::uuid, owner_id, id, 'Spa day', null, null
  from public.wishlists where owner_id = '00000000-0000-0000-0000-00000000b602' and kind = 'treat';
insert into public.reservations (wish_id, reserver_id) values
  ('00000000-0000-0000-0000-00000000b622', '00000000-0000-0000-0000-00000000b603');

set local role service_role;
select results_eq(
  $$ select title, status from public.gift_idea_wishes('00000000-0000-0000-0000-00000000b601', '00000000-0000-0000-0000-00000000b611') $$,
  $$ values ('Film camera'::text, 'free'::text) $$,
  'only free wishes on the shared list, as titles (never reserved, private, prices or notes)');
select is_empty(
  $$ select * from public.gift_idea_wishes('00000000-0000-0000-0000-00000000b603', '00000000-0000-0000-0000-00000000b611') $$,
  'nothing for someone else''s person');
reset role;
delete from public.connections where user_low = '00000000-0000-0000-0000-00000000b601';
set local role service_role;
select is_empty(
  $$ select * from public.gift_idea_wishes('00000000-0000-0000-0000-00000000b601', '00000000-0000-0000-0000-00000000b611') $$,
  'nothing once you''re no longer connected');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000b601');
select throws_ok($$ select * from public.gift_idea_wishes('00000000-0000-0000-0000-00000000b601', '00000000-0000-0000-0000-00000000b611') $$,
  '42501', null, 'users can''t call it themselves');
reset role;

-- Delete as the owner, and with the person -----------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000b601');
delete from public.gift_idea_results;
reset role;
select is((select count(*)::int from public.gift_idea_results), 0, 'the owner can delete their ideas');
set local role service_role;
insert into public.gift_idea_results (person_id, owner_id, occasion_kind, ideas) values
  ('00000000-0000-0000-0000-00000000b611', '00000000-0000-0000-0000-00000000b601', 'birthday',
   '[{"title":"A","why":"a"},{"title":"B","why":"b"},{"title":"C","why":"c"}]');
reset role;
delete from public.people where id = '00000000-0000-0000-0000-00000000b611';
select is((select count(*)::int from public.gift_idea_results), 0, 'deleting the person deletes their ideas');

-- One global cap shared by every AI feature ----------------------------------------------------------
-- The cap is shared by every feature: start from no uses today (rolled back at the end).
delete from public.ai_usage_daily where day = (now() at time zone 'utc')::date;
set local role service_role;
select is(public.claim_ai_use('00000000-0000-0000-0000-00000000b601', 'ask_noor', 5, 2), 'ok', 'an Ask Noor question');
select is(public.claim_ai_use('00000000-0000-0000-0000-00000000b602', 'gift_ideas', 5, 2), 'ok', '...and gift ideas: 2 of 2 today');
select is(public.claim_ai_use('00000000-0000-0000-0000-00000000b602', 'gift_ideas', 5, 2), 'global_limit',
  'the global cap counts every feature together');
reset role;

select * from finish();
rollback;
