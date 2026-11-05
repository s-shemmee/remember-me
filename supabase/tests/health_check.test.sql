-- pgTAP: public.health_check() (runs in CI: `supabase test db`).
begin;
select plan(5);

select has_function('public', 'health_check', array[]::text[], 'health_check() exists');
select is(
  (select prosecdef from pg_proc where oid = 'public.health_check()'::regprocedure),
  false,
  'runs as the caller (security invoker), not as its owner'
);

-- Anonymous visitors (the health route has no session) can call it.
set local role anon;
select is(public.health_check(), true, 'anon can call it and gets true');
reset role;

-- Signed-in users can too.
set local role authenticated;
select is(public.health_check(), true, 'authenticated can call it and gets true');
reset role;

-- No other role gets it through PUBLIC.
select ok(
  not exists (
    select 1
    from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'health_check'
      and grantee = 'PUBLIC'
  ),
  'execute is not granted to PUBLIC'
);

select * from finish();
rollback;
