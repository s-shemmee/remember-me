-- M4 part 2: push notifications.
--
-- * push_subscriptions: one row per device (endpoint + keys), owner only.
--   Endpoints must be a known push service (never an arbitrary URL our
--   server would POST to). Saved through save_push_subscription(), which
--   moves an endpoint to whoever subscribes on that device now.
-- * notification_log gets a `push` channel next to `email`: claims, keys,
--   reclaim and dedupe are per channel, so each is sent exactly once.
-- * reminder_candidates() now includes push-only users and says which
--   channels each user has; reminder_push_devices() lists their devices.
-- * allow_test(profile, channel): 3 tests an hour per channel (replaces
--   allow_test_email).
-- Subscriptions go with the profile (on delete cascade): deleting the
-- account removes them; logging out and turning push off do too (app).
--
-- Rollback (in this order):
--   drop function if exists public.allow_test(uuid, text), public.reminder_push_devices(),
--     public.save_push_subscription(text, text, text, text), public.is_push_endpoint(text);
--   drop table if exists public.push_subscriptions;
--   then recreate reminder_candidates(), reminder_log_keys(), claim_reminders(),
--   reclaim_stuck_reminders() and allow_test_email() from 20261111170409_email_reminders.sql.

-- Push services --------------------------------------------------------------------------------

-- Google (Chrome, Android, Edge on Android, Opera, Samsung), Mozilla,
-- Apple (Safari, iOS 16.4+) and Microsoft (Edge on Windows).
create function public.is_push_endpoint(p_endpoint text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_endpoint is not null
     and char_length(p_endpoint) <= 1000
     and p_endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/[^[:space:]]+$';
$$;

-- push_subscriptions -------------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint text not null unique check (public.is_push_endpoint(endpoint)),
  -- The device's P-256 public key (65 bytes) and auth secret (16 bytes), base64url.
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{86,88}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{21,24}$'),
  device_label text not null default 'This device' check (char_length(btrim(device_label)) between 1 and 60),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

comment on table public.push_subscriptions is
  'Web push subscriptions, one per device. Owner only; written through save_push_subscription().';

create index push_subscriptions_profile_idx on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;
create policy "Push subscriptions: read own"
  on public.push_subscriptions for select to authenticated
  using ((select auth.uid()) = profile_id);
create policy "Push subscriptions: remove own"
  on public.push_subscriptions for delete to authenticated
  using ((select auth.uid()) = profile_id);

-- Read and remove your own; adding goes through the function below; no updates.
revoke all on public.push_subscriptions from anon, authenticated;
grant select (id, device_label, created_at, last_used_at, endpoint), delete
  on public.push_subscriptions to authenticated;

-- Saves this device's subscription for the signed-in user. Holding the
-- endpoint and keys means holding the device: if someone else was
-- subscribed on it (a shared browser), the row moves to you.
create function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_device_label text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_push_endpoint(p_endpoint) then
    raise exception 'invalid_endpoint' using errcode = '22023';
  end if;
  delete from public.push_subscriptions s where s.endpoint = p_endpoint and s.profile_id <> v_uid;
  insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth, device_label)
  values (v_uid, p_endpoint, p_p256dh, p_auth, left(coalesce(nullif(btrim(p_device_label), ''), 'This device'), 60))
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, device_label = excluded.device_label
  returning id into v_id;
  update public.reminder_settings set push = true, updated_at = now() where profile_id = v_uid;
  return v_id;
end;
$$;
revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- notification_log: per channel ------------------------------------------------------------------

drop function public.reminder_candidates();
create function public.reminder_candidates()
returns table (
  profile_id uuid,
  email text,
  first_name text,
  timezone text,
  offsets integer[],
  send_time text,
  email_on boolean,
  push_on boolean,
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
         rs.email and u.email is not null and u.email_confirmed_at is not null,
         rs.push and exists (select 1 from public.push_subscriptions s where s.profile_id = pr.id),
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
  where rs.remind_my_people
    and cardinality(rs.offsets_days) > 0
    and pr.onboarded_at is not null
    and u.deleted_at is null
    and (
      (rs.email and u.email is not null and u.email_confirmed_at is not null)
      or (rs.push and exists (select 1 from public.push_subscriptions s where s.profile_id = pr.id))
    );
$$;

-- Devices of users with push on (endpoint and keys: server only).
create function public.reminder_push_devices()
returns table (id uuid, profile_id uuid, endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.profile_id, s.endpoint, s.p256dh, s.auth
  from public.push_subscriptions s
  join public.reminder_settings rs on rs.profile_id = s.profile_id and rs.push;
$$;

drop function public.reminder_log_keys();
create function public.reminder_log_keys()
returns table (profile_id uuid, channel text, key text)
language sql
stable
security definer
set search_path = ''
as $$
  select l.profile_id, l.channel,
         l.occasion_id || '|' || l.offset_days || '|' || to_char(l.occurs_on, 'YYYY-MM-DD')
  from public.notification_log l
  where l.kind = 'reminder' and l.occurs_on >= current_date - 2;
$$;

drop function public.claim_reminders(uuid, uuid, text[]);
create function public.claim_reminders(p_profile_id uuid, p_batch_id uuid, p_keys text[], p_channel text)
returns setof text
language sql
security definer
set search_path = ''
as $$
  insert into public.notification_log (profile_id, kind, occasion_id, offset_days, occurs_on, channel, batch_id)
  select p_profile_id, 'reminder', o.id, k.offset_days, k.occurs_on, p_channel, p_batch_id
  from (
    select split_part(x, '|', 1)::uuid as occasion_id,
           split_part(x, '|', 2)::smallint as offset_days,
           split_part(x, '|', 3)::date as occurs_on
    from unnest(p_keys) as x
  ) k
  join public.occasions o on o.id = k.occasion_id
  join public.people p on p.id = o.person_id and p.owner_id = p_profile_id
  on conflict (profile_id, occasion_id, offset_days, occurs_on, channel) where kind = 'reminder'
  do nothing
  returning occasion_id || '|' || offset_days || '|' || to_char(occurs_on, 'YYYY-MM-DD');
$$;

drop function public.reclaim_stuck_reminders();
create function public.reclaim_stuck_reminders()
returns table (batch_id uuid, profile_id uuid, channel text, keys text[])
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
    returning l.batch_id, l.profile_id, l.channel,
      l.occasion_id || '|' || l.offset_days || '|' || to_char(l.occurs_on, 'YYYY-MM-DD') as key
  )
  select r.batch_id, r.profile_id, r.channel, array_agg(r.key order by r.key)
  from retry r
  group by r.batch_id, r.profile_id, r.channel;
$$;

-- Test email / test notification: 3 an hour per person per channel.
drop function public.allow_test_email(uuid);
create function public.allow_test(p_profile_id uuid, p_channel text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_channel not in ('email', 'push') then
    raise exception 'invalid_channel' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('test:' || p_channel || ':' || p_profile_id::text, 0));
  if (select count(*) from public.notification_log l
      where l.profile_id = p_profile_id and l.kind = 'test' and l.channel = p_channel
        and l.created_at > now() - interval '1 hour') >= 3 then
    return false;
  end if;
  insert into public.notification_log (profile_id, kind, channel, status, sent_at)
  values (p_profile_id, 'test', p_channel, 'sent', now());
  return true;
end;
$$;

revoke execute on function public.reminder_candidates(), public.reminder_push_devices(),
  public.reminder_log_keys(), public.claim_reminders(uuid, uuid, text[], text),
  public.reclaim_stuck_reminders(), public.allow_test(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reminder_candidates(), public.reminder_push_devices(),
  public.reminder_log_keys(), public.claim_reminders(uuid, uuid, text[], text),
  public.reclaim_stuck_reminders(), public.allow_test(uuid, text)
  to service_role;
