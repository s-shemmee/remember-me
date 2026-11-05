-- Health check for GET /api/health: proves the API can reach Postgres.
-- Not a table and reads no data. Callable by anyone (anon) on purpose,
-- because the health route runs without a session; it returns only `true`.
--
-- Roll back: drop function if exists public.health_check();

create or replace function public.health_check()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select true;
$$;

comment on function public.health_check() is
  'Liveness probe for /api/health. Returns true when Postgres answers. Reads no data.';

-- Supabase grants execute on new public functions to every role by default.
-- Make the access explicit instead.
revoke execute on function public.health_check() from public;
grant execute on function public.health_check() to anon, authenticated;
