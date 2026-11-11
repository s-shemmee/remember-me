-- M3 part 1: my wishlists, wish images, invites and connections.
-- * wishlists: two fixed lists per person ("My birthday", visible to
--   connections from part 2; "Treat yourself", always private), created
--   for every profile.
-- * wishes: title, link, price, note, priority, image; removed_at for Undo;
--   reorder_wishes().
-- * Storage bucket wish-images: private, 2 MB, JPEG/PNG/WebP; each person
--   only touches files under their own folder (<user id>/...).
-- * invites: random token in the link, only its SHA-256 hash stored;
--   7 days, once, revocable, max 20 active; optionally tied to one of your
--   people, who gets linked on accept.
-- * connections: one row per pair (lower id first). Made only by
--   accept_invite(); removed by remove_connection(), which clears
--   people.linked_profile_id on both sides.
-- Owner-only RLS everywhere for now; part 2 adds read access for connections.
-- Spec: docs/data-model.md. Tests: supabase/tests/wishlists.test.sql, connections.test.sql.
--
-- Roll back (in this order):
--   drop function if exists public.remove_connection(uuid), public.unlink_person(uuid),
--     public.link_person(uuid, uuid), public.my_connections(), public.revoke_invite(uuid),
--     public.accept_invite(text), public.invite_preview(text), public.create_invite(uuid),
--     public.reorder_wishes(uuid, uuid[]);
--   drop table if exists public.connections, public.invites, public.wishes, public.wishlists;
--   drop trigger if exists on_profile_created_wishlists on public.profiles;
--   drop function if exists public.create_default_wishlists();
--   drop policy ... on storage.objects (the four "Wish images:" policies);
--   delete from storage.buckets where id = 'wish-images';  -- after emptying it
--   drop type if exists public.wish_priority, public.wishlist_kind, public.wishlist_visibility;

-- Types ------------------------------------------------------------------------------

create type public.wishlist_kind as enum ('birthday', 'treat', 'other');
create type public.wishlist_visibility as enum ('private', 'connections', 'selected');
create type public.wish_priority as enum ('love', 'like', 'nice');

-- Wishlists --------------------------------------------------------------------------

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind public.wishlist_kind not null,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  visibility public.wishlist_visibility not null default 'private',
  created_at timestamptz not null default now(),
  -- "Treat yourself" is for you only, always.
  constraint wishlists_treat_private check (kind <> 'treat' or visibility = 'private')
);

comment on table public.wishlists is 'A wishlist. For now two fixed lists per person (birthday, treat).';

create unique index wishlists_one_fixed_per_kind
  on public.wishlists (owner_id, kind) where kind in ('birthday', 'treat');

alter table public.wishlists enable row level security;
create policy "Wishlists: read own"
  on public.wishlists for select to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.wishlists from anon, authenticated;
grant select on public.wishlists to authenticated;

-- Every profile gets its two lists (security definer: users can't insert lists).
create function public.create_default_wishlists()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.wishlists (owner_id, kind, title, visibility) values
    (new.id, 'birthday', 'My birthday', 'connections'),
    (new.id, 'treat', 'Treat yourself', 'private')
  on conflict do nothing;
  return new;
end;
$$;
revoke execute on function public.create_default_wishlists() from public, anon, authenticated;

create trigger on_profile_created_wishlists
  after insert on public.profiles
  for each row execute function public.create_default_wishlists();

insert into public.wishlists (owner_id, kind, title, visibility)
  select p.id, k.kind, k.title, k.visibility
  from public.profiles p
  cross join (values
    ('birthday'::public.wishlist_kind, 'My birthday', 'connections'::public.wishlist_visibility),
    ('treat'::public.wishlist_kind, 'Treat yourself', 'private'::public.wishlist_visibility)
  ) as k (kind, title, visibility)
on conflict do nothing;

-- Wishes ------------------------------------------------------------------------------

create table public.wishes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  wishlist_id uuid not null references public.wishlists (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  -- http(s) only: never javascript:, data: or other schemes.
  url text check (url is null or (char_length(url) <= 2048 and url ~* '^https?://[^[:space:]]+$')),
  price_amount numeric(12, 2) check (price_amount is null or price_amount >= 0),
  currency char(3) not null default 'MAD' check (currency in ('MAD', 'EUR', 'USD', 'GBP')),
  note text check (char_length(note) <= 280),
  priority public.wish_priority not null default 'like',
  -- A path in the wish-images bucket, under the owner's own folder.
  image_path text check (image_path is null or (char_length(image_path) <= 200
    and image_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]+\.(webp|jpg|jpeg|png)$')),
  position integer not null default 0,
  -- Removed with Undo; a job (M4) deletes them for good with their image.
  removed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.wishes is 'Something you wish for, on one of your wishlists.';

create index wishes_owner_id_idx on public.wishes (owner_id);
create index wishes_list_position_idx on public.wishes (wishlist_id, position) where removed_at is null;

alter table public.wishes enable row level security;
create policy "Wishes: read own"
  on public.wishes for select to authenticated
  using ((select auth.uid()) = owner_id);
-- New and changed wishes go on your own lists, with images from your own folder.
create policy "Wishes: add own"
  on public.wishes for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.wishlists l where l.id = wishlist_id and l.owner_id = (select auth.uid()))
    and (image_path is null or starts_with(image_path, (select auth.uid())::text || '/'))
  );
create policy "Wishes: update own"
  on public.wishes for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.wishlists l where l.id = wishlist_id and l.owner_id = (select auth.uid()))
    and (image_path is null or starts_with(image_path, (select auth.uid())::text || '/'))
  );
create policy "Wishes: delete own"
  on public.wishes for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.wishes from anon, authenticated;
grant select, delete on public.wishes to authenticated;
grant insert (wishlist_id, title, url, price_amount, currency, note, priority, image_path, position)
  on public.wishes to authenticated;
grant update (wishlist_id, title, url, price_amount, currency, note, priority, image_path, position, removed_at)
  on public.wishes to authenticated;

-- New order for a list's wishes, in one go (security invoker: RLS applies).
create function public.reorder_wishes(p_wishlist_id uuid, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  -- Your own list, and exactly its current wishes, each once.
  if not exists (select 1 from public.wishlists l where l.id = p_wishlist_id and l.owner_id = auth.uid())
     or p_ids is null
     or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) as x)
     or (select count(*) from public.wishes w
         where w.wishlist_id = p_wishlist_id and w.removed_at is null) <> cardinality(p_ids)
     or exists (select 1 from unnest(p_ids) as x
                where not exists (select 1 from public.wishes w
                                  where w.id = x and w.wishlist_id = p_wishlist_id and w.removed_at is null)) then
    raise exception 'invalid_order' using errcode = '22023';
  end if;
  update public.wishes w set position = o.n
    from unnest(p_ids) with ordinality as o (id, n)
    where w.id = o.id;
end;
$$;
revoke execute on function public.reorder_wishes(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_wishes(uuid, uuid[]) to authenticated;

-- Storage: wish images ----------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('wish-images', 'wish-images', false)
on conflict (id) do nothing;

-- Limits are enforced by the Storage API (not by Postgres): only set them
-- where the columns exist (a bare `supabase db start` may not have them).
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types') then
    update storage.buckets
      set public = false,
          file_size_limit = 2097152,
          allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
      where id = 'wish-images';
  end if;
end;
$$;

-- Each person only touches files under "<their id>/".
create policy "Wish images: read own"
  on storage.objects for select to authenticated
  using (bucket_id = 'wish-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Wish images: upload own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'wish-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Wish images: update own"
  on storage.objects for update to authenticated
  using (bucket_id = 'wish-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'wish-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Wish images: delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'wish-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Connections ---------------------------------------------------------------------------

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  -- The pair, lower id first, so it can only exist once.
  user_low uuid not null references public.profiles (id) on delete cascade,
  user_high uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint connections_ordered check (user_low < user_high),
  constraint connections_pair_unique unique (user_low, user_high)
);

comment on table public.connections is
  'Two people who agreed to see each other''s shared things. Made by accept_invite(), removed by remove_connection().';

create index connections_user_high_idx on public.connections (user_high);

alter table public.connections enable row level security;
create policy "Connections: read own"
  on public.connections for select to authenticated
  using ((select auth.uid()) in (user_low, user_high));

revoke all on public.connections from anon, authenticated;
grant select on public.connections to authenticated;

-- Invites -------------------------------------------------------------------------------

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  -- Invited from a person's profile: linked to them on accept.
  person_id uuid references public.people (id) on delete set null,
  -- SHA-256 of the token in the link; the token itself is never stored.
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz
);

comment on table public.invites is
  'Connection invites by link: 7 days, once, revocable. Only the token''s hash is stored.';

create index invites_inviter_id_idx on public.invites (inviter_id);
create index invites_person_id_idx on public.invites (person_id) where person_id is not null;

alter table public.invites enable row level security;
create policy "Invites: read own"
  on public.invites for select to authenticated
  using ((select auth.uid()) = inviter_id);

revoke all on public.invites from anon, authenticated;
-- Never the hash.
grant select (id, inviter_id, person_id, created_at, expires_at, used_at, used_by, revoked_at)
  on public.invites to authenticated;

-- A new invite; returns the token for the link (shown once).
create function public.create_invite(p_person_id uuid default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if (select count(*) from public.invites i
      where i.inviter_id = v_uid and i.used_at is null and i.revoked_at is null
        and i.expires_at > now()) >= 20 then
    raise exception 'too_many_invites' using errcode = '22023';
  end if;
  if p_person_id is not null then
    if not exists (select 1 from public.people p
                   where p.id = p_person_id and p.owner_id = v_uid and p.archived_at is null) then
      raise exception 'person_not_found' using errcode = 'P0002';
    end if;
    if exists (select 1 from public.people p where p.id = p_person_id and p.linked_profile_id is not null) then
      raise exception 'already_connected' using errcode = '22023';
    end if;
  end if;

  -- A new link for the same person replaces their previous open one (links
  -- are only shown once, so asking again is how you get a fresh one).
  if p_person_id is not null then
    update public.invites i set revoked_at = now()
      where i.inviter_id = v_uid and i.person_id = p_person_id
        and i.used_at is null and i.revoked_at is null;
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.invites (inviter_id, person_id, token_hash)
  values (v_uid, p_person_id, extensions.digest(v_token, 'sha256'));
  return v_token;
end;
$$;
revoke execute on function public.create_invite(uuid) from public, anon;
grant execute on function public.create_invite(uuid) to authenticated;

-- What the invite page may say about a link, before or after signing in:
-- the inviter's first name and the link's state. Nothing else.
create function public.invite_preview(p_token text)
returns table (inviter_name text, status text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_invite public.invites%rowtype;
  v_uid uuid := auth.uid();
begin
  select * into v_invite from public.invites i
    where i.token_hash = extensions.digest(coalesce(p_token, ''), 'sha256');
  if not found then
    return query select null::text, 'not_found'::text;
    return;
  end if;
  return query select
    (select p.first_name from public.profiles p where p.id = v_invite.inviter_id),
    case
      when v_uid = v_invite.inviter_id then 'own'
      -- Already connected (for example, they just accepted this link) says so first.
      when v_uid is not null and exists (select 1 from public.connections c
        where c.user_low = least(v_uid, v_invite.inviter_id)
          and c.user_high = greatest(v_uid, v_invite.inviter_id)) then 'connected'
      when v_invite.revoked_at is not null then 'revoked'
      when v_invite.used_at is not null then 'used'
      when v_invite.expires_at <= now() then 'expired'
      else 'valid'
    end;
end;
$$;
revoke execute on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;

-- Accept: checks the link, marks it used, connects both people and, if the
-- invite came from one of the inviter's people, links that person. One transaction.
create function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.invites%rowtype;
  v_connection uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_invite from public.invites i
    where i.token_hash = extensions.digest(coalesce(p_token, ''), 'sha256')
    for update;
  if not found then
    raise exception 'invite_not_found' using errcode = '22023';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'invite_revoked' using errcode = '22023';
  end if;
  if v_invite.used_at is not null then
    raise exception 'invite_used' using errcode = '22023';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'invite_expired' using errcode = '22023';
  end if;
  if v_invite.inviter_id = v_uid then
    raise exception 'own_invite' using errcode = '22023';
  end if;
  if exists (select 1 from public.connections c
             where c.user_low = least(v_uid, v_invite.inviter_id)
               and c.user_high = greatest(v_uid, v_invite.inviter_id)) then
    raise exception 'already_connected' using errcode = '22023';
  end if;

  update public.invites set used_at = now(), used_by = v_uid where id = v_invite.id;
  insert into public.connections (user_low, user_high)
  values (least(v_uid, v_invite.inviter_id), greatest(v_uid, v_invite.inviter_id))
  returning id into v_connection;

  if v_invite.person_id is not null then
    update public.people p set linked_profile_id = v_uid
      where p.id = v_invite.person_id and p.owner_id = v_invite.inviter_id
        and p.archived_at is null and p.linked_profile_id is null;
  end if;
  return v_connection;
end;
$$;
revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;

create function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  update public.invites i set revoked_at = now()
    where i.id = p_invite_id and i.inviter_id = auth.uid()
      and i.used_at is null and i.revoked_at is null;
  if not found then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.revoke_invite(uuid) from public, anon;
grant execute on function public.revoke_invite(uuid) to authenticated;

-- Your connections with only what you may see of them: first name and look
-- (never birth year, timezone or email), and which of your people they are.
create function public.my_connections()
returns table (
  connection_id uuid,
  profile_id uuid,
  first_name text,
  avatar_kind public.avatar_kind,
  avatar_color text,
  avatar_character text,
  linked_person_id uuid,
  linked_person_name text,
  connected_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, o.id, o.first_name, o.avatar_kind, o.avatar_color, o.avatar_character,
         p.id, p.name, c.created_at
  from public.connections c
  join public.profiles o
    on o.id = case when c.user_low = auth.uid() then c.user_high else c.user_low end
  left join public.people p
    on p.owner_id = auth.uid() and p.linked_profile_id = o.id and p.archived_at is null
  where auth.uid() in (c.user_low, c.user_high)
  order by c.created_at desc;
$$;
revoke execute on function public.my_connections() from public, anon;
grant execute on function public.my_connections() to authenticated;

-- "This is Khalid": link one of your people to one of your connections
-- (one person per connection).
create function public.link_person(p_person_id uuid, p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.people p
                 where p.id = p_person_id and p.owner_id = v_uid and p.archived_at is null) then
    raise exception 'person_not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.connections c
                 where c.user_low = least(v_uid, p_profile_id)
                   and c.user_high = greatest(v_uid, p_profile_id)) then
    raise exception 'not_connected' using errcode = '22023';
  end if;
  update public.people p set linked_profile_id = null
    where p.owner_id = v_uid and p.linked_profile_id = p_profile_id and p.id <> p_person_id;
  update public.people p set linked_profile_id = p_profile_id where p.id = p_person_id;
end;
$$;
revoke execute on function public.link_person(uuid, uuid) from public, anon;
grant execute on function public.link_person(uuid, uuid) to authenticated;

create function public.unlink_person(p_person_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  update public.people p set linked_profile_id = null
    where p.id = p_person_id and p.owner_id = auth.uid();
  if not found then
    raise exception 'person_not_found' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.unlink_person(uuid) from public, anon;
grant execute on function public.unlink_person(uuid) to authenticated;

-- Either side can remove a connection; both sides' links go with it.
create function public.remove_connection(p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_low uuid;
  v_high uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  delete from public.connections c
    where c.id = p_connection_id and v_uid in (c.user_low, c.user_high)
    returning c.user_low, c.user_high into v_low, v_high;
  if v_low is null then
    raise exception 'connection_not_found' using errcode = 'P0002';
  end if;
  update public.people p set linked_profile_id = null
    where (p.owner_id = v_low and p.linked_profile_id = v_high)
       or (p.owner_id = v_high and p.linked_profile_id = v_low);
end;
$$;
revoke execute on function public.remove_connection(uuid) from public, anon;
grant execute on function public.remove_connection(uuid) to authenticated;
