-- pgTAP: secret reservations (`pnpm db:test`).
-- A (Amal) owns the wishes. B (Badr) and C (Chama) are both connected to A.
-- D (Driss) is a stranger. The rule above all: A never learns anything.
begin;
select plan(62);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000a701', 'amal.res@test.local',  '{"first_name": "Amal"}'),
  ('00000000-0000-0000-0000-00000000b701', 'badr.res@test.local',  '{"first_name": "Badr"}'),
  ('00000000-0000-0000-0000-00000000c701', 'chama.res@test.local', '{"first_name": "Chama"}'),
  ('00000000-0000-0000-0000-00000000d701', 'driss.res@test.local', '{"first_name": "Driss"}');
update public.profiles set birthday_day = 14, birthday_month = 3, birth_year = 1994
  where id = '00000000-0000-0000-0000-00000000a701';
insert into public.connections (user_low, user_high) values
  ('00000000-0000-0000-0000-00000000a701', '00000000-0000-0000-0000-00000000b701'),
  ('00000000-0000-0000-0000-00000000a701', '00000000-0000-0000-0000-00000000c701');

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;
create temp table t (key text primary key, val text);
grant all on t to authenticated, anon;
-- What a user sees of a wish in friend_wishes() (null: not there).
create function pg_temp.status_of(k text) returns text language sql as $$
  select status from public.friend_wishes() where id = (select val::uuid from t where key = k);
$$;
grant execute on function pg_temp.status_of(text) to authenticated;

-- A adds wishes ----------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000a701');
insert into t select 'bday', id::text from public.wishlists where kind = 'birthday';
insert into t select 'treat', id::text from public.wishlists where kind = 'treat';
with added as (
  insert into public.wishes (wishlist_id, title, image_path)
  select (select val::uuid from t where key = v.l), v.k,
         case when v.k in ('ball', 'nails') then '00000000-0000-0000-0000-00000000a701/' || v.k || '.webp' end
  from (values ('ball', 'bday'), ('earbuds', 'bday'), ('cap', 'bday'), ('book', 'bday'), ('nails', 'treat')) v (k, l)
  returning id, title)
insert into t select title, id::text from added;
insert into t select 'ball_before', to_jsonb(w)::text from public.wishes w
  where id = (select val::uuid from t where key = 'ball');

-- B: sees A's shared wishes and reserves ------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000b701');
select is((select count(*)::int from public.friend_wishes()), 4, 'B sees A''s four "My birthday" wishes');
select is(pg_temp.status_of('nails'), null, 'B never sees A''s "Treat yourself" wishes');
select is((select count(*)::int from public.wishes), 0, 'B can''t read A''s wishes from the table');
select throws_ok($$ select public.reserve_wish((select val::uuid from t where key = 'nails')) $$,
  'P0002', 'wish_not_found', 'B can''t reserve a "Treat yourself" wish');
select is((select birthday_day || '/' || birthday_month from public.my_friends() where first_name = 'Amal'),
  '14/3', 'B sees A''s birthday day and month');
select is(
  (select count(*)::int from information_schema.parameters
   where specific_schema = 'public' and specific_name like 'my_friends%' and parameter_name in ('birth_year', 'year')),
  0, 'my_friends never returns the birth year');
select lives_ok($$ select public.reserve_wish((select val::uuid from t where key = 'ball')) $$, 'B reserves the ball');
select is(pg_temp.status_of('ball'), 'mine', 'B sees "Reserved by you"');
select lives_ok($$ select public.reserve_wish((select val::uuid from t where key = 'ball')) $$,
  'reserving your own reservation again is harmless');
select is((select count(*)::int from public.reservations), 1, 'B reads his own reservation');
select is(pg_temp.status_of('earbuds'), 'free', 'other wishes are still free');
select is((select count(*)::int from public.wishes), 0, 'still no direct access to A''s wishes');

-- C: sees "taken", never who; the second reservation fails ------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000c701');
select is(pg_temp.status_of('ball'), 'taken', 'C sees the ball as taken');
select is((select count(*)::int from public.reservations), 0, 'C can''t read B''s reservation');
select is(
  (select count(*)::int from information_schema.parameters
   where specific_schema = 'public' and specific_name like 'friend_wishes%' and parameter_mode = 'OUT'
     and parameter_name ~ 'reserv|cancel|created|by'),
  0, 'friend_wishes returns no reserver, time or cancellation');
select throws_ok($$ select public.reserve_wish((select val::uuid from t where key = 'ball')) $$,
  '23505', 'already_taken', 'a second reservation on the same wish fails (one per wish)');
select lives_ok($$ delete from public.reservations where wish_id = (select val::uuid from t where key = 'ball') $$,
  'C trying to cancel B''s reservation does nothing...');

-- D: the stranger -----------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000d701');
select is((select count(*)::int from public.friend_wishes()), 0, 'a stranger sees no wishes');
select is((select count(*)::int from public.my_friends()), 0, 'a stranger has no friends here');
select throws_ok($$ select public.reserve_wish((select val::uuid from t where key = 'earbuds')) $$,
  'P0002', 'wish_not_found', 'a stranger can''t reserve');
select is(public.can_view_wish_image('00000000-0000-0000-0000-00000000a701/ball.webp'), false,
  'a stranger can''t read the photo of a shared wish');
select throws_ok($$ select public.are_connected('00000000-0000-0000-0000-00000000a701', '00000000-0000-0000-0000-00000000b701') $$,
  '42501', null, 'nobody can ask whether two other people are connected');

-- Photos -------------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000b701');
select is(public.can_view_wish_image('00000000-0000-0000-0000-00000000a701/ball.webp'), true,
  'a connection can read the photo of a shared wish');
select is(public.can_view_wish_image('00000000-0000-0000-0000-00000000a701/nails.webp'), false,
  'but not of a "Treat yourself" wish');

-- A, the owner: nothing, in any way --------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000a701');
select is_empty($$ select * from public.reservations $$, 'owner: select * from reservations is empty');
select is((select count(*)::int from public.reservations), 0, 'owner: count(*) is 0');
select is((select count(*)::int from public.wishes w join public.reservations r on r.wish_id = w.id), 0,
  'owner: a join from her wishes finds nothing');
select is((select count(*)::int from public.wishes w
           where exists (select 1 from public.reservations r where r.wish_id = w.id)), 0,
  'owner: an exists subquery finds nothing');
select is((select count(*)::int from public.wishes w left join public.reservations r on r.wish_id = w.id
           where r.wish_id is not null), 0, 'owner: a left join finds nothing');
select is((select count(*)::int from public.friend_wishes()
           where owner_id = '00000000-0000-0000-0000-00000000a701'), 0,
  'owner: friend_wishes() never returns her own wishes');
select is((select to_jsonb(w)::text from public.wishes w where id = (select val::uuid from t where key = 'ball')),
  (select val from t where key = 'ball_before'), 'owner: the reserved wish''s row is exactly the same as before');
select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name = 'wishes' and column_name ~ 'reserv|taken|claim'),
  0, 'wishes has no reservation column');
select throws_ok($$ select public.reserve_wish((select val::uuid from t where key = 'ball')) $$,
  'P0002', 'wish_not_found', 'owner: reserving her own (reserved) wish says "not found"...');
select throws_ok($$ select public.reserve_wish((select val::uuid from t where key = 'earbuds')) $$,
  'P0002', 'wish_not_found', '...exactly as for her own free wish...');
select throws_ok($$ select public.reserve_wish('00000000-0000-0000-0000-000000000000') $$,
  'P0002', 'wish_not_found', '...and for a wish that doesn''t exist');
with gone as (delete from public.reservations
  where wish_id = (select val::uuid from t where key = 'ball') returning 1)
insert into t select 'owner_deleted', count(*)::text from gone;
select is((select val from t where key = 'owner_deleted'), '0', 'owner: deleting the reservation affects no rows');
select throws_ok($$ insert into public.reservations (wish_id, reserver_id)
  values ((select val::uuid from t where key = 'earbuds'), '00000000-0000-0000-0000-00000000a701') $$,
  '42501', null, 'owner: no direct insert');
select throws_ok($$ update public.reservations set cancelled_at = now() $$, '42501', null, 'owner: no direct update');
select is((select count(*)::int from public.notices), 0, 'owner: no notes about her wishes');
reset role;
select is((select count(*)::int from pg_publication_tables where tablename in ('reservations', 'notices')), 0,
  'reservations and notices are in no realtime publication');
select is((select count(*)::int from public.reservations where reserver_id = '00000000-0000-0000-0000-00000000b701'), 1,
  'B''s reservation survived the owner''s and C''s delete attempts');

-- Signed out --------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$ select * from public.friend_wishes() $$, '42501', null, 'signed out: no friend_wishes()');
select throws_ok($$ select * from public.reservations $$, '42501', null, 'signed out: no reservations');
reset role;

-- B cancels; C reserves; B reserves the earbuds ------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000b701');
select lives_ok($$ delete from public.reservations where wish_id = (select val::uuid from t where key = 'ball') $$,
  'B cancels his reservation');
select pg_temp.act_as('00000000-0000-0000-0000-00000000c701');
select lives_ok($$ select public.reserve_wish((select val::uuid from t where key = 'ball')) $$,
  'then C can reserve the ball');
select pg_temp.act_as('00000000-0000-0000-0000-00000000b701');
select public.reserve_wish((select val::uuid from t where key = 'earbuds'));

-- A removes the earbuds, restores within 10 minutes ---------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000a701');
update public.wishes set removed_at = now() where id = (select val::uuid from t where key = 'earbuds');
select pg_temp.act_as('00000000-0000-0000-0000-00000000b701');
select is(pg_temp.status_of('earbuds'), null, 'a removed wish disappears for B');
select is((select actor_name || ': ' || kind from public.notices where read_at is null), 'Amal: wish_removed',
  'B gets a quiet note: "Amal removed a wish you''d reserved"');
reset role;
select isnt((select cancelled_at from public.reservations where wish_id = (select val::uuid from t where key = 'earbuds')),
  null, 'the reservation is cancelled, not deleted');
select pg_temp.act_as('00000000-0000-0000-0000-00000000a701');
select is((select count(*)::int from public.notices), 0, 'the owner gets no note');
update public.wishes set removed_at = null where id = (select val::uuid from t where key = 'earbuds');
select pg_temp.act_as('00000000-0000-0000-0000-00000000b701');
select is(pg_temp.status_of('earbuds'), 'mine', 'restored within 10 minutes: B''s reservation holds again');
select is((select count(*)::int from public.notices), 0, '...and the unread note is gone');

-- A removes it again; B reads the note; restore keeps a read note --------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000a701');
update public.wishes set removed_at = now() where id = (select val::uuid from t where key = 'earbuds');
select pg_temp.act_as('00000000-0000-0000-0000-00000000b701');
update public.notices set read_at = now();
select pg_temp.act_as('00000000-0000-0000-0000-00000000a701');
update public.wishes set removed_at = null where id = (select val::uuid from t where key = 'earbuds');
select pg_temp.act_as('00000000-0000-0000-0000-00000000b701');
select is((select count(*)::int from public.notices), 1, 'a note B already read stays');

-- After the 10-minute window the cancellation is final ----------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000a701');
update public.wishes set removed_at = now() where id = (select val::uuid from t where key = 'earbuds');
reset role;
update public.reservations set cancelled_at = now() - interval '11 minutes'
  where wish_id = (select val::uuid from t where key = 'earbuds');
select pg_temp.act_as('00000000-0000-0000-0000-00000000a701');
update public.wishes set removed_at = null where id = (select val::uuid from t where key = 'earbuds');
select pg_temp.act_as('00000000-0000-0000-0000-00000000b701');
select is(pg_temp.status_of('earbuds'), 'free', 'restored after 10 minutes: the wish is free again for B');
select is((select count(*)::int from public.notices where read_at is null), 1, '...and B keeps the note');
select pg_temp.act_as('00000000-0000-0000-0000-00000000c701');
select is(pg_temp.status_of('earbuds'), 'free', 'a cancelled reservation counts as free for C too');
select lives_ok($$ select public.reserve_wish((select val::uuid from t where key = 'earbuds')) $$,
  'C can reserve a wish whose old reservation was cancelled');

-- Moving a reserved wish to "Treat yourself" cancels it too -------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000a701');
update public.wishes set wishlist_id = (select val::uuid from t where key = 'treat')
  where id = (select val::uuid from t where key = 'earbuds');
select pg_temp.act_as('00000000-0000-0000-0000-00000000c701');
select is((select count(*)::int from public.notices where read_at is null), 1,
  'moving a reserved wish to a private list cancels it, with a note');

-- A deletes a reserved wish for good -------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000a701');
delete from public.wishes where id = (select val::uuid from t where key = 'ball');
select pg_temp.act_as('00000000-0000-0000-0000-00000000c701');
select is((select count(*)::int from public.notices where read_at is null), 2, 'deleting a reserved wish notes it too');
reset role;
select is((select count(*)::int from public.reservations where wish_id = (select val::uuid from t where key = 'ball')), 0,
  'and its reservation is gone');

-- Removing a connection cancels reservations both ways ---------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000b701');
with added as (
  insert into public.wishes (wishlist_id, title)
  values ((select id from public.wishlists where kind = 'birthday'), 'Badr''s wish') returning id)
insert into t select 'bilal_gift', id::text from added;
select public.reserve_wish((select val::uuid from t where key = 'cap'));
select pg_temp.act_as('00000000-0000-0000-0000-00000000a701');
select public.reserve_wish((select val::uuid from t where key = 'bilal_gift'));
select pg_temp.act_as('00000000-0000-0000-0000-00000000c701');
select public.reserve_wish((select val::uuid from t where key = 'book'));
select pg_temp.act_as('00000000-0000-0000-0000-00000000b701');
select lives_ok($$ select public.remove_connection((select connection_id from public.my_connections()
  where first_name = 'Amal')) $$, 'B removes his connection with A');
reset role;
select is((select count(*)::int from public.reservations r join public.wishes w on w.id = r.wish_id
           where (r.reserver_id = '00000000-0000-0000-0000-00000000b701' and w.owner_id = '00000000-0000-0000-0000-00000000a701')
              or (r.reserver_id = '00000000-0000-0000-0000-00000000a701' and w.owner_id = '00000000-0000-0000-0000-00000000b701')),
  0, 'removing a connection cancels reservations both ways');
select is((select count(*)::int from public.reservations where reserver_id = '00000000-0000-0000-0000-00000000c701'
           and wish_id = (select val::uuid from t where key = 'book')), 1, 'C''s reservations are untouched');

select * from finish();
rollback;
