-- Ask Noor (AI phase 1b): help answers from our own documents (RAG), and
-- the groundwork for every AI feature: daily usage limits.
--
-- help_chunks: the knowledge base (help articles, the landing FAQ, Privacy and
--   Terms), one row per chunk, with a gte-small embedding (384 dims, built
--   into Supabase Edge Functions). Public product text, no personal data.
--   Users may read it; only the server writes it (the index-help function).
-- match_help_chunks(): the top chunks above a similarity threshold.
-- ai_usage_daily: how many AI uses per user, per day, per feature. No
--   questions, no answers: counts only. Server only.
-- claim_ai_use(): takes one use if the user and the global daily caps allow.
--
-- Rollback: drop function public.claim_ai_use(uuid, text, int, int);
--   drop table public.ai_usage_daily; drop function public.match_help_chunks(extensions.vector, float, int);
--   drop table public.help_chunks; (the vector extension can stay).

create extension if not exists vector with schema extensions;

create table public.help_chunks (
  key text primary key check (char_length(key) between 3 and 200),
  source text not null check (char_length(source) between 2 and 80),
  title text not null check (char_length(title) between 1 and 120),
  heading text not null check (char_length(heading) between 1 and 300),
  url text not null check (url ~ '^/[A-Za-z0-9/_#-]*$'),
  content text not null check (char_length(content) between 1 and 4000),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{16}$'),
  embedding extensions.vector(384) not null,
  updated_at timestamptz not null default now()
);

create index help_chunks_embedding_idx on public.help_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.help_chunks enable row level security;

-- Read-only for signed-in users (it's the same text as the public pages).
create policy "help chunks are readable by signed-in users"
  on public.help_chunks for select to authenticated using (true);

revoke all on public.help_chunks from public, anon, authenticated;
grant select on public.help_chunks to authenticated;
grant select, insert, update, delete on public.help_chunks to service_role;

-- The closest chunks to a question, best first, above a cosine similarity floor.
create or replace function public.match_help_chunks(
  p_embedding extensions.vector(384),
  p_threshold float,
  p_count int
)
returns table (key text, title text, heading text, url text, content text, similarity float)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.key, c.title, c.heading, c.url, c.content,
         1 - (c.embedding operator(extensions.<=>) p_embedding) as similarity
  from public.help_chunks c
  where 1 - (c.embedding operator(extensions.<=>) p_embedding) >= p_threshold
  order by c.embedding operator(extensions.<=>) p_embedding
  limit least(greatest(p_count, 1), 10);
$$;

revoke execute on function public.match_help_chunks(extensions.vector, float, int) from public, anon;
grant execute on function public.match_help_chunks(extensions.vector, float, int) to authenticated, service_role;

create table public.ai_usage_daily (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  feature text not null check (feature ~ '^[a-z_]{2,40}$'),
  count int not null default 0 check (count >= 0),
  primary key (profile_id, day, feature)
);

create index ai_usage_daily_day_feature_idx on public.ai_usage_daily (day, feature);

alter table public.ai_usage_daily enable row level security;
-- No policies: server only.
revoke all on public.ai_usage_daily from public, anon, authenticated;
grant select, insert, update, delete on public.ai_usage_daily to service_role;

-- Takes one use of a feature for a user today (UTC), if both caps allow:
-- 'ok', 'user_limit' or 'global_limit'. Old rows (over 30 days) go as it runs.
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
  -- One claim at a time per feature and day, so the global cap holds.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('ai_usage:' || p_feature || ':' || v_today));

  select coalesce(sum(count), 0) into v_all
  from public.ai_usage_daily where day = v_today and feature = p_feature;
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
