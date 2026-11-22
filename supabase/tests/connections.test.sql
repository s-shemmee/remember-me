-- pgTAP: invites and connections (`pnpm db:test`).
-- A (Amal) invites; B (Badr) accepts; C (Chama) is the stranger.
begin;
select plan(51);

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
insert into t select 'p_exp', public.save_person(p_name => 'Exp', p_relation_kind => 'Friend',
  p_birthday_day => 4, p_birthday_month => 4)::text;
insert into t select 'p_rev', public.save_person(p_name => 'Rev', p_relation_kind => 'Friend',
  p_birthday_day => 5, p_birthday_month => 5)::text;
insert into t select 'tok_person', public.create_invite((select val::uuid from t where key = 'khalid'));
-- Without a person: A's personal link.
insert into t select 'tok_general', public.create_invite();
insert into t select 'tok_expired', public.create_invite((select val::uuid from t where key = 'p_exp'));
insert into t select 'tok_revoked', public.create_invite((select val::uuid from t where key = 'p_rev'));

select matches((select val from t where key = 'tok_general'), '^[0-9a-f]{64}$', 'the token is 32 random bytes (64 hex characters)');
select is((select count(id)::int from public.invites), 4, 'A sees her four invites');
select throws_ok($$ select token_hash from public.invites $$, '42501', null, 'the token hash isn''t readable through the API');
select throws_ok($$ select token from public.invites $$, '42501', null, 'the kept token isn''t readable through the API');
select is(public.create_invite(), (select val from t where key = 'tok_general'),
  'the personal link is made once: asking again gives the same link');
reset role;
select is(
  (select count(*)::int from public.invites
   where token_hash = extensions.digest((select val from t where key = 'tok_general'), 'sha256')),
  1, 'only the token''s SHA-256 is stored');
select is(
  (select count(*)::int from public.invites i, t
   where position(convert_to(t.val, 'UTF8') in i.token_hash) > 0), 0, 'the hash column holds no trace of the token');
-- Age one invite past its 7 days.
update public.invites set expires_at = now() - interval '1 minute'
  where token_hash = extensions.digest((select val from t where key = 'tok_expired'), 'sha256');
select is(
  (select round(extract(epoch from expires_at - created_at) / 86400)::int from public.invites
   where token_hash = extensions.digest((select val from t where key = 'tok_person'), 'sha256')),
  7, 'a person''s invite expires after 7 days');
select is(
  (select kind || ' ' || expires_at::text from public.invites
   where token_hash = extensions.digest((select val from t where key = 'tok_general'), 'sha256')),
  'personal infinity', 'the personal link has no expiry');

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
insert into t select 'tok_sara', public.create_invite((select val::uuid from t where key = 'sara'));
select is(public.create_invite((select val::uuid from t where key = 'sara')), (select val from t where key = 'tok_sara'),
  'asking again for the same person returns their open invite');
select is((select count(id)::int from public.invites
           where person_id = (select val::uuid from t where key = 'sara') and revoked_at is null),
  1, 'still one open invite for Sara');
select lives_ok($$ select public.revoke_invite((select id from public.invites
  where person_id = (select val::uuid from t where key = 'sara') and revoked_at is null)) $$,
  'A cancels Sara''s invite (so the limit test below counts from one)');
select throws_ok($$ select public.create_invite('00000000-0000-0000-0000-000000000000') $$,
  'P0002', 'person_not_found', 'an invite can only be tied to one of your own people');
-- No open person invites now (used, expired or revoked); the personal link doesn't count.
select lives_ok($$ select public.create_invite(public.save_person(p_name => 'P' || g, p_relation_kind => 'Friend',
  p_birthday_day => 1, p_birthday_month => 1)) from generate_series(1, 20) g $$, 'A can have 20 open invites');
select throws_ok($$ select public.create_invite(public.save_person(p_name => 'P21', p_relation_kind => 'Friend',
  p_birthday_day => 1, p_birthday_month => 1)) $$, '22023', 'too_many_invites', 'the 21st open invite is refused');

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

-- The personal link: many uses, reset, limits -------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000c601');
select lives_ok($$ select public.accept_invite((select val from t where key = 'tok_general')) $$,
  'C connects through A''s personal link');
select is((select status from public.invite_preview((select val from t where key = 'tok_general'))), 'connected',
  'for C it now says connected');
select pg_temp.act_as('00000000-0000-0000-0000-00000000b601');
select is((select status from public.invite_preview((select val from t where key = 'tok_general'))), 'valid',
  'for B (no longer connected) the same link still works: a personal link isn''t used up');
select pg_temp.act_as('00000000-0000-0000-0000-00000000a601');
select is((select use_count || ' ' || (used_at is null)::text from public.invites where kind = 'personal'), '1 true',
  'A sees one use, and the link is not marked used');
select is((select count(*)::int from public.notifications
           where kind = 'invite_accepted' and actor_id = '00000000-0000-0000-0000-00000000c601'), 1,
  'A hears that C connected');
insert into t select 'tok_new', public.reset_invite_link();
select isnt((select val from t where key = 'tok_new'), (select val from t where key = 'tok_general'),
  'Reset link makes a new link');
select is(public.create_invite(), (select val from t where key = 'tok_new'), 'the new one is the personal link now');
reset role;
select ok((select expires_at <= now() and revoked_at is not null from public.invites
           where token_hash = extensions.digest((select val from t where key = 'tok_general'), 'sha256')),
  'the old link is revoked and expired, so the daily clean-up deletes it');
select pg_temp.act_as('00000000-0000-0000-0000-00000000b601');
select throws_ok($$ select public.accept_invite((select val from t where key = 'tok_general')) $$,
  '22023', 'invite_revoked', 'the old personal link no longer works');
select pg_temp.act_as('00000000-0000-0000-0000-00000000a601');
-- Two personal links made today; three more resets make five, the sixth is refused.
select lives_ok($$ select public.reset_invite_link() from generate_series(1, 3) $$, 'a few resets are fine');
select throws_ok($$ select public.reset_invite_link() $$, '22023', 'too_many_resets', 'at most 5 personal links a day');
select is((select count(*)::int from public.invites where kind = 'personal' and revoked_at is null), 1,
  'always exactly one live personal link');
-- 30 invites made a day, whatever the kind (made in bulk here, then closed).
reset role;
insert into public.invites (inviter_id, token_hash)
  select '00000000-0000-0000-0000-00000000a601', extensions.digest('bulk' || g, 'sha256')
  from generate_series(1, 10) g;
update public.invites set revoked_at = now() where inviter_id = '00000000-0000-0000-0000-00000000a601'
  and kind = 'once' and revoked_at is null;
select pg_temp.act_as('00000000-0000-0000-0000-00000000a601');
select throws_ok($$ select public.create_invite(public.save_person(p_name => 'P31', p_relation_kind => 'Friend',
  p_birthday_day => 1, p_birthday_month => 1)) $$, '22023', 'too_many_invites_today', 'at most 30 invites made a day');

select * from finish();
rollback;
