-- Noor's gift ideas (AI phase 1).
--
-- gift_idea_results: the last ideas for a person, so reopening costs nothing.
--   One row per person, deleted with the person (and so with the account).
--   Owners read and delete their own; only the server (the gift-ideas Edge
--   Function) writes.
-- claim_ai_use(): the global daily cap now counts every AI feature together
--   (one shared cap); each feature keeps its own per-user limit.
--
-- gift_idea_wishes(): the free, shared wish titles for one of your people.
--
-- Rollback: drop function public.gift_idea_wishes(uuid, uuid);
--   re-create claim_ai_use() from 20261120190000_ask_noor.sql (per-feature
--   global count). Keep gift_idea_results to preserve saved user data; any
--   future cleanup must be a separate opt-in migration with a backup warning.

create table public.gift_idea_results (
  person_id uuid primary key references public.people (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  occasion_kind text not null check (occasion_kind ~ '^[a-z_]{2,30}$'),
  budget text check (budget in ('small', 'medium', 'treat')),
  ideas jsonb not null check (
    jsonb_typeof(ideas) = 'array' and jsonb_array_length(ideas) between 3 and 5
  ),
  created_at timestamptz not null default now()
);

create index gift_idea_results_owner_idx on public.gift_idea_results (owner_id);

alter table public.gift_idea_results enable row level security;

create policy "owners read their gift ideas"
  on public.gift_idea_results for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "owners delete their gift ideas"
  on public.gift_idea_results for delete to authenticated
  using (owner_id = (select auth.uid()));

revoke all on public.gift_idea_results from public, anon, authenticated;
grant select, delete on public.gift_idea_results to authenticated;
grant select, insert, update, delete on public.gift_idea_results to service_role;

-- One shared global cap across AI features; per-user limits stay per feature.
create or replace function public.claim_ai_use(
  p_profile_id uuid,
  p_feature text,
  p_user_limit int,
  p_global_limit int
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_mine int;
  v_all int;
begin
  -- One claim at a time per day, so the shared global cap holds.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('ai_usage:' || v_today));

  select coalesce(sum(count), 0) into v_all
  from public.ai_usage_daily where day = v_today;
  if v_all >= p_global_limit then
    return 'global_limit';
  end if;

  select coalesce(count, 0) into v_mine
  from public.ai_usage_daily
  where profile_id = p_profile_id and day = v_today and feature = p_feature;
  if coalesce(v_mine, 0) >= p_user_limit then
    return 'user_limit';
  end if;

  insert into public.ai_usage_daily (profile_id, day, feature, count)
  values (p_profile_id, v_today, p_feature, 1)
  on conflict (profile_id, day, feature) do update set count = public.ai_usage_daily.count + 1;

  delete from public.ai_usage_daily where day < v_today - 30;
  return 'ok';
end;
$$;

revoke execute on function public.claim_ai_use(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.claim_ai_use(uuid, text, int, int) to service_role;

-- The wish titles gift ideas may use for one of your people: their shared
-- "My birthday" wishes that you can already see (you're connected and they
-- linked), and that nobody has reserved. Titles only: never prices, links,
-- notes, or who reserved what. Server only (the gift-ideas function).
create function public.gift_idea_wishes(p_viewer uuid, p_person_id uuid)
returns table (title text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select w.title, 'free'::text
  from public.people p
  join public.wishes w on w.owner_id = p.linked_profile_id
  left join public.reservations r on r.wish_id = w.id and r.cancelled_at is null
  where p.id = p_person_id
    and p.owner_id = p_viewer
    and w.owner_id <> p_viewer
    and w.removed_at is null
    and r.wish_id is null
    and public.wish_is_shared(w.wishlist_id)
    and public.are_connected(p_viewer, w.owner_id)
  order by w.position, w.created_at
  limit 10;
$$;

revoke execute on function public.gift_idea_wishes(uuid, uuid) from public, anon, authenticated;
grant execute on function public.gift_idea_wishes(uuid, uuid) to service_role;
