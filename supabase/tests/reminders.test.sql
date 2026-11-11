-- pgTAP: email reminders and the daily clean-up (`pnpm db:test`).
-- A (Amal) remembers Khalid; B (Badr) is another user; C (Chama) is connected to A.
begin;
select plan(48);

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000a801', 'amal.rem@test.local',  '{"first_name": "Amal"}', now()),
  ('00000000-0000-0000-0000-00000000b801', 'badr.rem@test.local',  '{"first_name": "Badr"}', now()),
  ('00000000-0000-0000-0000-00000000c801', 'chama.rem@test.local', '{"first_name": "Chama"}', now());
update public.profiles set onboarded_at = now(), timezone = 'Europe/London'
  where id in ('00000000-0000-0000-0000-00000000a801', '00000000-0000-0000-0000-00000000b801');
insert into public.reminder_settings (profile_id, offsets_days, email) values
  ('00000000-0000-0000-0000-00000000a801', '{7,1,0}', true),
  ('00000000-0000-0000-0000-00000000b801', '{7}', true);

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;
create temp table t (key text primary key, val text);
grant all on t to authenticated, service_role;

select pg_temp.act_as('00000000-0000-0000-0000-00000000a801');
insert into t select 'khalid', public.save_person(p_name => 'Khalid', p_relation_kind => 'Friend',
  p_birthday_day => 13, p_birthday_month => 11, p_birthday_year => 1996,
  p_little_things => array['black coffee'])::text;
insert into t select 'omar', public.save_person(p_name => 'Omar', p_relation_kind => 'Friend',
  p_birthday_day => 2, p_birthday_month => 2)::text;
select pg_temp.act_as('00000000-0000-0000-0000-00000000b801');
insert into t select 'sara', public.save_person(p_name => 'Sara', p_relation_kind => 'Friend',
  p_birthday_day => 5, p_birthday_month => 5)::text;
reset role;
insert into t select 'occ', o.id::text from public.occasions o where o.person_id = (select val::uuid from t where key = 'khalid');
insert into t select 'occ_sara', o.id::text from public.occasions o where o.person_id = (select val::uuid from t where key = 'sara');
insert into t values ('k7', (select val from t where key = 'occ') || '|7|2026-11-13'),
                     ('k7_2027', (select val from t where key = 'occ') || '|7|2027-11-13');

-- Candidates -----------------------------------------------------------------------------------
set local role service_role;
select is((select count(*)::int from public.reminder_candidates()
           where profile_id = '00000000-0000-0000-0000-00000000a801'), 2,
  'candidates: one row per day of each person with email on');
select is((select person_name || ' · ' || little_thing || ' · ' || send_time || ' · ' || email
           from public.reminder_candidates() where person_name = 'Khalid'
             and profile_id = '00000000-0000-0000-0000-00000000a801'),
  'Khalid · black coffee · 09:00 · amal.rem@test.local', 'candidates carry the little thing, 09:00 and the address');
reset role;
update public.people set archived_at = now() where id = (select val::uuid from t where key = 'omar');
update public.reminder_settings set email = false where profile_id = '00000000-0000-0000-0000-00000000b801';
set local role service_role;
select is((select count(*)::int from public.reminder_candidates()
           where profile_id = '00000000-0000-0000-0000-00000000a801'), 1, 'archived people are left out');
select is((select count(*)::int from public.reminder_candidates()
           where profile_id = '00000000-0000-0000-0000-00000000b801'), 0, 'email off: nothing');

-- Claims: never twice ------------------------------------------------------------------------------
insert into t select 'claim1', string_agg(c, ',') from public.claim_reminders(
  '00000000-0000-0000-0000-00000000a801', '11111111-1111-1111-1111-111111111111',
  array[(select val from t where key = 'k7')]) c;
select is((select val from t where key = 'claim1'), (select val from t where key = 'k7'), 'the first claim wins');
select is((select count(*)::int from public.claim_reminders(
  '00000000-0000-0000-0000-00000000a801', '22222222-2222-2222-2222-222222222222',
  array[(select val from t where key = 'k7')])), 0, 'claiming the same key again claims nothing (a retry or a second run)');
select is((select count(*)::int from public.claim_reminders(
  '00000000-0000-0000-0000-00000000a801', '22222222-2222-2222-2222-222222222222',
  array[(select val from t where key = 'k7_2027')])), 1, 'next year''s occurrence is a different key');
select is((select count(*)::int from public.claim_reminders(
  '00000000-0000-0000-0000-00000000b801', '33333333-3333-3333-3333-333333333333',
  array[(select val from t where key = 'k7')])), 0, 'a key for someone else''s occasion is never claimed');
select is((select key from public.reminder_log_keys() where profile_id = '00000000-0000-0000-0000-00000000a801'
           and key like '%2026-11-13'), (select val from t where key = 'k7'), 'logged keys come back as occasion|offset|date');
reset role;
select throws_ok(format($$ insert into public.notification_log (profile_id, kind, occasion_id, offset_days, occurs_on, channel, batch_id)
  values ('00000000-0000-0000-0000-00000000a801', 'reminder', %L, 7, '2026-11-13', 'email', gen_random_uuid()) $$,
  (select val from t where key = 'occ')),
  '23505', null, 'the unique key (user, day, offset, occurrence, channel) refuses a duplicate');
select lives_ok(format($$ insert into public.notification_log (profile_id, kind, occasion_id, offset_days, occurs_on, channel, batch_id)
  values ('00000000-0000-0000-0000-00000000a801', 'reminder', %L, 7, '2026-11-13', 'push', gen_random_uuid()) $$,
  (select val from t where key = 'occ')), 'the same reminder on another channel is its own row');
select throws_ok($$ insert into public.notification_log (profile_id, kind, channel) values
  ('00000000-0000-0000-0000-00000000a801', 'reminder', 'email') $$, '23514', null,
  'a reminder row needs its day, offset, occurrence and batch');

-- Stuck claims (other users' open claims, e.g. from local e2e runs, are left out) -------------------------------------------------------------------------------------
set local role service_role;
select is((select count(*)::int from public.reclaim_stuck_reminders() where profile_id = '00000000-0000-0000-0000-00000000a801'), 0, 'a fresh claim isn''t stuck');
reset role;
update public.notification_log set claimed_at = now() - interval '11 minutes'
  where batch_id = '11111111-1111-1111-1111-111111111111';
set local role service_role;
insert into t select 'stuck', batch_id || ' ' || array_to_string(keys, ',') from public.reclaim_stuck_reminders()
  where profile_id = '00000000-0000-0000-0000-00000000a801';
select is((select val from t where key = 'stuck'),
  '11111111-1111-1111-1111-111111111111 ' || (select val from t where key = 'k7'),
  'a claim open for 10+ minutes comes back with its SAME batch id (the idempotency key)');
select is((select count(*)::int from public.reclaim_stuck_reminders() where profile_id = '00000000-0000-0000-0000-00000000a801'), 0, 're-stamped: a second run doesn''t take it too');
reset role;
select is((select attempts::int from public.notification_log where batch_id = '11111111-1111-1111-1111-111111111111'), 2,
  'the attempt is counted');
set local role service_role;
select public.finish_reminders('11111111-1111-1111-1111-111111111111', 're_123');
reset role;
select is((select status || ' ' || provider_id from public.notification_log
           where batch_id = '11111111-1111-1111-1111-111111111111'), 'sent re_123', 'finished: sent, with the provider id');
update public.notification_log set claimed_at = now() - interval '1 hour'
  where batch_id = '11111111-1111-1111-1111-111111111111';
set local role service_role;
select is((select count(*)::int from public.reclaim_stuck_reminders() where profile_id = '00000000-0000-0000-0000-00000000a801'), 0, 'a sent reminder is never retried');
reset role;
-- Five attempts, then failed.
update public.notification_log set claimed_at = now() - interval '11 minutes', attempts = 5
  where batch_id = '22222222-2222-2222-2222-222222222222';
set local role service_role;
select is((select count(*)::int from public.reclaim_stuck_reminders() where profile_id = '00000000-0000-0000-0000-00000000a801'), 0, 'after 5 attempts it isn''t retried...');
reset role;
select is((select status from public.notification_log where batch_id = '22222222-2222-2222-2222-222222222222'), 'failed',
  '...it''s marked failed (and stays logged, so it isn''t sent as new either)');
insert into public.notification_log (profile_id, kind, occasion_id, offset_days, occurs_on, channel, batch_id)
  values ('00000000-0000-0000-0000-00000000a801', 'reminder', (select val::uuid from t where key = 'occ'), 1,
          '2026-11-13', 'email', '44444444-4444-4444-4444-444444444444');
set local role service_role;
select public.release_reminders('44444444-4444-4444-4444-444444444444');
reset role;
select is((select count(*)::int from public.notification_log where batch_id = '44444444-4444-4444-4444-444444444444'), 0,
  'release drops a batch''s open claims');

-- RLS: read own, never write -------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000a801');
select is((select count(*)::int from public.notification_log), 3, 'A reads her own log rows');
select throws_ok($$ insert into public.notification_log (profile_id, kind, channel, status)
  values ('00000000-0000-0000-0000-00000000a801', 'test', 'email', 'sent') $$, '42501', null, 'users can''t write log rows');
select throws_ok($$ update public.notification_log set status = 'claimed' $$, '42501', null, 'or change them');
select throws_ok($$ delete from public.notification_log $$, '42501', null, 'or delete them');
select pg_temp.act_as('00000000-0000-0000-0000-00000000b801');
select is((select count(*)::int from public.notification_log), 0, 'B can''t read A''s log');
select throws_ok($$ select * from public.reminder_candidates() $$, '42501', null, 'users can''t read the candidates');
select throws_ok($$ select public.claim_reminders(null, null, null) $$, '42501', null, 'or claim');
select throws_ok($$ select * from public.reclaim_stuck_reminders() $$, '42501', null, 'or reclaim');
select throws_ok($$ select public.run_cleanup() $$, '42501', null, 'or run the clean-up');
select throws_ok($$ select public.call_edge_function('send-reminders') $$, '42501', null, 'or call the cron functions');
reset role;

-- Test emails: 3 an hour ------------------------------------------------------------------------------
set local role service_role;
select is(public.allow_test_email('00000000-0000-0000-0000-00000000b801'), true, 'test email 1 allowed');
select is(public.allow_test_email('00000000-0000-0000-0000-00000000b801'), true, 'test email 2 allowed');
select is(public.allow_test_email('00000000-0000-0000-0000-00000000b801'), true, 'test email 3 allowed');
select is(public.allow_test_email('00000000-0000-0000-0000-00000000b801'), false, 'the 4th within an hour is refused');
reset role;

-- Cron --------------------------------------------------------------------------------------------------
select is((select string_agg(jobname || ' ' || schedule, ', ' order by jobname) from cron.job
           where jobname in ('send-reminders', 'daily-cleanup')),
  'daily-cleanup 30 2 * * *, send-reminders */15 * * * *', 'send-reminders every 15 minutes, clean-up daily');
select is(public.call_edge_function('send-reminders'), null, 'without the Vault secrets the job does nothing');
select throws_ok($$ select public.call_edge_function('anything-else') $$, '22023', 'unknown_function',
  'only our two scheduled functions can be called');

-- Clean-up ----------------------------------------------------------------------------------------------
-- People: archived 31 days ago (goes, with its days and log rows), 29 days ago (stays).
insert into t select 'old', public.save_person(p_name => 'Old', p_relation_kind => 'Friend', p_birthday_day => 1, p_birthday_month => 1)::text
  from (select pg_temp.act_as('00000000-0000-0000-0000-00000000a801')) x;
insert into t select 'recent', public.save_person(p_name => 'Recent', p_relation_kind => 'Friend', p_birthday_day => 1, p_birthday_month => 1)::text;
reset role;
update public.people set archived_at = now() - interval '31 days' where id = (select val::uuid from t where key = 'old');
update public.people set archived_at = now() - interval '29 days' where id = (select val::uuid from t where key = 'recent');
insert into public.notification_log (profile_id, kind, occasion_id, offset_days, occurs_on, channel, batch_id, status)
  select '00000000-0000-0000-0000-00000000a801', 'reminder', o.id, 0, '2027-01-01', 'email', gen_random_uuid(), 'sent'
  from public.occasions o where o.person_id = (select val::uuid from t where key = 'old');
-- Wishes: removed 31 days ago with a photo (goes), 29 days ago (stays), live (stays).
insert into public.connections (user_low, user_high) values
  ('00000000-0000-0000-0000-00000000a801', '00000000-0000-0000-0000-00000000c801');
insert into public.wishes (owner_id, wishlist_id, title, image_path, removed_at) values
  ('00000000-0000-0000-0000-00000000a801',
   (select id from public.wishlists where owner_id = '00000000-0000-0000-0000-00000000a801' and kind = 'birthday'),
   'Old wish', '00000000-0000-0000-0000-00000000a801/old.webp', now() - interval '31 days'),
  ('00000000-0000-0000-0000-00000000a801',
   (select id from public.wishlists where owner_id = '00000000-0000-0000-0000-00000000a801' and kind = 'birthday'),
   'Recent wish', null, now() - interval '29 days'),
  ('00000000-0000-0000-0000-00000000a801',
   (select id from public.wishlists where owner_id = '00000000-0000-0000-0000-00000000a801' and kind = 'birthday'),
   'Live wish', null, null),
  ('00000000-0000-0000-0000-00000000a801',
   (select id from public.wishlists where owner_id = '00000000-0000-0000-0000-00000000a801' and kind = 'birthday'),
   'Fresh cancel', null, null),
  ('00000000-0000-0000-0000-00000000a801',
   (select id from public.wishlists where owner_id = '00000000-0000-0000-0000-00000000a801' and kind = 'birthday'),
   'Old cancel', null, null);
-- Reservations by C: active (stays), cancelled 5 minutes ago (stays: still restorable), 11 minutes ago (goes).
insert into public.reservations (wish_id, reserver_id, cancelled_at) values
  ((select id from public.wishes where title = 'Live wish'), '00000000-0000-0000-0000-00000000c801', null),
  ((select id from public.wishes where title = 'Fresh cancel'), '00000000-0000-0000-0000-00000000c801', now() - interval '5 minutes'),
  ((select id from public.wishes where title = 'Old cancel'), '00000000-0000-0000-0000-00000000c801', now() - interval '11 minutes');
-- Invites: expired 2 days ago (goes), still valid (stays).
insert into public.invites (inviter_id, token_hash, expires_at) values
  ('00000000-0000-0000-0000-00000000a801', extensions.digest('old-token', 'sha256'), now() - interval '2 days'),
  ('00000000-0000-0000-0000-00000000a801', extensions.digest('new-token', 'sha256'), now() + interval '6 days');
-- An ancient log row (goes).
insert into public.notification_log (profile_id, kind, channel, status, created_at)
  values ('00000000-0000-0000-0000-00000000b801', 'test', 'email', 'sent', now() - interval '401 days');

set local role service_role;
insert into t select 'cleanup', public.run_cleanup()::text;
reset role;
select is((select val::jsonb -> 'image_paths' from t where key = 'cleanup'),
  '["00000000-0000-0000-0000-00000000a801/old.webp"]'::jsonb, 'clean-up returns the photos to delete from Storage');
select is((select count(*)::int from public.people where id = (select val::uuid from t where key = 'old')), 0,
  'people archived over 30 days are deleted for good');
select is((select count(*)::int from public.occasions o where o.person_id = (select val::uuid from t where key = 'old'))
          + (select count(*)::int from public.notification_log where occurs_on = '2027-01-01'), 0,
  '...with their days and log rows');
select is((select count(*)::int from public.people where id = (select val::uuid from t where key = 'recent')), 1,
  'people archived 29 days ago stay (Undo is gone, but not the person yet)');
select is((select string_agg(title, ', ' order by title) from public.wishes
           where owner_id = '00000000-0000-0000-0000-00000000a801'),
  'Fresh cancel, Live wish, Old cancel, Recent wish', 'wishes removed over 30 days go; recent and live ones stay');
select is((select count(*)::int from public.reservations where cancelled_at is null), 1, 'active reservations stay');
select is((select count(*)::int from public.reservations where cancelled_at is not null), 1,
  'a cancellation still inside its 10 minutes stays; a final one goes');
select is((select count(*)::int from public.invites where inviter_id = '00000000-0000-0000-0000-00000000a801'), 1,
  'invites past expiry go; valid ones stay');
select is((select count(*)::int from public.notification_log where created_at < now() - interval '400 days'), 0,
  'log rows older than 400 days go');
select is((select (val::jsonb ->> 'people')::int + (val::jsonb ->> 'wishes')::int + (val::jsonb ->> 'reservations')::int
                  + (val::jsonb ->> 'invites')::int + (val::jsonb ->> 'notification_log')::int from t where key = 'cleanup'),
  5, 'it reports what it deleted');

select * from finish();
rollback;
