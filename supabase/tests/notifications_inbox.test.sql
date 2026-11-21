-- pgTAP: the notification inbox (`pnpm db:test`). Rows are made only on the
-- server; each person reads their own and may only mark them read; wishlist
-- updates reach the owner's connections (not others, not when switched
-- off); nothing is ever made for reservations; reminders aren't doubled.
begin;
select plan(25);

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000c101', 'inbox.yasmine@test.local', '{"first_name": "Yasmine"}', now()),
  ('00000000-0000-0000-0000-00000000c102', 'inbox.maya@test.local', '{"first_name": "Maya"}', now()),
  ('00000000-0000-0000-0000-00000000c103', 'inbox.omar@test.local',    '{"first_name": "Omar"}',    now()),
  ('00000000-0000-0000-0000-00000000c104', 'inbox.nadia@test.local',   '{"first_name": "Nadia"}',   now());
-- Yasmine and Maya are connected; Yasmine and Nadia too (Nadia turns updates off); Omar isn't.
insert into public.connections (user_low, user_high) values
  ('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000c102'),
  ('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000c104');
insert into public.reminder_settings (profile_id, inbox_wishlist_updates)
  values ('00000000-0000-0000-0000-00000000c104', false)
  on conflict (profile_id) do update set inbox_wishlist_updates = false;

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;
create temp table ids (key text primary key, id uuid);
grant all on ids to authenticated;
insert into ids select 'birthday', l.id from public.wishlists l
  where l.owner_id = '00000000-0000-0000-0000-00000000c101' and l.kind = 'birthday';
insert into ids select 'treat', l.id from public.wishlists l
  where l.owner_id = '00000000-0000-0000-0000-00000000c101' and l.kind = 'treat';

select has_table('public', 'notifications', 'the inbox table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.notifications'::regclass), 'RLS is on');
select has_column('public', 'reminder_settings', 'inbox_wishlist_updates', 'the toggle exists');
select is((select column_default from information_schema.columns
            where table_schema = 'public' and table_name = 'reminder_settings'
              and column_name = 'inbox_wishlist_updates'), 'true', '...on by default');

-- Wishlist updates ---------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000c101');
insert into public.wishes (wishlist_id, title) values ((select id from ids where key = 'birthday'), 'Sci-fi box set');
insert into public.wishes (wishlist_id, title) values ((select id from ids where key = 'birthday'), 'Sunflower seeds');
insert into ids select 'wish', w.id from public.wishes w where w.title = 'Sci-fi box set';
insert into public.wishes (wishlist_id, title) values ((select id from ids where key = 'treat'), 'Spa day');
reset role;

select is((select count(*)::int from public.notifications
            where user_id = '00000000-0000-0000-0000-00000000c102' and kind = 'wishlist_update'), 1,
  'a connection gets one row for the day');
select is((select (payload ->> 'count')::int from public.notifications
            where user_id = '00000000-0000-0000-0000-00000000c102' and kind = 'wishlist_update'), 2,
  '...counting both wishes (the private treat list never counts)');
select is((select count(*)::int from public.notifications
            where user_id = '00000000-0000-0000-0000-00000000c103'), 0,
  'someone not connected gets nothing');
select is((select count(*)::int from public.notifications
            where user_id = '00000000-0000-0000-0000-00000000c104'), 0,
  'a connection with wishlist updates off gets nothing');
select is((select count(*)::int from public.notifications
            where user_id = '00000000-0000-0000-0000-00000000c101'), 0,
  'the owner gets nothing about their own list');

-- Reservations: never any signal ------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000c102');
update public.notifications set read_at = now() where kind = 'wishlist_update';
select lives_ok($$ select public.reserve_wish((select id from ids where key = 'wish')) $$,
  'Maya reserves one of Yasmine''s wishes');
reset role;
select is((select count(*)::int from public.notifications
            where user_id = '00000000-0000-0000-0000-00000000c101'), 0,
  'the owner gets no signal about the reservation');
select is((select count(*)::int from public.notifications
            where read_at is null and user_id in (
              '00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000c102',
              '00000000-0000-0000-0000-00000000c103', '00000000-0000-0000-0000-00000000c104')), 0,
  'and nobody gets a new or reopened row for it');
select is((select count(*)::int from pg_type where typname = 'inbox_kind'
            and 'reservation' = any (enum_range(null::public.inbox_kind)::text[])), 0,
  'there is no kind for reservations at all');

-- Read your own, only mark read ------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000c103');
select is((select count(*)::int from public.notifications), 0, 'others'' rows are invisible');
select is((select count(*)::int from public.my_inbox()), 0, '...also through my_inbox()');
select pg_temp.act_as('00000000-0000-0000-0000-00000000c102');
select is((select actor_name || '|' || wish_count from public.my_inbox() where kind = 'wishlist_update'),
  'Yasmine|2', 'my_inbox() names who and how many');
select throws_ok($$ insert into public.notifications (user_id, kind, group_key)
  values ('00000000-0000-0000-0000-00000000c102', 'invite_accepted', 'x') $$,
  '42501', null, 'clients can''t make rows');
select throws_ok($$ update public.notifications set payload = '{"count": 99}' $$,
  '42501', null, '...or change anything but read_at');
select throws_ok($$ delete from public.notifications $$, '42501', null, '...or delete rows');
update public.notifications set read_at = null;
select is((select count(*)::int from public.notifications where read_at is null), 1,
  'you can mark your own read and unread');
reset role;

-- Reminder sent: one row, even with email and push ------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000c102');
insert into ids select 'p', public.save_person(
  p_name => 'Khalid', p_relation_kind => 'Best friend', p_birthday_day => 3, p_birthday_month => 4);
reset role;
insert into ids select 'occ', o.id from public.occasions o where o.person_id = (select id from ids where key = 'p');
insert into public.notification_log (profile_id, kind, occasion_id, offset_days, occurs_on, channel, status, batch_id)
values
  ('00000000-0000-0000-0000-00000000c102', 'reminder', (select id from ids where key = 'occ'), 7, '2027-04-03', 'email', 'sent', gen_random_uuid()),
  ('00000000-0000-0000-0000-00000000c102', 'reminder', (select id from ids where key = 'occ'), 7, '2027-04-03', 'push', 'claimed', gen_random_uuid());
update public.notification_log set status = 'sent' where channel = 'push'
  and profile_id = '00000000-0000-0000-0000-00000000c102';
select is((select count(*)::int from public.notifications
            where user_id = '00000000-0000-0000-0000-00000000c102' and kind = 'reminder'), 1,
  'a reminder sent by email and push is one row');
select pg_temp.act_as('00000000-0000-0000-0000-00000000c102');
select is((select person_name || '|' || occasion_kind || '|' || offset_days from public.my_inbox() where kind = 'reminder'),
  'Khalid|birthday|7', 'my_inbox() says who and when');
reset role;

-- Invite accepted ----------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000c102');
create temp table tok as select public.create_invite() as t;
grant select on tok to authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000c103');
select lives_ok($$ select public.accept_invite((select t from tok)) $$, 'Omar accepts Maya''s invite');
reset role;
select is((select public.name_for(user_id, actor_id) from public.notifications
            where user_id = '00000000-0000-0000-0000-00000000c102' and kind = 'invite_accepted'),
  'Omar', 'the inviter hears who accepted');

-- Cleanup after 30 days ----------------------------------------------------------------------
update public.notifications set updated_at = now() - interval '31 days'
  where user_id = '00000000-0000-0000-0000-00000000c102' and kind = 'wishlist_update';
select public.run_cleanup();
select is((select count(*)::int from public.notifications
            where user_id = '00000000-0000-0000-0000-00000000c102' and kind = 'wishlist_update'), 0,
  'rows go after 30 days');

select * from finish();
rollback;
