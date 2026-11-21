-- Help & feedback: what signed-in people send us from /help.
--
-- * Users can send (insert) their own messages and never read them back: no
--   select, update or delete for them. Only the type, the message and the
--   optional page/device info (meta) are theirs to set.
-- * 5 per person per rolling 24 hours, counted by a security definer trigger
--   (it must count rows users can't select), with a per-user lock so two at
--   once can't both slip under the limit.
-- * The send-feedback Edge Function emails each new message to
--   contact@shemme.codes and marks it with emailed_at, so it goes out once.
-- * meta is only ever {browser, screen, route}: never people, wishes or names
--   (src/features/feedback/schema.ts builds it; the check keeps it small).
-- * A deleted account takes its feedback with it (on delete cascade).
--
-- Rollback:
--   drop trigger if exists feedback_rate_limit on public.feedback;
--   drop function if exists public.feedback_rate_limit();
--   drop table if exists public.feedback;

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  type text not null check (type in ('idea', 'broken', 'other')),
  message text not null check (char_length(btrim(message)) between 1 and 1000),
  meta jsonb not null default '{}'::jsonb
    check (jsonb_typeof(meta) = 'object' and pg_column_size(meta) <= 1024),
  created_at timestamptz not null default now(),
  emailed_at timestamptz
);

create index feedback_user_created on public.feedback (user_id, created_at desc);
create index feedback_not_emailed on public.feedback (user_id) where emailed_at is null;

alter table public.feedback enable row level security;

create policy "Feedback: send your own"
  on public.feedback for insert to authenticated
  with check ((select auth.uid()) = user_id);
-- No select, update or delete policies: people can't read feedback back.

revoke all on public.feedback from anon, authenticated;
grant insert (type, message, meta) on public.feedback to authenticated;

-- The limit: 5 in any 24 hours. security definer to count rows the sender
-- can't select; it also sets created_at and emailed_at itself.
create function public.feedback_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('feedback:' || new.user_id::text, 0));
  select count(*) into v_recent
    from public.feedback
   where user_id = new.user_id
     and created_at > now() - interval '24 hours';
  if v_recent >= 5 then
    raise exception 'feedback_limit' using errcode = 'P0001';
  end if;
  new.created_at := now();
  new.emailed_at := null;
  return new;
end;
$$;

revoke execute on function public.feedback_rate_limit() from public, anon, authenticated;

create trigger feedback_rate_limit
  before insert on public.feedback
  for each row execute function public.feedback_rate_limit();
