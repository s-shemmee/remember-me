-- pgTAP: public.profiles, its sign-up trigger and RLS (runs in CI: `supabase test db`).
-- Two users act as the allowed and the denied side of every rule.
begin;
select plan(24);

-- Users. Inserting into auth.users fires on_auth_user_created.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'sara@test.local',   '{"first_name": " Sara "}'),
  ('00000000-0000-0000-0000-00000000000b', 'khalid@test.local', '{"given_name": "Khalid", "full_name": "Khalid Amrani"}'),
  ('00000000-0000-0000-0000-00000000000c', 'omar@test.local',   '{"full_name": "Omar Benali"}'),
  ('00000000-0000-0000-0000-00000000000d', 'nobody@test.local', '{}');

-- Act as a user: authenticated role plus their id in the JWT claims.
create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

-- Structure ---------------------------------------------------------------
select has_table('public', 'profiles', 'profiles table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true,
  'RLS is enabled on profiles'
);
select is(
  has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'),
  false,
  'signed-in users cannot call the trigger function'
);

-- Trigger -------------------------------------------------------------------
select is((select count(*)::int from public.profiles), 4, 'every new user gets exactly one profile');
select is((select first_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'Sara', 'first name from the sign-up form, trimmed');
select is((select first_name from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'Khalid', 'first name from Google given_name');
select is((select first_name from public.profiles where id = '00000000-0000-0000-0000-00000000000c'),
  'Omar', 'first name from the first word of full_name');
select is((select first_name from public.profiles where id = '00000000-0000-0000-0000-00000000000d'),
  null, 'no name given: first name stays empty for onboarding');
select is((select timezone from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'Africa/Casablanca', 'timezone defaults to Africa/Casablanca');

-- Read: own row only -------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.profiles), 1, 'Sara sees exactly one profile');
select is((select first_name from public.profiles), 'Sara', '...and it is her own');
select is_empty(
  $$ select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000b' $$,
  'Sara cannot read Khalid''s profile'
);

-- Update: own row only -----------------------------------------------------
update public.profiles set city = 'Marrakech' where id = '00000000-0000-0000-0000-00000000000a';
select is((select city from public.profiles), 'Marrakech', 'Sara can update her own profile');

update public.profiles set city = 'Hacked' where id = '00000000-0000-0000-0000-00000000000b';
reset role;
select is((select city from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  null, 'Sara''s update to Khalid''s profile changed nothing');

-- Columns users may not touch ---------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$ update public.profiles set id = '00000000-0000-0000-0000-0000000000ff' $$,
  '42501', null, 'nobody can change a profile id'
);
select throws_ok(
  $$ update public.profiles set created_at = now() - interval '1 year' $$,
  '42501', null, 'nobody can change created_at'
);

-- No insert, no delete -----------------------------------------------------
select throws_ok(
  $$ insert into public.profiles (id, first_name) values ('00000000-0000-0000-0000-00000000000a', 'Again') $$,
  '42501', null, 'users cannot insert profiles (only the trigger does)'
);
select throws_ok(
  $$ delete from public.profiles where id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'users cannot delete profiles, not even their own'
);

-- Data rules ---------------------------------------------------------------
select throws_ok(
  $$ update public.profiles set birthday_day = 31, birthday_month = 2 $$,
  '23514', null, '31 February is rejected'
);
select lives_ok(
  $$ update public.profiles set birthday_day = 29, birthday_month = 2 $$,
  '29 February is allowed'
);
select throws_ok(
  $$ update public.profiles set birthday_day = null, birthday_month = null, birth_year = 1995 $$,
  '23514', null, 'a birth year needs a birthday'
);
update public.profiles set handle = 'Sara';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$ update public.profiles set handle = 'sara' $$,
  '23505', null, 'handles are unique regardless of case'
);

-- Anonymous visitors -------------------------------------------------------
reset role;
set local role anon;
select throws_ok(
  $$ select * from public.profiles $$,
  '42501', null, 'anonymous visitors cannot read profiles at all'
);
reset role;

-- Cascade ------------------------------------------------------------------
delete from auth.users where id = '00000000-0000-0000-0000-00000000000d';
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000d'),
  0, 'deleting the auth user deletes their profile');

select * from finish();
rollback;
