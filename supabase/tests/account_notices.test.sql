-- pgTAP: "You already have an account" notices (`pnpm db:test`).
-- Only the server (service_role, via the account-notice Edge Function) can
-- claim one; the log keeps an HMAC of the address, never the address.
begin;
select plan(15);

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000ac01', 'confirmed.notice@test.local', '{"first_name": "Amal"}', now()),
  ('00000000-0000-0000-0000-00000000ac02', 'unconfirmed.notice@test.local', '{"first_name": "Badr"}', null);

create function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;
-- Any 32-byte value stands in for the HMAC here.
create function pg_temp.h(t text) returns bytea language sql as $$ select sha256(convert_to(t, 'utf8')) $$;
grant execute on function pg_temp.h(text) to authenticated, anon, service_role;

-- Nobody but the server --------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000ac01');
select throws_ok($$ select public.claim_account_notice('confirmed.notice@test.local', pg_temp.h('a')) $$,
  '42501', null, 'a signed-in user can''t claim a notice (direct calls are refused)');
select throws_ok($$ select * from public.account_notices $$, '42501', null, '...or read the log');
select throws_ok($$ insert into public.account_notices (email_hash) values (pg_temp.h('x')) $$,
  '42501', null, '...or write to it');
reset role;
set local role anon;
select throws_ok($$ select public.claim_account_notice('confirmed.notice@test.local', pg_temp.h('a')) $$,
  '42501', null, 'neither can a visitor');
reset role;

-- The server: only confirmed accounts, once an hour ---------------------------------------------
set local role service_role;
select is(public.claim_account_notice('nobody@test.local', pg_temp.h('nobody')), false,
  'no account: nothing is sent');
select is(public.claim_account_notice('unconfirmed.notice@test.local', pg_temp.h('unconfirmed')), false,
  'an unconfirmed account: nothing (Supabase resends the confirmation itself)');
select is(public.claim_account_notice('  Confirmed.Notice@TEST.local ', pg_temp.h('confirmed')), true,
  'a confirmed account (any case, spaces trimmed): send');
select is(public.claim_account_notice('confirmed.notice@test.local', pg_temp.h('confirmed')), false,
  'the same address again within the hour: not sent');
select throws_ok($$ select public.claim_account_notice('confirmed.notice@test.local', '\x00'::bytea) $$,
  '22023', 'invalid_hash', 'the hash must be 32 bytes');
reset role;

-- Never the email in plain text ------------------------------------------------------------------
select is((select count(*)::int from information_schema.columns
           where table_schema = 'public' and table_name = 'account_notices'), 3,
  'the log has three columns: id, email_hash, created_at');
select is((select count(*)::int from public.account_notices
           where position(convert_to('confirmed.notice', 'utf8') in email_hash) > 0), 0,
  'the address isn''t inside the stored hash');

-- An hour later it can go again; the daily cap stops bulk sending ---------------------------------
update public.account_notices set created_at = now() - interval '61 minutes';
set local role service_role;
select is(public.claim_account_notice('confirmed.notice@test.local', pg_temp.h('confirmed')), true,
  'an hour later: sent again');
reset role;
insert into public.account_notices (email_hash)
  select pg_temp.h('bulk' || g) from generate_series(1, 200) g;
update public.account_notices set created_at = now() - interval '2 hours'
  where email_hash = pg_temp.h('confirmed');
set local role service_role;
select is(public.claim_account_notice('confirmed.notice@test.local', pg_temp.h('confirmed')), false,
  'at most 200 a day overall');
reset role;

-- The daily clean-up drops rows older than 30 days -------------------------------------------------
update public.account_notices set created_at = now() - interval '31 days' where email_hash = pg_temp.h('bulk1');
select is((public.run_cleanup() ->> 'account_notices')::int, 1, 'run_cleanup() deletes notices older than 30 days');
select is((select count(*)::int from public.account_notices where email_hash = pg_temp.h('bulk1')), 0,
  'that row is gone');

select * from finish();
rollback;
