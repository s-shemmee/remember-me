-- pgTAP: invites and connections (`pnpm db:test`).
-- A (Amal) invites; B (Badr) accepts; C (Chama) is the stranger.
begin;
select plan(34);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000a601', 'amal.conn@test.local',  '{"first_name": "Amal"}'),
  ('00000000-0000-0000-0000-00000000b601', 'badr.conn@test.local',  '{"first_name": "Badr"}'),
  ('00000000-0000-0000-0000-00000000c601', 'chama.conn@test.local', '{"first_name": "Chama"}');
update public.profiles set birth_year = 1990, birthday_day = 1, birthday_month = 1
  where id = '00000000-0000-0000-0000-00000000b601';

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;
create temp table t (key text primary key, val text);
grant all on t to authenticated, anon;

-- A: invites -------------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000a601');
insert into t select 'khalid', public.save_person(p_name => 'Badr', p_relation_kind => 'Friend',
  p_birthday_day => 2, p_birthday_month => 2)::text;
insert into t select 'tok_person', public.create_invite((select val::uuid from t where key = 'khalid'));
insert into t select 'tok_general', public.create_invite();
insert into t select 'tok_expired', public.create_invite();
insert into t select 'tok_revoked', public.create_invite();

select matches((select val from t where key = 'tok_general'), '^[0-9a-f]{64}$', 'the token is 32 random bytes (64 hex characters)');
select is((select count(id)::int from public.invites), 4, 'A sees her four invites');
select throws_ok($$ select token_hash from public.invites $$, '42501', null, 'the token hash isn''t readable through the API');
reset role;
select is(
  (select count(*)::int from public.invites
   where token_hash = extensions.digest((select val from t where key = 'tok_general'), 'sha256')),
  1, 'only the token''s SHA-256 is stored');
select is(
  (select count(*)::int from public.invites i, t
   where position(convert_to(t.val, 'UTF8') in i.token_hash) > 0), 0, 'the token itself is stored nowhere');
-- Age one invite past its 7 days.
update public.invites set expires_at = now() - interval '1 minute'
  where token_hash = extensions.digest((select val from t where key = 'tok_expired'), 'sha256');
select is(
  (select round(extract(epoch from expires_at - created_at) / 86400)::int from public.invites
   where token_hash = extensions.digest((select val from t where key = 'tok_general'), 'sha256')),
  7, 'invites expire after 7 days');

insert into t select 'revoke_id', id::text from public.invites
  where token_hash = extensions.digest((select val from t where key = 'tok_revoked'), 'sha256');
select pg_temp.act_as('00000000-0000-0000-0000-00000000a601');
select lives_ok(format($$ select public.revoke_invite(%L) $$, (select val from t where key = 'revoke_id')),
  'A revokes an invite');
select throws_ok($$ select public.accept_invite((select val from t where key = 'tok_general')) $$,
  '22023', 'own_invite', 'A can''t accept her own invite');
select is((select status from public.invite_preview((select val from t where key = 'tok_general'))), 'own',
  'the preview tells A it''s her own link');

-- Anonymous preview ---------------------------------------------------------------------------------
reset role;
-- A signed-out visitor: no login claims at all.
select set_config('request.jwt.claims', '', true);
set local role anon;
select is((select inviter_name || ' ' || status from public.invite_preview((select val from t where key = 'tok_general'))),
  'Amal valid', 'a signed-out visitor sees only the inviter''s first name and that the link is valid');
select is((select status from public.invite_preview('nope')), 'not_found', 'an unknown link says so');
select throws_ok($$ select public.accept_invite('x') $$, '42501', null, 'signed-out visitors can''t accept');
reset role;

-- B: refused links, then accept -------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000b601');
select throws_ok($$ select public.accept_invite((select val from t where key = 'tok_expired')) $$,
  '22023', 'invite_expired', 'an expired invite is refused');
select throws_ok($$ select public.accept_invite((select val from t where key = 'tok_revoked')) $$,
  '22023', 'invite_revoked', 'a revoked invite is refused');
select throws_ok($$ select public.accept_invite('0000') $$, '22023', 'invite_not_found', 'an unknown token is refused');
select lives_ok($$ select public.accept_invite((select val from t where key = 'tok_person')) $$,
  'B accepts the invite A sent from her person "Badr"');
select is((select count(*)::int from public.connections), 1, 'B sees the connection');
select throws_ok($$ select public.accept_invite((select val from t where key = 'tok_person')) $$,
  '22023', 'invite_used', 'a used invite is refused');
select throws_ok($$ select public.accept_invite((select val from t where key = 'tok_general')) $$,
  '22023', 'already_connected', 'B can''t connect twice');
select is((select first_name from public.my_connections()), 'Amal', 'B sees Amal in his connections');

-- A: the connection, linked to her person; only safe profile fields ------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000a601');
select is((select first_name || ' → ' || coalesce(linked_person_name, '-') from public.my_connections()),
  'Badr → Badr', 'accepting linked the connection to the person A invited from');
select is((select linked_profile_id from public.people where id = (select val::uuid from t where key = 'khalid')),
  '00000000-0000-0000-0000-00000000b601'::uuid, 'people.linked_profile_id is set');
select is(
  (select array_agg(attname::text order by attnum) from pg_attribute
   where attrelid = (select prorettype from pg_proc where proname = 'my_connections')::regclass
     and attnum > 0) is null
   and not exists (select 1 from information_schema.parameters
                   where specific_name like 'my_connections%' and parameter_name in ('birth_year', 'timezone', 'email')),
  true, 'my_connections never returns birth year, timezone or email');
select is((select count(*)::int from public.profiles), 1, 'A still can''t read B''s profile row');

-- 20 active invites max --------------------------------------------------------------------------------------
insert into t select 'sara', public.save_person(p_name => 'Sara', p_relation_kind => 'Friend',
  p_birthday_day => 3, p_birthday_month => 3)::text;
select public.create_invite((select val::uuid from t where key = 'sara'));
select public.create_invite((select val::uuid from t where key = 'sara'));
select is((select count(id)::int from public.invites
           where person_id = (select val::uuid from t where key = 'sara') and revoked_at is null),
  1, 'a new invite for the same person replaces their previous open one');
select lives_ok($$ select public.revoke_invite((select id from public.invites
  where person_id = (select val::uuid from t where key = 'sara') and revoked_at is null)) $$,
  'A cancels Sara''s invite (so the limit test below counts from one)');
select throws_ok($$ select public.create_invite('00000000-0000-0000-0000-000000000000') $$,
  'P0002', 'person_not_found', 'an invite can only be tied to one of your own people');
-- One active invite so far (the others are used, expired or revoked): 19 more makes 20.
select lives_ok($$ select public.create_invite() from generate_series(1, 19) $$, 'A can have 20 active invites');
select throws_ok($$ select public.create_invite() $$, '22023', 'too_many_invites', 'the 21st active invite is refused');

-- C, the stranger -------------------------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000c601');
select is((select count(*)::int from public.connections) + (select count(id)::int from public.invites), 0,
  'a stranger sees no connections or invites');
select throws_ok(format($$ select public.remove_connection(%L) $$,
  (select id from public.connections where user_low = '00000000-0000-0000-0000-00000000a601')),
  'P0002', 'connection_not_found', 'a stranger can''t remove A and B''s connection');
select throws_ok($$ select public.link_person(null, '00000000-0000-0000-0000-00000000a601') $$,
  'P0002', 'person_not_found', 'linking needs one of your own people');

-- B removes the connection: links cleared on both sides ---------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000b601');
select lives_ok($$ select public.remove_connection((select connection_id from public.my_connections())) $$,
  'B removes the connection');
reset role;
select is(
  (select count(*)::int from public.connections where '00000000-0000-0000-0000-00000000b601' in (user_low, user_high))
  + (select count(*)::int from public.people where linked_profile_id in
      ('00000000-0000-0000-0000-00000000a601', '00000000-0000-0000-0000-00000000b601')),
  0, 'the connection is gone and linked_profile_id is cleared on both sides');

select * from finish();
rollback;
