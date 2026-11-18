-- M5 part 2: Celebrate Me and birthday plans.
--
-- * plans + plan_steps: a short checklist for one year's occurrence of a day
--   (occasion_id + occurs_on), or for your own birthday (occasion_id null).
--   Private to the owner: no one else can read them, ever (owner-only RLS).
--   Next year's occurrence is a new key, so each year starts fresh; past
--   plans stay. Made only through start_plan(), which adds the suggested
--   steps (gentle ones for Remembrance days and "In memory" people).
-- * Reserving a friend's wish ticks "Gift" in your plan for that friend's
--   birthday (a trigger on reservations, server side). The wish owner can't
--   read plans, so nothing is revealed. Cancelling unticks it again, but only
--   if the reservation ticked it.
-- * future_notes: "A note to future me". Sealed once saved: readable only
--   from your birthday on (your timezone, checked by RLS); before that you
--   can only throw it away.
-- * reminder_settings.remind_my_day (off by default): 7 days before your
--   birthday and on the morning itself, through the email/push pipeline,
--   logged as kind 'own_day' with keys "you|<offset>|<date>".
--
-- Rollback (in this order):
--   drop trigger reservations_plan_sync on public.reservations;
--   drop function public.reservations_plan_sync(), public.sync_gift_step(uuid, uuid),
--     public.start_plan(uuid, date), public.ensure_plan_for(uuid, uuid, date, text),
--     public.plan_suggestions(text), public.seal_future_note(text), public.my_sealed_note(),
--     public.throw_away_future_note(),
--     public.own_day_candidates(), public.my_today(), public.today_for(uuid),
--     public.next_occurrence(integer, integer, date), public.occurrence_in(integer, integer, integer),
--     public.plan_steps_limit();
--   recreate reminder_log_keys(), claim_reminders(), reclaim_stuck_reminders() from 20261114142830;
--   delete from public.notification_log where kind = 'own_day';
--   drop index public.notification_log_own_day_once;
--   alter table public.notification_log drop constraint notification_log_own_day_fields,
--     drop constraint notification_log_kind_check,
--     add constraint notification_log_kind_check check (kind in ('reminder', 'test'));
--   alter table public.reminder_settings drop column remind_my_day;
--   drop table public.future_notes, public.plan_steps, public.plans;

-- Dates ------------------------------------------------------------------------------------------

-- The date a day + month falls on in a year: 29 February is the 28th in other years (src/lib/dates.ts).
create function public.occurrence_in(p_day integer, p_month integer, p_year integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select make_date(p_year, p_month, least(p_day,
    extract(day from (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day'))::integer));
$$;

-- The next time a day + month comes round, from a date (that date itself counts).
create function public.next_occurrence(p_day integer, p_month integer, p_from date)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when public.occurrence_in(p_day, p_month, extract(year from p_from)::integer) >= p_from
      then public.occurrence_in(p_day, p_month, extract(year from p_from)::integer)
    else public.occurrence_in(p_day, p_month, extract(year from p_from)::integer + 1)
  end;
$$;

-- Today on someone's wall clock (profiles.timezone is validated; Casablanca otherwise). Server only.
create function public.today_for(p_profile_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select p.timezone from public.profiles p where p.id = p_profile_id), 'Africa/Casablanca'))::date;
$$;

-- Today on your own wall clock (used by RLS on future_notes).
create function public.my_today()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select public.today_for(auth.uid());
$$;

revoke execute on function public.occurrence_in(integer, integer, integer),
  public.next_occurrence(integer, integer, date), public.today_for(uuid), public.my_today()
  from public, anon, authenticated;
grant execute on function public.my_today() to authenticated;

-- Plans ------------------------------------------------------------------------------------------

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Null: your own birthday.
  occasion_id uuid references public.occasions (id) on delete cascade,
  -- The occurrence this plan is for (so it carries the year).
  occurs_on date not null,
  note text check (note is null or char_length(note) <= 280),
  created_at timestamptz not null default now(),
  constraint plans_one_per_occurrence unique nulls not distinct (owner_id, occasion_id, occurs_on)
);

comment on table public.plans is
  'A plan for one year''s occurrence of a day (or your own birthday). Private to the owner: nobody else can read it.';

create index plans_occasion_id_idx on public.plans (occasion_id);

alter table public.plans enable row level security;
create policy "Plans: read own"
  on public.plans for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Plans: update own"
  on public.plans for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "Plans: delete own"
  on public.plans for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- Made only by start_plan() (it checks the day is yours and adds the steps).
revoke all on public.plans from anon, authenticated;
grant select, delete on public.plans to authenticated;
grant update (note) on public.plans to authenticated;

create table public.plan_steps (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null default 'other'
    check (kind in ('gift', 'message', 'call', 'cake', 'kind_word', 'visit', 'friends', 'treat', 'other')),
  label text not null check (char_length(label) between 1 and 60 and label = btrim(label)),
  position smallint not null default 0 check (position between 0 and 99),
  done_at timestamptz,
  -- 'reservation': ticked by reserving a gift (cancelling it unticks it again).
  ticked_by text check (ticked_by in ('me', 'reservation')),
  created_at timestamptz not null default now(),
  constraint plan_steps_tick check ((done_at is null) = (ticked_by is null))
);

comment on table public.plan_steps is 'The steps of a plan: tickable, editable, removable. Owner only.';

create index plan_steps_plan_id_idx on public.plan_steps (plan_id, position);
create index plan_steps_owner_id_idx on public.plan_steps (owner_id);

alter table public.plan_steps enable row level security;
create policy "Plan steps: read own"
  on public.plan_steps for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Plan steps: add to own plan"
  on public.plan_steps for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.plans p where p.id = plan_id and p.owner_id = (select auth.uid())));
create policy "Plan steps: update own"
  on public.plan_steps for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "Plan steps: delete own"
  on public.plan_steps for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.plan_steps from anon, authenticated;
grant select, delete on public.plan_steps to authenticated;
grant insert (plan_id, kind, label, position) on public.plan_steps to authenticated;
grant update (label, position, done_at, ticked_by) on public.plan_steps to authenticated;

-- A short checklist: at most 12 steps.
create function public.plan_steps_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('plan:' || new.plan_id::text, 0));
  if (select count(*) from public.plan_steps s where s.plan_id = new.plan_id) >= 12 then
    raise exception 'too_many_steps' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.plan_steps_limit() from public, anon, authenticated;
create trigger plan_steps_limit
  before insert on public.plan_steps
  for each row execute function public.plan_steps_limit();

-- The suggested steps (src/features/plans/steps.ts keeps the same list; a test checks both).
create function public.plan_suggestions(p_style text)
returns table (kind text, label text, step_order smallint)
language sql
immutable
set search_path = ''
as $$
  select s.kind, s.label, s.step_order::smallint
  from (values
    ('celebrate', 'gift', 'Gift', 0),
    ('celebrate', 'message', 'Message', 1),
    ('celebrate', 'call', 'Call', 2),
    ('celebrate', 'cake', 'Cake', 3),
    ('celebrate', 'other', 'Something else', 4),
    ('gentle', 'kind_word', 'Send a kind word', 0),
    ('gentle', 'call', 'Call them', 1),
    ('gentle', 'visit', 'Visit', 2),
    ('own', 'friends', 'Plan something with friends', 0),
    ('own', 'cake', 'Cake', 1),
    ('own', 'treat', 'Treat yourself', 2),
    ('own', 'other', 'Something just for me', 3)
  ) as s (style, kind, label, step_order)
  where s.style = p_style
  order by s.step_order;
$$;
revoke execute on function public.plan_suggestions(text) from public, anon, authenticated;

-- The plan for an occurrence, made with its suggested steps if it's new. Server only.
create function public.ensure_plan_for(p_owner uuid, p_occasion_id uuid, p_occurs_on date, p_style text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.plans (owner_id, occasion_id, occurs_on)
    values (p_owner, p_occasion_id, p_occurs_on)
    on conflict on constraint plans_one_per_occurrence do nothing
    returning id into v_id;
  if v_id is null then
    select p.id into v_id from public.plans p
      where p.owner_id = p_owner and p.occasion_id is not distinct from p_occasion_id
        and p.occurs_on = p_occurs_on;
    return v_id;
  end if;
  insert into public.plan_steps (plan_id, owner_id, kind, label, position)
    select v_id, p_owner, s.kind, s.label, s.step_order from public.plan_suggestions(p_style) s;
  return v_id;
end;
$$;
revoke execute on function public.ensure_plan_for(uuid, uuid, date, text) from public, anon, authenticated;

-- "Plan their day" / "My plan": the plan for one occurrence of one of your
-- days (or of your own birthday when p_occasion_id is null). Anything that
-- isn't yours, or isn't a real occurrence from yesterday on, is refused.
create function public.start_plan(p_occasion_id uuid, p_occurs_on date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date;
  v_style text;
  v_ok boolean;
  v_day integer;
  v_month integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  v_today := public.today_for(v_uid);
  if p_occurs_on is null or p_occurs_on < v_today - 1 or p_occurs_on > v_today + 800 then
    raise exception 'invalid_occurrence' using errcode = '22023';
  end if;

  if p_occasion_id is null then
    select pr.birthday_day, pr.birthday_month into v_day, v_month
      from public.profiles pr where pr.id = v_uid;
    if v_day is null then
      raise exception 'no_birthday' using errcode = 'P0002';
    end if;
    v_ok := public.occurrence_in(v_day, v_month, extract(year from p_occurs_on)::integer) = p_occurs_on;
    v_style := 'own';
  else
    select case when o.recurring
                  then public.occurrence_in(o.day, o.month, extract(year from p_occurs_on)::integer) = p_occurs_on
                else o.year is not null and make_date(o.year, o.month, o.day) = p_occurs_on end,
           case when o.kind = 'remembrance' or p.in_memory then 'gentle' else 'celebrate' end
      into v_ok, v_style
      from public.occasions o
      join public.people p on p.id = o.person_id
      where o.id = p_occasion_id and p.owner_id = v_uid and p.archived_at is null;
    if v_style is null then
      raise exception 'plan_not_found' using errcode = 'P0002';
    end if;
  end if;
  if not v_ok then
    raise exception 'invalid_occurrence' using errcode = '22023';
  end if;
  return public.ensure_plan_for(v_uid, p_occasion_id, p_occurs_on, v_style);
end;
$$;
revoke execute on function public.start_plan(uuid, date) from public, anon;
grant execute on function public.start_plan(uuid, date) to authenticated;

-- Reserving a gift ticks "Gift" ---------------------------------------------------------------------

-- The reserver's plan for their linked person's next birthday: "Gift" is
-- ticked while they hold at least one reservation on that friend's wishes,
-- and unticked when they hold none (only if a reservation ticked it). Never
-- for someone "In memory". Writes only the reserver's own rows.
create function public.sync_gift_step(p_reserver uuid, p_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_occasion uuid;
  v_day integer;
  v_month integer;
  v_today date;
  v_plan uuid;
begin
  select o.id, o.day, o.month into v_occasion, v_day, v_month
    from public.people p
    join public.occasions o on o.person_id = p.id and o.kind = 'birthday'
    where p.owner_id = p_reserver and p.linked_profile_id = p_owner
      and p.archived_at is null and not p.in_memory
    limit 1;
  if v_occasion is null then
    return;
  end if;
  v_today := public.today_for(p_reserver);

  if exists (select 1 from public.reservations r
             join public.wishes w on w.id = r.wish_id
             where r.reserver_id = p_reserver and w.owner_id = p_owner and r.cancelled_at is null) then
    v_plan := public.ensure_plan_for(p_reserver, v_occasion,
      public.next_occurrence(v_day, v_month, v_today), 'celebrate');
    update public.plan_steps s set done_at = now(), ticked_by = 'reservation'
      where s.plan_id = v_plan and s.kind = 'gift' and s.done_at is null;
  else
    update public.plan_steps s set done_at = null, ticked_by = null
      from public.plans pl
      where s.plan_id = pl.id and pl.owner_id = p_reserver and pl.occasion_id = v_occasion
        and pl.occurs_on >= v_today and s.kind = 'gift' and s.ticked_by = 'reservation';
  end if;
end;
$$;
revoke execute on function public.sync_gift_step(uuid, uuid) from public, anon, authenticated;

create function public.reservations_plan_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.reservations;
  v_owner uuid;
begin
  if tg_op = 'UPDATE' and (old.cancelled_at is null) = (new.cancelled_at is null) then
    return null;
  end if;
  v_row := case when tg_op = 'DELETE' then old else new end;
  select w.owner_id into v_owner from public.wishes w where w.id = v_row.wish_id;
  if v_owner is null then
    return null; -- the wish itself is being deleted
  end if;
  -- A plan is a private convenience: it must never stop (or reveal anything
  -- about) a reservation, including when the owner removes a wish.
  begin
    perform public.sync_gift_step(v_row.reserver_id, v_owner);
  exception when others then
    null;
  end;
  return null;
end;
$$;
revoke execute on function public.reservations_plan_sync() from public, anon, authenticated;

create trigger reservations_plan_sync
  after insert or delete or update of cancelled_at on public.reservations
  for each row execute function public.reservations_plan_sync();

-- A note to future me -----------------------------------------------------------------------------

create table public.future_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Your birthday after the day it was written; readable from then on.
  opens_on date not null,
  body text not null check (char_length(body) between 1 and 2000 and body = btrim(body)),
  created_at timestamptz not null default now(),
  constraint future_notes_one_per_birthday unique (owner_id, opens_on)
);

comment on table public.future_notes is
  'A note to open on your birthday. Sealed until then (in your timezone): not even you can read it before.';

alter table public.future_notes enable row level security;
-- Readable only by you, and only from the day it opens.
create policy "Future notes: read own once open"
  on public.future_notes for select to authenticated
  using ((select auth.uid()) = owner_id and opens_on <= (select public.my_today()));
-- "Throw away and write a new one" (sealed or not).
create policy "Future notes: throw away own"
  on public.future_notes for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- Written only by seal_future_note(); never edited.
revoke all on public.future_notes from anon, authenticated;
grant select, delete on public.future_notes to authenticated;

-- Seals a note until your next birthday (written on your birthday: the one after).
create function public.seal_future_note(p_body text)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_day integer;
  v_month integer;
  v_opens date;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(v_body) not between 1 and 2000 then
    raise exception 'invalid_note' using errcode = '22023';
  end if;
  select pr.birthday_day, pr.birthday_month into v_day, v_month
    from public.profiles pr where pr.id = v_uid;
  if v_day is null then
    raise exception 'no_birthday' using errcode = 'P0002';
  end if;
  v_opens := public.next_occurrence(v_day, v_month, public.today_for(v_uid) + 1);
  begin
    insert into public.future_notes (owner_id, opens_on, body) values (v_uid, v_opens, v_body);
  exception when unique_violation then
    raise exception 'note_sealed' using errcode = '23505';
  end;
  return v_opens;
end;
$$;
revoke execute on function public.seal_future_note(text) from public, anon;
grant execute on function public.seal_future_note(text) to authenticated;

-- Whether a sealed note is waiting, and when it opens (never its words).
create function public.my_sealed_note()
returns table (opens_on date, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select n.opens_on, n.created_at from public.future_notes n
  where n.owner_id = auth.uid() and n.opens_on > public.today_for(auth.uid())
  order by n.opens_on
  limit 1;
$$;
revoke execute on function public.my_sealed_note() from public, anon;
grant execute on function public.my_sealed_note() to authenticated;

-- "Throw away and write a new one": deletes your sealed note, unread. (A
-- filtered DELETE would need the row to be readable, and a sealed one isn't.)
create function public.throw_away_future_note()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.future_notes n
  where n.owner_id = auth.uid() and n.opens_on > public.today_for(auth.uid());
$$;
revoke execute on function public.throw_away_future_note() from public, anon;
grant execute on function public.throw_away_future_note() to authenticated;

-- Your own day: reminders ------------------------------------------------------------------------------

alter table public.reminder_settings add column remind_my_day boolean not null default false;
comment on column public.reminder_settings.remind_my_day is
  'Remind me about my own day: 7 days before and on the morning itself (email and/or push).';
grant insert (remind_my_day), update (remind_my_day) on public.reminder_settings to authenticated;

alter table public.notification_log
  drop constraint notification_log_kind_check,
  add constraint notification_log_kind_check check (kind in ('reminder', 'test', 'own_day')),
  add constraint notification_log_own_day_fields check (
    kind <> 'own_day'
    or (occasion_id is null and offset_days in (7, 0) and occurs_on is not null and batch_id is not null)
  );
create unique index notification_log_own_day_once
  on public.notification_log (profile_id, offset_days, occurs_on, channel)
  where kind = 'own_day';

-- People who want their own day remembered (server only).
create function public.own_day_candidates()
returns table (
  profile_id uuid,
  email text,
  first_name text,
  timezone text,
  send_time text,
  email_on boolean,
  push_on boolean,
  birthday_day smallint,
  birthday_month smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.id, u.email::text, coalesce(pr.first_name, ''), pr.timezone,
         to_char(rs.send_time, 'HH24:MI'),
         rs.email and u.email is not null and u.email_confirmed_at is not null,
         rs.push and exists (select 1 from public.push_subscriptions s where s.profile_id = pr.id),
         pr.birthday_day::smallint, pr.birthday_month::smallint
  from public.reminder_settings rs
  join public.profiles pr on pr.id = rs.profile_id
  join auth.users u on u.id = pr.id
  where rs.remind_my_day
    and pr.onboarded_at is not null
    and pr.birthday_day is not null
    and u.deleted_at is null
    and (
      (rs.email and u.email is not null and u.email_confirmed_at is not null)
      or (rs.push and exists (select 1 from public.push_subscriptions s where s.profile_id = pr.id))
    );
$$;

create or replace function public.reminder_log_keys()
returns table (profile_id uuid, channel text, key text)
language sql
stable
security definer
set search_path = ''
as $$
  select l.profile_id, l.channel,
         case when l.kind = 'own_day' then 'you' else l.occasion_id::text end
           || '|' || l.offset_days || '|' || to_char(l.occurs_on, 'YYYY-MM-DD')
  from public.notification_log l
  where l.kind in ('reminder', 'own_day') and l.occurs_on >= current_date - 2;
$$;

-- Keys are "<occasion id>|<offset>|<date>" for your people, "you|<offset>|<date>" for your own day.
create or replace function public.claim_reminders(p_profile_id uuid, p_batch_id uuid, p_keys text[], p_channel text)
returns setof text
language sql
security definer
set search_path = ''
as $$
  with k as (
    select split_part(x, '|', 1) as head,
           split_part(x, '|', 2)::smallint as offset_days,
           split_part(x, '|', 3)::date as occurs_on
    from unnest(p_keys) as x
  ),
  people_days as (
    insert into public.notification_log (profile_id, kind, occasion_id, offset_days, occurs_on, channel, batch_id)
    select p_profile_id, 'reminder', o.id, k.offset_days, k.occurs_on, p_channel, p_batch_id
    from k
    join public.occasions o on o.id::text = k.head
    join public.people p on p.id = o.person_id and p.owner_id = p_profile_id
    on conflict (profile_id, occasion_id, offset_days, occurs_on, channel) where kind = 'reminder'
    do nothing
    returning occasion_id::text || '|' || offset_days || '|' || to_char(occurs_on, 'YYYY-MM-DD') as key
  ),
  own_day as (
    insert into public.notification_log (profile_id, kind, occasion_id, offset_days, occurs_on, channel, batch_id)
    select p_profile_id, 'own_day', null, k.offset_days, k.occurs_on, p_channel, p_batch_id
    from k
    where k.head = 'you' and k.offset_days in (7, 0)
    on conflict (profile_id, offset_days, occurs_on, channel) where kind = 'own_day'
    do nothing
    returning 'you|' || offset_days || '|' || to_char(occurs_on, 'YYYY-MM-DD') as key
  )
  select key from people_days
  union all
  select key from own_day;
$$;

create or replace function public.reclaim_stuck_reminders()
returns table (batch_id uuid, profile_id uuid, channel text, keys text[])
language sql
security definer
set search_path = ''
as $$
  with gave_up as (
    update public.notification_log l set status = 'failed'
    where l.kind in ('reminder', 'own_day') and l.status = 'claimed'
      and l.claimed_at < now() - interval '10 minutes' and l.attempts >= 5
    returning l.id
  ),
  retry as (
    update public.notification_log l set claimed_at = now(), attempts = l.attempts + 1
    where l.kind in ('reminder', 'own_day') and l.status = 'claimed'
      and l.claimed_at < now() - interval '10 minutes' and l.attempts < 5
    returning l.batch_id, l.profile_id, l.channel,
      case when l.kind = 'own_day' then 'you' else l.occasion_id::text end
        || '|' || l.offset_days || '|' || to_char(l.occurs_on, 'YYYY-MM-DD') as key
  )
  select r.batch_id, r.profile_id, r.channel, array_agg(r.key order by r.key)
  from retry r
  group by r.batch_id, r.profile_id, r.channel;
$$;

revoke execute on function public.own_day_candidates() from public, anon, authenticated;
grant execute on function public.own_day_candidates() to service_role;
