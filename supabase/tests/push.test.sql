-- pgTAP: push subscriptions and push in notification_log (`pnpm db:test`).
-- A (Amal) has a device; B (Badr) is another user.
begin;
select plan(30);

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000a901', 'amal.push@test.local', '{"first_name": "Amal"}', now()),
  ('00000000-0000-0000-0000-00000000b901', 'badr.push@test.local', '{"first_name": "Badr"}', now());
update public.profiles set onboarded_at = now(), timezone = 'Europe/London'
  where id in ('00000000-0000-0000-0000-00000000a901', '00000000-0000-0000-0000-00000000b901');
insert into public.reminder_settings (profile_id, offsets_days, email, push) values
  ('00000000-0000-0000-0000-00000000a901', '{7}', false, false),
  ('00000000-0000-0000-0000-00000000b901', '{7}', false, false);

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;
create temp table t (key text primary key, val text);
grant all on t to authenticated, service_role;
-- A real-shaped device: P-256 public key (87 chars) and auth secret (22 chars), base64url.
insert into t values
  ('endpoint', 'https://fcm.googleapis.com/fcm/send/device-amal-1'),
  ('p256dh', 'BG_wO5SSQc4drdQ1GeaWDgqFtBppoFwygQOqK84VlMoWPE91OlW_AdxT9sCwx-7ni0DG_30lqW4igrmJzvccFEo'),
  ('auth', 'AAAAAAAAAAAAAAAAAAAAAA');

-- A subscribes this device -------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000a901');
insert into t select 'khalid', public.save_person(p_name => 'Khalid', p_relation_kind => 'Friend',
  p_birthday_day => 13, p_birthday_month => 11)::text;
select lives_ok($$ insert into t select 'device', public.save_push_subscription(
  (select val from t where key = 'endpoint'), (select val from t where key = 'p256dh'),
  (select val from t where key = 'auth'), 'Chrome on Android')::text $$, 'A saves her device');
select is((select device_label from public.push_subscriptions), 'Chrome on Android', 'A reads her device');
select is((select push from public.reminder_settings), true, 'subscribing turns push on');
select throws_ok($$ select p256dh from public.push_subscriptions $$, '42501', null,
  'the device keys aren''t readable through the API');
select throws_ok($$ insert into public.push_subscriptions (endpoint, p256dh, auth)
  values ('https://fcm.googleapis.com/fcm/send/x', 'x', 'y') $$, '42501', null, 'no direct inserts');
select throws_ok($$ update public.push_subscriptions set device_label = 'x' $$, '42501', null, 'no updates');
select throws_ok($$ select public.save_push_subscription('https://evil.example/push', 'x', 'y', 'z') $$,
  '22023', 'invalid_endpoint', 'only known push services (the server POSTs there)');
select throws_ok($$ select public.save_push_subscription('http://fcm.googleapis.com/fcm/send/x', 'x', 'y', 'z') $$,
  '22023', 'invalid_endpoint', 'https only');
select throws_ok($$ select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/other',
  'not-a-key', 'AAAAAAAAAAAAAAAAAAAAAA', 'z') $$, '23514', null, 'device keys must look like keys');

-- B, a stranger ----------------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000b901');
select is((select count(*)::int from public.push_subscriptions), 0, 'B can''t see A''s devices');
select lives_ok($$ delete from public.push_subscriptions $$, 'B deleting...');
reset role;
select is((select count(*)::int from public.push_subscriptions
           where profile_id = '00000000-0000-0000-0000-00000000a901'), 1, '...removes nothing of A''s');
select throws_ok(format($$ insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth)
  values ('00000000-0000-0000-0000-00000000b901', %L, %L, %L) $$,
  (select val from t where key = 'endpoint'), (select val from t where key = 'p256dh'),
  (select val from t where key = 'auth')), '23505', null, 'an endpoint exists once');

-- Push candidates and devices (server only) -----------------------------------------------------------------
set local role service_role;
select is((select email_on::text || ' ' || push_on::text from public.reminder_candidates()
           where profile_id = '00000000-0000-0000-0000-00000000a901'), 'false true',
  'a push-only user is a candidate, with push on and email off');
select is((select count(*)::int from public.reminder_push_devices()
           where profile_id = '00000000-0000-0000-0000-00000000a901'), 1, 'her device is listed for the job');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000a901');
select throws_ok($$ select * from public.reminder_push_devices() $$, '42501', null,
  'users can''t list devices with their keys');
reset role;

-- Push dedupe in notification_log ------------------------------------------------------------------------------
insert into t select 'key', o.id || '|7|2026-11-13' from public.occasions o
  where o.person_id = (select val::uuid from t where key = 'khalid');
set local role service_role;
select is((select count(*)::int from public.claim_reminders('00000000-0000-0000-0000-00000000a901',
  '11111111-1111-1111-1111-111111111111', array[(select val from t where key = 'key')], 'push')), 1,
  'the push reminder is claimed');
select is((select count(*)::int from public.claim_reminders('00000000-0000-0000-0000-00000000a901',
  '22222222-2222-2222-2222-222222222222', array[(select val from t where key = 'key')], 'push')), 0,
  'the same push reminder is never claimed twice');
select is((select count(*)::int from public.claim_reminders('00000000-0000-0000-0000-00000000a901',
  '33333333-3333-3333-3333-333333333333', array[(select val from t where key = 'key')], 'email')), 1,
  'email has its own claim for the same day');
select is((select string_agg(channel || ':' || key, ',' order by channel) from public.reminder_log_keys()
           where profile_id = '00000000-0000-0000-0000-00000000a901'),
  'email:' || (select val from t where key = 'key') || ',push:' || (select val from t where key = 'key'),
  'logged keys say which channel');
reset role;
select throws_ok(format($$ insert into public.notification_log (profile_id, kind, occasion_id, offset_days, occurs_on, channel, batch_id)
  values ('00000000-0000-0000-0000-00000000a901', 'reminder', %L, 7, '2026-11-13', 'push', gen_random_uuid()) $$,
  split_part((select val from t where key = 'key'), '|', 1)), '23505', null,
  'the unique key refuses a second push row');
update public.notification_log set claimed_at = now() - interval '11 minutes'
  where batch_id = '11111111-1111-1111-1111-111111111111';
set local role service_role;
select is((select channel from public.reclaim_stuck_reminders()
           where profile_id = '00000000-0000-0000-0000-00000000a901'), 'push',
  'a stuck push claim comes back as push (same batch, same tag)');

-- Test notifications: 3 an hour per channel -------------------------------------------------------------------------
select is(public.allow_test('00000000-0000-0000-0000-00000000a901', 'push'), true, 'test push 1');
select is(public.allow_test('00000000-0000-0000-0000-00000000a901', 'push'), true, 'test push 2');
select is(public.allow_test('00000000-0000-0000-0000-00000000a901', 'push'), true, 'test push 3');
select is(public.allow_test('00000000-0000-0000-0000-00000000a901', 'push'), false, 'the 4th test push is refused');
select is(public.allow_test('00000000-0000-0000-0000-00000000a901', 'email'), true,
  'test emails have their own limit');
reset role;

-- The same browser, someone else now (a shared device) -------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000b901');
select lives_ok($$ select public.save_push_subscription((select val from t where key = 'endpoint'),
  (select val from t where key = 'p256dh'), (select val from t where key = 'auth'), 'Chrome on Android') $$,
  'B subscribes on the same browser');
reset role;
select is((select profile_id::text from public.push_subscriptions where endpoint = (select val from t where key = 'endpoint')),
  '00000000-0000-0000-0000-00000000b901', 'the device moved to B: A''s reminders no longer go there');

-- Deleting the account removes its devices -------------------------------------------------------------------------
delete from auth.users where id = '00000000-0000-0000-0000-00000000b901';
select is((select count(*)::int from public.push_subscriptions where endpoint = (select val from t where key = 'endpoint')), 0,
  'deleting the account removes its push subscriptions');

select * from finish();
rollback;
