-- The notification inbox behind the header bell (docs/roadmap/01-bell-inbox.md).
--
-- * notifications: one row per recipient. Three kinds, created only on the
--   server where the event already happens:
--     reminder         a reminder about one of your people was sent (email or push)
--     invite_accepted  someone accepted your invite
--     wishlist_update  a connection added wishes to their shared "My birthday"
--                      list: one row per person per day, its count goes up
--   Owners never get any signal about reservations on their own lists: no
--   kind for it, and nothing here reads or writes reservations.
-- * group_key + day keep it to one row per thing (a reminder sent by email
--   and push is one row; a day's new wishes from one person are one row).
-- * RLS: you read your own rows and may only set read_at. No inserts or
--   deletes from clients. my_inbox() adds the names (name_for: your name for
--   them) and, for reminders, the person and plan progress.
-- * reminder_settings.inbox_wishlist_updates (on by default): off, no
--   wishlist_update rows are made for you.
-- * Rows go after 30 days (run_cleanup).
--
-- Rollback:
--   drop trigger if exists notifications_from_reminder on public.notification_log;
--   drop trigger if exists notifications_from_invite on public.invites;
--   drop trigger if exists notifications_from_wish on public.wishes;
--   drop function if exists public.notify_reminder_sent(), public.notify_invite_accepted(),
--     public.notify_wishes_added(), public.my_inbox(integer);
--   drop table if exists public.notifications; drop type if exists public.inbox_kind;
--   alter table public.reminder_settings drop column if exists inbox_wishlist_updates;
--   then re-run run_cleanup() from 20261118183234_account_notices.sql.

create type public.inbox_kind as enum ('reminder', 'invite_accepted', 'wishlist_update');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.inbox_kind not null,
  -- Who did it (invite accepted, wishlist update); null for reminders.
  actor_id uuid references public.profiles (id) on delete cascade,
  -- What it's about (the occasion of a reminder).
  subject_id uuid references public.occasions (id) on delete cascade,
  group_key text not null check (char_length(group_key) between 1 and 200),
  day date not null default (now() at time zone 'utc')::date,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 512),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, group_key, day)
);

create index notifications_user_updated on public.notifications (user_id, updated_at desc);

alter table public.notifications enable row level security;

create policy "Notifications: read your own"
  on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Notifications: mark your own read"
  on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- The toggle (Settings → Notifications), on by default.
alter table public.reminder_settings
  add column inbox_wishlist_updates boolean not null default true;
comment on column public.reminder_settings.inbox_wishlist_updates is
  'In-app inbox: tell me when my people add wishes to their shared lists.';
grant insert (inbox_wishlist_updates), update (inbox_wishlist_updates)
  on public.reminder_settings to authenticated;

-- Reminder sent (email or push) about one of your people: one row per occurrence and offset.
create function public.notify_reminder_sent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'reminder' and new.status = 'sent' and new.occasion_id is not null
     and new.occurs_on is not null then
    insert into public.notifications (user_id, kind, subject_id, group_key, payload)
    values (
      new.profile_id, 'reminder', new.occasion_id,
      'reminder:' || new.occasion_id || ':' || new.occurs_on || ':' || coalesce(new.offset_days, 0),
      jsonb_build_object('occurs_on', new.occurs_on, 'offset_days', new.offset_days))
    on conflict (user_id, group_key, day) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.notify_reminder_sent() from public, anon, authenticated;

create trigger notifications_from_reminder
  after insert or update of status on public.notification_log
  for each row execute function public.notify_reminder_sent();

-- Invite accepted: the inviter hears who.
create function public.notify_invite_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.used_at is null and new.used_at is not null and new.used_by is not null then
    insert into public.notifications (user_id, kind, actor_id, group_key)
    values (new.inviter_id, 'invite_accepted', new.used_by, 'invite:' || new.used_by)
    on conflict (user_id, group_key, day) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.notify_invite_accepted() from public, anon, authenticated;

create trigger notifications_from_invite
  after update of used_at on public.invites
  for each row execute function public.notify_invite_accepted();

-- Wishes added to a shared list: each connection who wants these hears it,
-- one row per person per day with a count. Reservations never come in here.
create function public.notify_wishes_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.wish_is_shared(new.wishlist_id) then
    return new;
  end if;
  insert into public.notifications (user_id, kind, actor_id, group_key, payload)
  select friend, 'wishlist_update', new.owner_id, 'wishes:' || new.owner_id,
         jsonb_build_object('count', 1)
    from (
      select case when c.user_low = new.owner_id then c.user_high else c.user_low end as friend
        from public.connections c
       where new.owner_id in (c.user_low, c.user_high)
    ) f
    left join public.reminder_settings rs on rs.profile_id = f.friend
   where coalesce(rs.inbox_wishlist_updates, true)
  on conflict (user_id, group_key, day) do update
    set payload = jsonb_build_object(
          'count', coalesce((public.notifications.payload ->> 'count')::int, 0) + 1),
        read_at = null,
        updated_at = now();
  return new;
end;
$$;
revoke execute on function public.notify_wishes_added() from public, anon, authenticated;

create trigger notifications_from_wish
  after insert on public.wishes
  for each row execute function public.notify_wishes_added();

-- Your inbox, last 30 days, newest first, with names (yours for them) and,
-- for reminders, the person and that day's plan progress.
create function public.my_inbox(p_limit integer default 50)
returns table (
  id uuid,
  kind text,
  read boolean,
  at timestamptz,
  actor_id uuid,
  actor_name text,
  person_id uuid,
  person_name text,
  occasion_kind text,
  birth_year smallint,
  occurs_on date,
  offset_days smallint,
  wish_count integer,
  plan_done integer,
  plan_total integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.kind::text, n.read_at is not null, n.updated_at,
         n.actor_id,
         case when n.actor_id is not null then public.name_for(n.user_id, n.actor_id) end,
         p.id, p.name, o.kind::text,
         case when o.kind = 'birthday' and not p.in_memory then o.year end,
         (n.payload ->> 'occurs_on')::date,
         (n.payload ->> 'offset_days')::smallint,
         (n.payload ->> 'count')::int,
         (select count(*)::int from public.plan_steps s join public.plans pl on pl.id = s.plan_id
           where pl.owner_id = n.user_id and pl.occasion_id = o.id
             and pl.occurs_on = (n.payload ->> 'occurs_on')::date and s.done_at is not null),
         (select count(*)::int from public.plan_steps s join public.plans pl on pl.id = s.plan_id
           where pl.owner_id = n.user_id and pl.occasion_id = o.id
             and pl.occurs_on = (n.payload ->> 'occurs_on')::date)
    from public.notifications n
    left join public.occasions o on o.id = n.subject_id
    left join public.people p on p.id = o.person_id and p.owner_id = n.user_id
   where n.user_id = (select auth.uid())
     and n.updated_at > now() - interval '30 days'
     -- A reminder about someone since removed has nothing to show.
     and (n.kind <> 'reminder' or (p.id is not null and p.archived_at is null))
   order by n.updated_at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;
revoke execute on function public.my_inbox(integer) from public, anon;
grant execute on function public.my_inbox(integer) to authenticated;

-- Cleanup: the same as before, plus inbox rows after 30 days.
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
  v_inbox int;
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

  -- The inbox shows the last 30 days.
  delete from public.notifications where updated_at < now() - interval '30 days';
  get diagnostics v_inbox = row_count;

  return jsonb_build_object(
    'people', v_people, 'reservations', v_reservations, 'wishes', v_wishes,
    'invites', v_invites, 'notification_log', v_log, 'account_notices', v_notices,
    'notifications', v_inbox, 'image_paths', to_jsonb(v_paths));
end;
$$;
