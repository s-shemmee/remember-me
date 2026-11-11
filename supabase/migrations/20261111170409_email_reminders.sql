-- M4 part 1: email reminders and the daily clean-up.
--
-- * notification_log: one row per reminder per user, day, offset, occurrence
--   (its year) and channel, unique, so a reminder is never sent twice. Rows
--   are claimed before sending; a claim still open after 10 minutes is
--   retried with the same batch id (the Resend idempotency key).
-- * Server-only functions for the send-reminders Edge Function (service
--   role): candidates, logged keys, claim / reclaim / finish / release, and
--   the test-email limit.
-- * run_cleanup(): people archived > 30 days, final cancelled reservations,
--   wishes removed > 30 days (returns their image paths for Storage),
--   invites past expiry, and log rows older than 400 days.
-- * pg_cron: send-reminders every 15 minutes, daily-cleanup at 02:30 UTC,
--   through pg_net. The URL and CRON_SECRET come from Supabase Vault
--   (`project_url`, `cron_secret`); without them the jobs do nothing.
--
-- Rollback (in this order):
--   select cron.unschedule('send-reminders'); select cron.unschedule('daily-cleanup');
--   drop function if exists public.call_edge_function(text), public.run_cleanup(),
--     public.allow_test_email(uuid), public.release_reminders(uuid),
--     public.finish_reminders(uuid, text), public.reclaim_stuck_reminders(),
--     public.claim_reminders(uuid, uuid, text[]), public.reminder_log_keys(),
--     public.reminder_candidates();
--   drop table if exists public.notification_log;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- notification_log --------------------------------------------------------------------------

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'reminder' check (kind in ('reminder', 'test')),
  occasion_id uuid references public.occasions (id) on delete cascade,
  offset_days smallint check (offset_days in (14, 7, 3, 1, 0)),
  -- The occurrence the reminder is about (so it carries the year).
  occurs_on date,
  channel text not null default 'email' check (channel in ('email', 'push')),
  status text not null default 'claimed' check (status in ('claimed', 'sent', 'failed')),
  -- One email = one batch; also the provider's idempotency key.
  batch_id uuid,
  attempts smallint not null default 1,
  provider_id text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint notification_log_reminder_fields check (
    kind <> 'reminder'
    or (occasion_id is not null and offset_days is not null and occurs_on is not null and batch_id is not null)
  )
);

comment on table public.notification_log is
  'Every reminder sent (or being sent). Unique per user, day, offset, occurrence and channel: never twice.';

create unique index notification_log_once
  on public.notification_log (profile_id, occasion_id, offset_days, occurs_on, channel)
  where kind = 'reminder';
create index notification_log_claimed_idx on public.notification_log (claimed_at) where status = 'claimed';
create index notification_log_batch_idx on public.notification_log (batch_id);
create index notification_log_occasion_idx on public.notification_log (occasion_id);
create index notification_log_profile_created_idx on public.notification_log (profile_id, created_at desc);

alter table public.notification_log enable row level security;
create policy "Notification log: read own"
  on public.notification_log for select to authenticated
  using ((select auth.uid()) = profile_id);

-- Users read their own rows; only the server (service role) writes.
revoke all on public.notification_log from anon, authenticated;
grant select on public.notification_log to authenticated;

-- What the reminder job reads ------------------------------------------------------------------

-- One row per (user with email reminders on, occasion of a person who isn't
-- archived). `wishlist_friend_id`: the person's connected profile when it
-- has at least one free wish on its shared list (never anything about the
-- reader's own wishes).
create function public.reminder_candidates()
returns table (
  profile_id uuid,
  email text,
  first_name text,
  timezone text,
  offsets integer[],
  send_time text,
  occasion_id uuid,
  person_id uuid,
  person_name text,
  person_color text,
  kind text,
  title text,
  day smallint,
  month smallint,
  year smallint,
  recurring boolean,
  little_thing text,
  wishlist_friend_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.id, u.email::text, coalesce(pr.first_name, ''), pr.timezone, rs.offsets_days,
         to_char(rs.send_time, 'HH24:MI'),
         o.id, p.id, p.name, p.color, o.kind::text, o.title,
         o.day::smallint, o.month::smallint, o.year::smallint, o.recurring,
         nullif(btrim(p.little_things[1]), ''),
         case
           when p.linked_profile_id is not null
            and public.are_connected(pr.id, p.linked_profile_id)
            and exists (
              select 1 from public.wishes w
              left join public.reservations r on r.wish_id = w.id and r.cancelled_at is null
              where w.owner_id = p.linked_profile_id and w.removed_at is null
                and public.wish_is_shared(w.wishlist_id) and r.wish_id is null)
           then p.linked_profile_id
         end
  from public.reminder_settings rs
  join public.profiles pr on pr.id = rs.profile_id
  join auth.users u on u.id = pr.id
  join public.people p on p.owner_id = pr.id and p.archived_at is null
  join public.occasions o on o.person_id = p.id
  where rs.email
    and rs.remind_my_people
    and cardinality(rs.offsets_days) > 0
    and pr.onboarded_at is not null
    and u.email is not null
    and u.email_confirmed_at is not null
    and u.deleted_at is null;
$$;

-- Keys already logged for recent and upcoming occurrences: `occasion|offset|date`.
create function public.reminder_log_keys()
returns table (profile_id uuid, key text)
language sql
stable
security definer
set search_path = ''
as $$
  select l.profile_id, l.occasion_id || '|' || l.offset_days || '|' || to_char(l.occurs_on, 'YYYY-MM-DD')
  from public.notification_log l
  where l.kind = 'reminder' and l.channel = 'email' and l.occurs_on >= current_date - 2;
$$;

-- Claims reminders before sending. Returns the keys this call claimed;
-- anything already logged (another run, an earlier send) is skipped.
create function public.claim_reminders(p_profile_id uuid, p_batch_id uuid, p_keys text[])
returns setof text
language sql
security definer
set search_path = ''
as $$
  insert into public.notification_log (profile_id, kind, occasion_id, offset_days, occurs_on, channel, batch_id)
  select p_profile_id, 'reminder', o.id, k.offset_days, k.occurs_on, 'email', p_batch_id
  from (
    select split_part(x, '|', 1)::uuid as occasion_id,
           split_part(x, '|', 2)::smallint as offset_days,
           split_part(x, '|', 3)::date as occurs_on
    from unnest(p_keys) as x
  ) k
  -- Only the user's own occasions.
  join public.occasions o on o.id = k.occasion_id
  join public.people p on p.id = o.person_id and p.owner_id = p_profile_id
  on conflict (profile_id, occasion_id, offset_days, occurs_on, channel) where kind = 'reminder'
  do nothing
  returning occasion_id || '|' || offset_days || '|' || to_char(occurs_on, 'YYYY-MM-DD');
$$;

-- Claims still open after 10 minutes (a crash or a failed send): re-stamped
-- so no other run takes them, and returned by batch so they're sent again
-- with the same idempotency key. After 5 attempts they're marked failed.
create function public.reclaim_stuck_reminders()
returns table (batch_id uuid, profile_id uuid, keys text[])
language sql
security definer
set search_path = ''
as $$
  with gave_up as (
    update public.notification_log l set status = 'failed'
    where l.kind = 'reminder' and l.status = 'claimed'
      and l.claimed_at < now() - interval '10 minutes' and l.attempts >= 5
    returning l.id
  ),
  retry as (
    update public.notification_log l set claimed_at = now(), attempts = l.attempts + 1
    where l.kind = 'reminder' and l.status = 'claimed'
      and l.claimed_at < now() - interval '10 minutes' and l.attempts < 5
    returning l.batch_id, l.profile_id,
      l.occasion_id || '|' || l.offset_days || '|' || to_char(l.occurs_on, 'YYYY-MM-DD') as key
  )
  select r.batch_id, r.profile_id, array_agg(r.key order by r.key)
  from retry r
  group by r.batch_id, r.profile_id;
$$;

create function public.finish_reminders(p_batch_id uuid, p_provider_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notification_log
    set status = 'sent', sent_at = now(), provider_id = left(p_provider_id, 200)
  where batch_id = p_batch_id and status = 'claimed';
$$;

-- Drops a batch's open claims (nothing left to send).
create function public.release_reminders(p_batch_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.notification_log where batch_id = p_batch_id and status = 'claimed';
$$;

-- "Send me a test email": at most 3 an hour per person. Logs and allows, or refuses.
create function public.allow_test_email(p_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- One at a time per person, so two clicks can't both pass the count.
  perform pg_advisory_xact_lock(hashtextextended('test-email:' || p_profile_id::text, 0));
  if (select count(*) from public.notification_log l
      where l.profile_id = p_profile_id and l.kind = 'test'
        and l.created_at > now() - interval '1 hour') >= 3 then
    return false;
  end if;
  insert into public.notification_log (profile_id, kind, channel, status, sent_at)
  values (p_profile_id, 'test', 'email', 'sent', now());
  return true;
end;
$$;

-- Daily clean-up ---------------------------------------------------------------------------------

create function public.run_cleanup()
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

  return jsonb_build_object(
    'people', v_people, 'reservations', v_reservations, 'wishes', v_wishes,
    'invites', v_invites, 'notification_log', v_log, 'image_paths', to_jsonb(v_paths));
end;
$$;

-- All of the above: server only.
revoke execute on function public.reminder_candidates(), public.reminder_log_keys(),
  public.claim_reminders(uuid, uuid, text[]), public.reclaim_stuck_reminders(),
  public.finish_reminders(uuid, text), public.release_reminders(uuid),
  public.allow_test_email(uuid), public.run_cleanup()
  from public, anon, authenticated;
grant execute on function public.reminder_candidates(), public.reminder_log_keys(),
  public.claim_reminders(uuid, uuid, text[]), public.reclaim_stuck_reminders(),
  public.finish_reminders(uuid, text), public.release_reminders(uuid),
  public.allow_test_email(uuid), public.run_cleanup()
  to service_role;

-- pg_cron → Edge Functions ---------------------------------------------------------------------

-- Calls one of our scheduled functions with CRON_SECRET. Both values live in
-- Vault (set once per project; docs/quality.md). Without them it does nothing.
create function public.call_edge_function(p_name text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if p_name not in ('send-reminders', 'daily-cleanup') then
    raise exception 'unknown_function' using errcode = '22023';
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    raise log 'call_edge_function(%): project_url or cron_secret missing in Vault', p_name;
    return null;
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/' || p_name,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;
revoke execute on function public.call_edge_function(text) from public, anon, authenticated, service_role;

select cron.schedule('send-reminders', '*/15 * * * *', $$select public.call_edge_function('send-reminders')$$);
select cron.schedule('daily-cleanup', '30 2 * * *', $$select public.call_edge_function('daily-cleanup')$$);
