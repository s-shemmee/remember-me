-- "You already have an account" emails.
--
-- Signing up (or changing your email) with an address that already has a
-- confirmed account shows the usual "Check your email" screen, and the
-- account-notice Edge Function emails that address instead: Log in, or Reset
-- password. These run server side only, so nothing reveals whether an email
-- is registered.
--
-- * account_notices: one row per email sent. Never the email itself: an
--   HMAC-SHA-256 of the lowercased address, keyed with EMAIL_HASH_SECRET
--   (a function secret), so the log can't be reversed by guessing addresses.
-- * claim_account_notice(email, hash): true when the address has a confirmed
--   account, no notice went to it in the last hour, and fewer than 200 went
--   out in the last day; records it. Server only (service_role).
-- * run_cleanup() also deletes notices older than 30 days.
--
-- Rollback:
--   recreate run_cleanup() from 20261111170409_email_reminders.sql;
--   drop function public.claim_account_notice(text, bytea);
--   drop table public.account_notices;

create table public.account_notices (
  id bigint generated always as identity primary key,
  email_hash bytea not null check (octet_length(email_hash) = 32),
  created_at timestamptz not null default now()
);

comment on table public.account_notices is
  'Account-exists emails sent: an HMAC of the address (never the address), for the hourly and daily limits. Server only.';
comment on column public.account_notices.email_hash is
  'HMAC-SHA-256(EMAIL_HASH_SECRET, lower(email)). Not reversible without the secret.';

create index account_notices_hash_idx on public.account_notices (email_hash, created_at desc);
create index account_notices_created_idx on public.account_notices (created_at);

-- Server only: RLS on and no policy for anon or authenticated, so nobody can
-- read or write it through the API; the function below runs as its owner.
alter table public.account_notices enable row level security;
revoke all on public.account_notices from public, anon, authenticated;

create function public.claim_account_notice(p_email text, p_hash bytea)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_hash is null or octet_length(p_hash) <> 32 then
    raise exception 'invalid_hash' using errcode = '22023';
  end if;
  -- Only addresses with a confirmed, live account ever get one.
  if not exists (
    select 1 from auth.users u
    where lower(u.email) = lower(btrim(coalesce(p_email, '')))
      and u.email_confirmed_at is not null
      and u.deleted_at is null
  ) then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('account-notice', 0));
  -- One per address per hour.
  if exists (select 1 from public.account_notices n
             where n.email_hash = p_hash and n.created_at > now() - interval '1 hour') then
    return false;
  end if;
  -- At most 200 a day overall (a backstop against bulk abuse).
  if (select count(*) from public.account_notices n
      where n.created_at > now() - interval '1 day') >= 200 then
    return false;
  end if;
  insert into public.account_notices (email_hash) values (p_hash);
  return true;
end;
$$;
revoke execute on function public.claim_account_notice(text, bytea) from public, anon, authenticated;
grant execute on function public.claim_account_notice(text, bytea) to service_role;

-- Daily clean-up: also notices older than 30 days.
create or replace function public.run_cleanup()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_people int;
  v_reservations int;
  v_wishes int;
  v_invites int;
  v_log int;
  v_notices int;
  v_paths text[];
begin
  -- Removed people, for good, 30 days after Remove (their days and log rows go with them).
  delete from public.people where archived_at < now() - interval '30 days';
  get diagnostics v_people = row_count;

  -- Cancellations past their 10-minute restore window.
  delete from public.reservations where cancelled_at < now() - interval '10 minutes';
  get diagnostics v_reservations = row_count;

  -- Wishes removed 30 days ago; their photos are deleted by the caller (Storage API).
  with gone as (
    delete from public.wishes where removed_at < now() - interval '30 days' returning image_path
  )
  select count(*)::int, coalesce(array_agg(image_path) filter (where image_path is not null), '{}')
    into v_wishes, v_paths
  from gone;

  -- Invites a day past their expiry (used, revoked or never used: none can be used any more).
  delete from public.invites where expires_at < now() - interval '1 day';
  get diagnostics v_invites = row_count;

  -- The log only matters for recent occurrences.
  delete from public.notification_log where created_at < now() - interval '400 days';
  get diagnostics v_log = row_count;

  -- Account-exists notices only matter for the hourly and daily limits.
  delete from public.account_notices where created_at < now() - interval '30 days';
  get diagnostics v_notices = row_count;

  return jsonb_build_object(
    'people', v_people, 'reservations', v_reservations, 'wishes', v_wishes,
    'invites', v_invites, 'notification_log', v_log, 'account_notices', v_notices,
    'image_paths', to_jsonb(v_paths));
end;
$$;
