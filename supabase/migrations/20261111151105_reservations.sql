-- M3 part 2: friends' wishlists and secret reservations.
--
-- The secrecy rule: a wish's owner never learns anything about reservations
-- on their wishes (no state, count, time or reserver) in any query, function,
-- API response or realtime event. So:
--   * `wishes` has no reservation column, and nothing here ever writes to it;
--   * `reservations` is readable and deletable only by the reserver (RLS);
--   * friends see wishes only through `friend_wishes()`, which never returns
--     the caller's own wishes;
--   * reserving goes through `reserve_wish()`, which gives an owner the same
--     error for their own wish as for one that doesn't exist;
--   * `reservations` is not part of the realtime publication.
-- Accepted risk (docs/decisions.md): an owner with a second account connected
-- to themselves could see "Already taken", never who.
--
-- Friends read only through security definer functions; table RLS on
-- `wishes` and `wishlists` stays owner only.
--
-- Rollback (in this order):
--   drop policy "Wish images: read friends' shared" on storage.objects;
--   drop trigger if exists wishes_reservations_on_change on public.wishes;
--   drop trigger if exists wishes_reservations_on_delete on public.wishes;
--   drop function if exists public.wishes_reservations_sync(), public.reserve_wish(uuid),
--     public.friend_wishes(), public.my_friends(), public.can_view_wish_image(text),
--     public.wish_is_shared(uuid), public.are_connected(uuid, uuid), public.name_for(uuid, uuid);
--   drop table if exists public.notices, public.reservations;
--   then restore remove_connection() from 20261110163107_wishlists_and_connections.sql.

-- Helpers (internal: not callable through the API) ---------------------------------------

-- Whether two people are connected. Not granted to users: it would let anyone
-- test whether two other people know each other.
create function public.are_connected(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_a is not null and p_b is not null and exists (
    select 1 from public.connections c
    where c.user_low = least(p_a, p_b) and c.user_high = greatest(p_a, p_b));
$$;
revoke execute on function public.are_connected(uuid, uuid) from public, anon, authenticated;

-- Whether a wish is live on a list that connections can see ("My birthday").
create function public.wish_is_shared(p_wishlist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.wishlists l
                 where l.id = p_wishlist_id and l.kind = 'birthday' and l.visibility = 'connections');
$$;
revoke execute on function public.wish_is_shared(uuid) from public, anon, authenticated;

-- What `p_viewer` calls `p_profile`: their name in the viewer's People when
-- linked, otherwise the profile's first name.
create function public.name_for(p_viewer uuid, p_profile uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select left(coalesce(
    (select p.name from public.people p
     where p.owner_id = p_viewer and p.linked_profile_id = p_profile and p.archived_at is null
     limit 1),
    (select o.first_name from public.profiles o where o.id = p_profile),
    'Someone'), 60);
$$;
revoke execute on function public.name_for(uuid, uuid) from public, anon, authenticated;

-- Reservations ----------------------------------------------------------------------------

create table public.reservations (
  -- One reservation per wish: the primary key settles a race.
  wish_id uuid primary key references public.wishes (id) on delete cascade,
  reserver_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Set when the owner removes the wish (or stops sharing it). Restoring it
  -- within 10 minutes clears it again; after that it's final, and a job (M4)
  -- deletes cancelled rows. A cancelled reservation counts as free everywhere.
  cancelled_at timestamptz
);

comment on table public.reservations is
  'Secret gift reservations. Only the reserver can read or delete their row; the wish owner never sees anything.';

create index reservations_reserver_id_idx on public.reservations (reserver_id);

alter table public.reservations enable row level security;
create policy "Reservations: reserver reads own"
  on public.reservations for select to authenticated
  using ((select auth.uid()) = reserver_id);
create policy "Reservations: reserver cancels own"
  on public.reservations for delete to authenticated
  using ((select auth.uid()) = reserver_id);

-- No direct inserts or updates: reserve_wish() checks everything first.
revoke all on public.reservations from anon, authenticated;
grant select, delete on public.reservations to authenticated;

-- Quiet in-app notes ----------------------------------------------------------------------

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('wish_removed')),
  -- Copied when the note is made, so it still reads right after a disconnect.
  actor_name text not null check (char_length(actor_name) between 1 and 60),
  wish_id uuid references public.wishes (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

comment on table public.notices is 'Quiet in-app notes, e.g. "Khalid removed a wish you''d reserved".';

create index notices_user_unread_idx on public.notices (user_id, created_at desc) where read_at is null;
create index notices_wish_id_idx on public.notices (wish_id);

alter table public.notices enable row level security;
create policy "Notices: read own"
  on public.notices for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Notices: dismiss own"
  on public.notices for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.notices from anon, authenticated;
grant select on public.notices to authenticated;
grant update (read_at) on public.notices to authenticated;

-- Removing a wish cancels its reservation ---------------------------------------------------

-- Runs as the table owner, so the wish owner's own request behaves (and
-- answers) exactly the same whether the wish was reserved or not.
create function public.wishes_reservations_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_was_shared boolean;
  v_is_shared boolean;
begin
  if tg_op = 'DELETE' then
    insert into public.notices (user_id, kind, actor_name)
      select r.reserver_id, 'wish_removed', public.name_for(r.reserver_id, old.owner_id)
      from public.reservations r
      where r.wish_id = old.id and r.cancelled_at is null;
    return old;
  end if;

  v_was_shared := old.removed_at is null and public.wish_is_shared(old.wishlist_id);
  v_is_shared := new.removed_at is null and public.wish_is_shared(new.wishlist_id);

  if v_was_shared and not v_is_shared then
    -- Removed (or moved to a private list): cancel, and tell the reserver quietly.
    with cancelled as (
      update public.reservations r set cancelled_at = now()
      where r.wish_id = new.id and r.cancelled_at is null
      returning r.reserver_id
    )
    insert into public.notices (user_id, kind, actor_name, wish_id)
      select c.reserver_id, 'wish_removed', public.name_for(c.reserver_id, new.owner_id), new.id
      from cancelled c;
  elsif v_is_shared and not v_was_shared then
    -- Back within 10 minutes: the reservation holds again and an unread note goes.
    with restored as (
      update public.reservations r set cancelled_at = null
      where r.wish_id = new.id and r.cancelled_at > now() - interval '10 minutes'
      returning r.reserver_id
    )
    delete from public.notices n
      using restored s
      where n.user_id = s.reserver_id and n.wish_id = new.id
        and n.kind = 'wish_removed' and n.read_at is null;
  end if;
  return new;
end;
$$;
revoke execute on function public.wishes_reservations_sync() from public, anon, authenticated;

create trigger wishes_reservations_on_change
  after update of removed_at, wishlist_id on public.wishes
  for each row execute function public.wishes_reservations_sync();
-- Before the row goes, while its reservation (deleted by cascade) still exists.
create trigger wishes_reservations_on_delete
  before delete on public.wishes
  for each row execute function public.wishes_reservations_sync();

-- Reserving -------------------------------------------------------------------------------

-- Reserve a friend's wish. Any wish you can't reserve (yours, a stranger's,
-- a private, removed or unknown one) gives the same `wish_not_found`, so it
-- reveals nothing. A wish someone else holds gives `already_taken`.
create function public.reserve_wish(p_wish_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select w.owner_id into v_owner
    from public.wishes w
    where w.id = p_wish_id and w.removed_at is null and public.wish_is_shared(w.wishlist_id);
  if v_owner is null or v_owner = v_uid or not public.are_connected(v_uid, v_owner) then
    raise exception 'wish_not_found' using errcode = 'P0002';
  end if;
  -- Already yours: nothing to do.
  if exists (select 1 from public.reservations r
             where r.wish_id = p_wish_id and r.reserver_id = v_uid and r.cancelled_at is null) then
    return;
  end if;
  -- A final cancellation doesn't hold the wish any more.
  delete from public.reservations r where r.wish_id = p_wish_id and r.cancelled_at is not null;
  begin
    insert into public.reservations (wish_id, reserver_id) values (p_wish_id, v_uid);
  exception when unique_violation then
    raise exception 'already_taken' using errcode = '23505';
  end;
end;
$$;
revoke execute on function public.reserve_wish(uuid) from public, anon;
grant execute on function public.reserve_wish(uuid) to authenticated;

-- Friends and their wishes ------------------------------------------------------------------

-- Your connections with what the Friends' tab needs: first name, look,
-- birthday day and month (never the year), and your name for them.
-- (M5 adds "Show my birthday to my connections".)
create function public.my_friends()
returns table (
  profile_id uuid,
  first_name text,
  name text,
  avatar_kind public.avatar_kind,
  avatar_color text,
  avatar_character text,
  birthday_day smallint,
  birthday_month smallint,
  linked_person_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.first_name, public.name_for(auth.uid(), o.id),
         o.avatar_kind, o.avatar_color, o.avatar_character,
         o.birthday_day::smallint, o.birthday_month::smallint, p.id
  from public.connections c
  join public.profiles o
    on o.id = case when c.user_low = auth.uid() then c.user_high else c.user_low end
  left join public.people p
    on p.owner_id = auth.uid() and p.linked_profile_id = o.id and p.archived_at is null
  where auth.uid() in (c.user_low, c.user_high);
$$;
revoke execute on function public.my_friends() from public, anon;
grant execute on function public.my_friends() to authenticated;

-- Your friends' shared wishes, each with `status`: free, mine or taken.
-- Never your own wishes, never "Treat yourself", never removed ones.
create function public.friend_wishes()
returns table (
  id uuid,
  owner_id uuid,
  title text,
  url text,
  price_amount numeric,
  currency text,
  note text,
  priority public.wish_priority,
  image_path text,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.owner_id, w.title, w.url, w.price_amount, w.currency::text, w.note, w.priority,
         w.image_path,
         case
           when r.wish_id is null or r.cancelled_at is not null then 'free'
           when r.reserver_id = auth.uid() then 'mine'
           else 'taken'
         end
  from public.wishes w
  left join public.reservations r on r.wish_id = w.id
  where w.removed_at is null
    and w.owner_id <> auth.uid()
    and public.wish_is_shared(w.wishlist_id)
    and public.are_connected(auth.uid(), w.owner_id)
  order by w.owner_id, w.position, w.created_at;
$$;
revoke execute on function public.friend_wishes() from public, anon;
grant execute on function public.friend_wishes() to authenticated;

-- Photos of friends' shared wishes: readable (so they can be signed) only
-- while the wish is one you can see.
create function public.can_view_wish_image(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.wishes w
    where w.image_path = p_name and w.removed_at is null
      and public.wish_is_shared(w.wishlist_id)
      and public.are_connected(auth.uid(), w.owner_id));
$$;
revoke execute on function public.can_view_wish_image(text) from public, anon;
grant execute on function public.can_view_wish_image(text) to authenticated;

create index wishes_image_path_idx on public.wishes (image_path) where image_path is not null;

create policy "Wish images: read friends' shared"
  on storage.objects for select to authenticated
  using (bucket_id = 'wish-images' and public.can_view_wish_image(name));

-- Removing a connection cancels reservations both ways ---------------------------------------

create or replace function public.remove_connection(p_connection_id uuid)
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
  delete from public.reservations r
    using public.wishes w
    where r.wish_id = w.id
      and ((r.reserver_id = v_low and w.owner_id = v_high)
        or (r.reserver_id = v_high and w.owner_id = v_low));
end;
$$;
