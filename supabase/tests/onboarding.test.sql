-- pgTAP: onboarding tables, RLS and complete_onboarding() (`pnpm db:test`, CI `database` job).
-- Users: A (Sara) onboards fully, B (Khalid) is the denied side, C (Omar)
-- skips the first person, D (Nadia) hits every validation path.
begin;
select plan(43);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'sara@test.local',   '{"first_name": "Sara"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'khalid@test.local', '{"first_name": "Khalid"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'omar@test.local',   '{"first_name": "Omar"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'nadia@test.local',  '{"first_name": "Nadia"}');

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

-- Structure -----------------------------------------------------------------
select has_table('public', 'people', 'people table exists');
select has_table('public', 'occasions', 'occasions table exists');
select has_table('public', 'reminder_settings', 'reminder_settings table exists');
select has_column('public', 'profiles', 'onboarded_at', 'profiles.onboarded_at exists');
select is(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.people'::regclass, 'public.occasions'::regclass, 'public.reminder_settings'::regclass)),
  true, 'RLS is enabled on people, occasions and reminder_settings'
);
select is(
  (select prosecdef from pg_proc where proname = 'complete_onboarding'),
  false, 'complete_onboarding runs as the caller (security invoker)'
);
select is(
  has_function_privilege('anon', 'public.complete_onboarding(text, integer, integer, integer, public.avatar_kind, text, text, text, text, text, text, integer, integer, integer, text, integer[], boolean, text)', 'execute'),
  false, 'anonymous visitors cannot call complete_onboarding'
);

-- A: full onboarding, own birthday on 29 February ---------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$
  select public.complete_onboarding(
    p_first_name => ' Sara ', p_birthday_day => 29, p_birthday_month => 2,
    p_avatar_kind => 'character', p_avatar_color => 'lilac', p_avatar_character => 'cat',
    p_person_name => 'Khalid', p_person_relation => 'Best friend', p_person_color => 'butter',
    p_person_birthday_day => 14, p_person_birthday_month => 3,
    p_person_little_thing => 'black coffee', p_timezone => 'Africa/Casablanca')
$$, 'A completes onboarding (own birthday 29 Feb, with a first person)');

select is((select onboarded_at is not null from public.profiles), true, 'A is marked onboarded');
select is((select first_name || ' ' || birthday_day || '/' || birthday_month from public.profiles),
  'Sara 29/2', 'A: trimmed first name and 29 February birthday saved');
select is((select avatar_kind || ':' || avatar_character || ':' || avatar_color from public.profiles),
  'character:cat:lilac', 'A: avatar saved');
select is(
  (select name || '|' || relation || '|' || "group" || '|' || color || '|' || array_to_string(little_things, ',')
   from public.people),
  'Khalid|Best friend|friends|butter|black coffee', 'A: first person saved, "Best friend" grouped as friends');
select is(
  (select o.kind || ' ' || o.day || '/' || o.month from public.occasions o join public.people p on p.id = o.person_id),
  'birthday 14/3', 'A: first person''s birthday saved as an occasion');
select is(
  (select offsets_days::text || ' ' || email || ' ' || send_time::text from public.reminder_settings),
  '{7,1,0} true 09:00:00', 'A: reminder defaults (7 days, 1 day, morning of, email on)');
select throws_ok(
  $$ select public.complete_onboarding(p_first_name => 'Sara', p_birthday_day => 1, p_birthday_month => 1,
       p_person_name => 'Someone') $$,
  '22023', 'already_onboarded', 'a second call is refused');
select is((select count(*)::int from public.people), 1, 'A still has exactly one person after the refused call');

-- Remember A's person id for the B tests (B cannot read it under RLS).
reset role;
select set_config('test.khalid_id', (select id::text from public.people where name = 'Khalid'), true);

-- B: the denied side --------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select is_empty($$ select 1 from public.people $$, 'B cannot read A''s people');
select is_empty($$ select 1 from public.occasions $$, 'B cannot read A''s occasions');
select is_empty($$ select 1 from public.reminder_settings $$, 'B cannot read A''s reminder settings');

update public.people set name = 'Hacked' where id = current_setting('test.khalid_id')::uuid;
delete from public.people where id = current_setting('test.khalid_id')::uuid;
update public.reminder_settings set email = false
  where profile_id = '00000000-0000-0000-0000-0000000000a1';
reset role;
select is((select name from public.people where id = current_setting('test.khalid_id')::uuid),
  'Khalid', 'B''s update and delete of A''s person changed nothing');
select is((select email from public.reminder_settings where profile_id = '00000000-0000-0000-0000-0000000000a1'),
  true, 'B cannot change A''s reminder settings');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$ insert into public.occasions (person_id, day, month)
     values (current_setting('test.khalid_id')::uuid, 1, 1) $$,
  '42501', 'new row violates row-level security policy for table "occasions"',
  'B cannot add an occasion to A''s person (blocked by RLS, not by grants)');
select throws_ok(
  $$ insert into public.people (owner_id, name) values ('00000000-0000-0000-0000-0000000000a1', 'Planted') $$,
  '42501', 'permission denied for table people',
  'B cannot create a person owned by A (owner_id is not writable)');
select throws_ok(
  $$ insert into public.people (name, linked_profile_id) values ('X', '00000000-0000-0000-0000-0000000000a1') $$,
  '42501', null, 'users cannot set linked_profile_id (server only, M3)');
select lives_ok(
  $$ insert into public.people (name, color) values ('Mom', 'rose') $$,
  'B can add their own person (owner_id from the default)');
select is((select owner_id from public.people where name = 'Mom'),
  '00000000-0000-0000-0000-0000000000b1'::uuid, '...and it belongs to B');
select throws_ok(
  $$ insert into public.occasions (day, month) values (30, 2) $$,
  '23514', null, 'the table itself refuses 30 February');

-- C: skips the first person, picks other reminders ---------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c1');
select is(
  (select public.complete_onboarding(p_first_name => 'Omar', p_birthday_day => 2, p_birthday_month => 9,
     p_person_name => '  ', p_reminder_offsets => '{0,3,3}', p_reminder_email => false)),
  null::uuid, 'C completes onboarding without a first person (returns no person id)');
select is((select count(*)::int from public.people), 0, 'skipped: no person was created');
select is((select count(*)::int from public.occasions), 0, 'skipped: no occasion was created');
select is((select onboarded_at is not null from public.profiles), true, 'skipped: C is still onboarded');
select is((select offsets_days::text || ' ' || email from public.reminder_settings),
  '{3,0} false', 'C: reminders saved largest first without repeats, email off');

-- D: validation, then success with a person born on 29 February --------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select throws_ok(
  $$ select public.complete_onboarding(p_first_name => 'Nadia', p_birthday_day => 30, p_birthday_month => 2) $$,
  '22023', 'invalid_birthday', '30 February is refused for your own birthday');
select throws_ok(
  $$ select public.complete_onboarding(p_first_name => 'Nadia', p_birthday_day => 1, p_birthday_month => 1,
       p_person_name => 'Yasmine', p_person_birthday_day => 31, p_person_birthday_month => 4) $$,
  '22023', 'invalid_person_birthday', '31 April is refused for the first person');
select throws_ok(
  $$ select public.complete_onboarding(p_first_name => 'Nadia', p_birthday_day => 1, p_birthday_month => 1,
       p_person_name => 'Yasmine', p_person_birthday_day => 29, p_person_birthday_month => 2,
       p_person_birthday_year => 2001) $$,
  '22023', 'invalid_person_birthday', '29 February 2001 (not a leap year) is refused');
select throws_ok(
  $$ select public.complete_onboarding(p_first_name => 'Nadia', p_birthday_day => 1, p_birthday_month => 1,
       p_person_birthday_day => 5, p_person_birthday_month => 5) $$,
  '22023', 'person_name_required', 'a person birthday without a name is refused');
select throws_ok(
  $$ select public.complete_onboarding(p_first_name => 'Nadia', p_birthday_day => 1, p_birthday_month => 1,
       p_reminder_offsets => '{5}') $$,
  '22023', 'invalid_reminders', 'reminder offsets outside 7/3/1/0 are refused');
select throws_ok(
  $$ select public.complete_onboarding(p_first_name => 'Nadia', p_birthday_day => 1, p_birthday_month => 1,
       p_avatar_kind => 'photo', p_avatar_path => '00000000-0000-0000-0000-0000000000a1/me.jpg') $$,
  '22023', 'invalid_avatar', 'a photo outside your own folder is refused');
select throws_ok(
  $$ select public.complete_onboarding(p_first_name => 'Nadia', p_birthday_day => 1, p_birthday_month => 1,
       p_timezone => 'Mars/Olympus') $$,
  '22023', 'invalid_timezone', 'an unknown timezone is refused');
select is(
  (select coalesce(birthday_day::text, 'none') || ' ' || (onboarded_at is null) from public.profiles),
  'none true', 'after every refused call nothing was saved (all or nothing)');
select lives_ok(
  $$ select public.complete_onboarding(p_first_name => 'Nadia', p_birthday_day => 1, p_birthday_month => 1,
       p_person_name => 'Yasmine', p_person_relation => 'Family', p_person_birthday_day => 29,
       p_person_birthday_month => 2, p_person_birthday_year => 2004) $$,
  'a first person born on 29 February 2004 (a leap year) is accepted');
select is(
  (select p."group" || ' ' || o.day || '/' || o.month || '/' || o.year
   from public.occasions o join public.people p on p.id = o.person_id),
  'family 29/2/2004', 'D: person grouped as family, 29 February birthday saved');

-- Anonymous ------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok(
  $$ select public.complete_onboarding(p_first_name => 'X', p_birthday_day => 1, p_birthday_month => 1) $$,
  '42501', null, 'anonymous visitors cannot call complete_onboarding');
reset role;

select * from finish();
rollback;
