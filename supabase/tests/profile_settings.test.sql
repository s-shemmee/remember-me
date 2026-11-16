-- pgTAP: birthday privacy, the avatars bucket, "In memory", account deletion (`pnpm db:test`).
-- A (Amal) is deleted at the end; B (Badr) is connected to A; C (Chama) is a stranger.
begin;
select plan(30);

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000aa01', 'amal.del@test.local',  '{"first_name": "Amal"}', now()),
  ('00000000-0000-0000-0000-00000000bb01', 'badr.del@test.local',  '{"first_name": "Badr"}', now()),
  ('00000000-0000-0000-0000-00000000cc01', 'chama.del@test.local', '{"first_name": "Chama"}', now());
update public.profiles set onboarded_at = now(), birthday_day = 14, birthday_month = 3, birth_year = 1994
  where id = '00000000-0000-0000-0000-00000000aa01';
insert into public.connections (user_low, user_high) values
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-00000000bb01');

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;
create temp table t (key text primary key, val text);
grant all on t to authenticated, service_role;

-- Birthday privacy ----------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000bb01');
select is((select birthday_day || '/' || birthday_month from public.my_friends() where first_name = 'Amal'),
  '14/3', 'sharing on (the default): a connection sees the day and month');
select pg_temp.act_as('00000000-0000-0000-0000-00000000aa01');
update public.profiles set share_birthday = false;
select pg_temp.act_as('00000000-0000-0000-0000-00000000bb01');
select is((select coalesce(birthday_day::text, 'none') || '/' || coalesce(birthday_month::text, 'none')
           from public.my_friends() where first_name = 'Amal'),
  'none/none', 'sharing off: no date at all');
select is((select count(*)::int from public.my_friends() where first_name = 'Amal'), 1,
  '...but she is still a friend (name, look and wishlist stay)');
select pg_temp.act_as('00000000-0000-0000-0000-00000000aa01');
update public.profiles set share_birthday = true;
select throws_ok($$ update public.profiles set theme = 'neon' $$, '23514', null, 'theme is light, dark or system');
select lives_ok($$ update public.profiles set theme = 'dark' $$, 'A saves her theme');

-- Avatars ----------------------------------------------------------------------------------------------------
select throws_ok($$ update public.profiles set avatar_kind = 'photo',
  avatar_path = '00000000-0000-0000-0000-00000000bb01/x.webp' $$, '23514', null,
  'a photo path must be in your own folder');
select throws_ok($$ update public.profiles set avatar_kind = 'photo',
  avatar_path = '00000000-0000-0000-0000-00000000aa01/../x.webp' $$, '23514', null,
  'no tricks in the path');
select lives_ok($$ update public.profiles set avatar_kind = 'photo',
  avatar_path = '00000000-0000-0000-0000-00000000aa01/me.webp' $$, 'A sets her photo');
select pg_temp.act_as('00000000-0000-0000-0000-00000000bb01');
select is(public.can_view_avatar('00000000-0000-0000-0000-00000000aa01/me.webp'), true,
  'a connection can read her current photo');
select is(public.can_view_avatar('00000000-0000-0000-0000-00000000aa01/old.webp'), false,
  '...but not an old one');
select is((select avatar_path from public.my_friends() where first_name = 'Amal'),
  '00000000-0000-0000-0000-00000000aa01/me.webp', 'my_friends gives the path to sign');
select pg_temp.act_as('00000000-0000-0000-0000-00000000cc01');
select is(public.can_view_avatar('00000000-0000-0000-0000-00000000aa01/me.webp'), false,
  'a stranger can''t read it');
reset role;
select is((select public::text || ' ' || file_size_limit::text from storage.buckets where id = 'avatars'),
  'false 2097152', 'the avatars bucket is private, 2 MB')
  from (select 1) x where exists (select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit')
union all select 'skipped: bare storage schema' where not exists (select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit');
select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects'
           and policyname like 'Avatars:%'), 5, 'five avatar policies: own read/upload/update/delete, connections read');
select is((select qual from pg_policies where schemaname = 'storage' and policyname = 'Avatars: upload own') is null
          and (select with_check from pg_policies where schemaname = 'storage' and policyname = 'Avatars: upload own')
              like '%foldername%', true, 'uploads go to your own folder only');

-- "In memory" -------------------------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000bb01');
insert into t select 'amal_person', public.save_person(p_name => 'Amal', p_relation_kind => 'Friend',
  p_birthday_day => 14, p_birthday_month => 3)::text;
select public.link_person((select val::uuid from t where key = 'amal_person'), '00000000-0000-0000-0000-00000000aa01');
update public.people set in_memory = true where id = (select val::uuid from t where key = 'amal_person');
select is((select in_memory from public.people where id = (select val::uuid from t where key = 'amal_person')), true,
  'B marks a person "In memory"');
select pg_temp.act_as('00000000-0000-0000-0000-00000000cc01');
select is((select count(*)::int from public.people where id = (select val::uuid from t where key = 'amal_person')), 0,
  'nobody else can see or change it');
reset role;
update public.profiles set onboarded_at = now() where id = '00000000-0000-0000-0000-00000000bb01';
insert into public.reminder_settings (profile_id, offsets_days, email) values ('00000000-0000-0000-0000-00000000bb01', '{7}', true)
  on conflict (profile_id) do update set email = true;
set local role service_role;
select is((select in_memory::text || ' ' || coalesce(wishlist_friend_id::text, 'no wishlist')
           from public.reminder_candidates() where person_id = (select val::uuid from t where key = 'amal_person')),
  'true no wishlist', 'reminders know: gentle wording, never a wishlist link');
reset role;
update public.people set in_memory = false where id = (select val::uuid from t where key = 'amal_person');

-- Account deletion: build up A's footprint everywhere ------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000aa01');
insert into t select 'khalid', public.save_person(p_name => 'Khalid', p_relation_kind => 'Friend',
  p_birthday_day => 2, p_birthday_month => 2)::text;
insert into public.wishes (wishlist_id, title) values
  ((select id from public.wishlists where kind = 'birthday'), 'A wish B reserved'),
  ((select id from public.wishlists where kind = 'birthday'), 'A wish A removes');
select public.create_invite();
select public.save_push_subscription('https://fcm.googleapis.com/fcm/send/amal-device',
  'BG_wO5SSQc4drdQ1GeaWDgqFtBppoFwygQOqK84VlMoWPE91OlW_AdxT9sCwx-7ni0DG_30lqW4igrmJzvccFEo',
  'AAAAAAAAAAAAAAAAAAAAAA', 'Chrome on Android');
select pg_temp.act_as('00000000-0000-0000-0000-00000000bb01');
insert into public.wishes (wishlist_id, title) values ((select id from public.wishlists where kind = 'birthday'), 'B''s wish A reserved');
reset role;
-- B reserves two of A's wishes; A reserves one of B's.
insert into public.reservations (wish_id, reserver_id) values
  ((select id from public.wishes where title = 'A wish B reserved'), '00000000-0000-0000-0000-00000000bb01'),
  ((select id from public.wishes where title = 'A wish A removes'), '00000000-0000-0000-0000-00000000bb01'),
  ((select id from public.wishes where title = 'B''s wish A reserved'), '00000000-0000-0000-0000-00000000aa01');
-- A removes one: B gets a note carrying A's name.
select pg_temp.act_as('00000000-0000-0000-0000-00000000aa01');
update public.wishes set removed_at = now() where title = 'A wish A removes';
reset role;
select is((select count(*)::int from public.notices where user_id = '00000000-0000-0000-0000-00000000bb01'
           and actor_id = '00000000-0000-0000-0000-00000000aa01'), 1, 'B has a note about A (it knows who it''s about)');
insert into public.notification_log (profile_id, kind, channel, status)
  values ('00000000-0000-0000-0000-00000000aa01', 'test', 'email', 'sent');
-- A note A has herself.
insert into public.notices (user_id, kind, actor_name) values ('00000000-0000-0000-0000-00000000aa01', 'wish_removed', 'Someone');
insert into t select 'b_people_before', count(*)::text from public.people where owner_id = '00000000-0000-0000-0000-00000000bb01';
insert into t select 'b_wishes_before', count(*)::text from public.wishes where owner_id = '00000000-0000-0000-0000-00000000bb01';

-- Users can't run the preparation themselves.
select pg_temp.act_as('00000000-0000-0000-0000-00000000aa01');
select throws_ok($$ select public.prepare_account_deletion('00000000-0000-0000-0000-00000000aa01') $$,
  '42501', null, 'only the server prepares a deletion');
reset role;

-- What the delete-account Edge Function does (minus Storage): prepare, then delete the auth user.
set local role service_role;
select public.prepare_account_deletion('00000000-0000-0000-0000-00000000aa01');
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000aa01';

-- Nothing left behind: no uuid column in any public table holds A's id.
create function pg_temp.mentions(p_id uuid) returns int language plpgsql as $$
declare r record; n int := 0; c int;
begin
  for r in select c.table_name, c.column_name from information_schema.columns c
           join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
           where c.table_schema = 'public' and c.data_type = 'uuid' and tb.table_type = 'BASE TABLE' loop
    execute format('select count(*) from public.%I where %I = $1', r.table_name, r.column_name) into c using p_id;
    n := n + c;
  end loop;
  return n;
end $$;
select is(pg_temp.mentions('00000000-0000-0000-0000-00000000aa01'), 0,
  'A''s id is in no column of any table any more');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000aa01'), 0, 'her profile is gone');
select is((select count(*)::int from public.wishes where title like 'A wish%'), 0, 'her wishes are gone');
select is((select count(*)::int from public.push_subscriptions where endpoint like '%amal-device'), 0,
  'her push subscriptions are gone');
select is((select count(*)::int from public.notices where actor_name = 'Amal'), 0,
  'no note carrying her name is left for anyone');
select is((select count(*)::int from public.reservations r join public.wishes w on w.id = r.wish_id
           where w.title = 'B''s wish A reserved'), 0, 'her reservation on B''s wish is gone');
select is((select linked_profile_id from public.people where id = (select val::uuid from t where key = 'amal_person')),
  null, 'B''s person "Amal" stays, unlinked');
select is((select count(*)::text from public.people where owner_id = '00000000-0000-0000-0000-00000000bb01'),
  (select val from t where key = 'b_people_before'), 'B''s people are untouched');
select is((select count(*)::text from public.wishes where owner_id = '00000000-0000-0000-0000-00000000bb01'),
  (select val from t where key = 'b_wishes_before'), 'B''s wishes are untouched');
select is((select count(*)::int from public.connections where '00000000-0000-0000-0000-00000000bb01' in (user_low, user_high)), 0,
  'the connection is gone');

select * from finish();
rollback;
