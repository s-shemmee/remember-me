-- M5 part 1: Profile and Settings, and "In memory".
--
-- * profiles.share_birthday ("Show my birthday to my connections", default
--   on): off, my_friends() returns no date for you.
-- * profiles.theme (light | dark | system), saved and synced to devices.
-- * profiles.avatar_path must be in your own folder of the private
--   `avatars` bucket; connections read it only through can_view_avatar().
-- * people.in_memory: all of that person's days use the gentle wording.
-- * notices.actor_id, so deleting an account also removes notes carrying
--   your name; prepare_account_deletion() runs just before the auth user is
--   deleted (by the delete-account Edge Function), then everything cascades.
--
-- Rollback (in this order):
--   drop policy "Avatars: read own" on storage.objects; (and the other three "Avatars:" policies)
--   drop function if exists public.prepare_account_deletion(uuid), public.can_view_avatar(text);
--   recreate my_friends(), my_connections(), reminder_candidates() and
--   wishes_reservations_sync() from 20261114142830 / 20261111151105;
--   alter table public.notices drop column actor_id;
--   alter table public.people drop column in_memory;
--   alter table public.profiles drop constraint profiles_avatar_path_own,
--     drop column share_birthday, drop column theme;
--   delete from storage.buckets where id = 'avatars';  -- after emptying it

-- Profiles ------------------------------------------------------------------------------------

alter table public.profiles
  add column share_birthday boolean not null default true,
  add column theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  -- A photo lives in your own folder: "<your id>/<name>.webp".
  add constraint profiles_avatar_path_own check (
    avatar_path is null
    or avatar_path ~ ('^' || id::text || '/[A-Za-z0-9_-]{1,80}\.(webp|jpg|jpeg|png)$')
  );

comment on column public.profiles.share_birthday is
  'Show my birthday (day and month) to my connections. Off: my_friends() returns no date.';

grant update (share_birthday, theme) on public.profiles to authenticated;

-- People: "In memory" ---------------------------------------------------------------------------

alter table public.people add column in_memory boolean not null default false;
comment on column public.people.in_memory is
  'Someone who has passed: every day of theirs uses the gentle Remembrance wording.';
grant update (in_memory) on public.people to authenticated;

-- Avatars bucket -----------------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', false)
on conflict (id) do nothing;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types') then
    update storage.buckets
      set public = false,
          file_size_limit = 2097152,
          allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
      where id = 'avatars';
  end if;
end;
$$;

-- A connection may read your photo: the file must be your current avatar.
create function public.can_view_avatar(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles o
    where o.avatar_path = p_name
      and o.avatar_kind = 'photo'
      and public.are_connected(auth.uid(), o.id));
$$;
revoke execute on function public.can_view_avatar(text) from public, anon;
grant execute on function public.can_view_avatar(text) to authenticated;

create policy "Avatars: read own"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Avatars: connections read the current photo"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.can_view_avatar(name));
create policy "Avatars: upload own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Avatars: update own"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Avatars: delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Friends: hidden birthdays, photo paths -------------------------------------------------------------

drop function public.my_friends();
create function public.my_friends()
returns table (
  profile_id uuid,
  first_name text,
  name text,
  avatar_kind public.avatar_kind,
  avatar_color text,
  avatar_character text,
  avatar_path text,
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
         case when o.avatar_kind = 'photo' then o.avatar_path end,
         -- "Show my birthday to my connections" off: no date at all.
         case when o.share_birthday then o.birthday_day::smallint end,
         case when o.share_birthday then o.birthday_month::smallint end,
         p.id
  from public.connections c
  join public.profiles o
    on o.id = case when c.user_low = auth.uid() then c.user_high else c.user_low end
  left join public.people p
    on p.owner_id = auth.uid() and p.linked_profile_id = o.id and p.archived_at is null
  where auth.uid() in (c.user_low, c.user_high);
$$;
revoke execute on function public.my_friends() from public, anon;
grant execute on function public.my_friends() to authenticated;

drop function public.my_connections();
create function public.my_connections()
returns table (
  connection_id uuid,
  profile_id uuid,
  first_name text,
  avatar_kind public.avatar_kind,
  avatar_color text,
  avatar_character text,
  avatar_path text,
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
         case when o.avatar_kind = 'photo' then o.avatar_path end,
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

-- Reminders: in_memory for the wording ----------------------------------------------------------------

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
  wishlist_friend_id uuid,
  in_memory boolean
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
            and not p.in_memory
            and public.are_connected(pr.id, p.linked_profile_id)
            and exists (
              select 1 from public.wishes w
              left join public.reservations r on r.wish_id = w.id and r.cancelled_at is null
              where w.owner_id = p.linked_profile_id and w.removed_at is null
                and public.wish_is_shared(w.wishlist_id) and r.wish_id is null)
           then p.linked_profile_id
         end,
         p.in_memory
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
revoke execute on function public.reminder_candidates() from public, anon, authenticated;
grant execute on function public.reminder_candidates() to service_role;

-- Notes know who they're about (so they go when that account does) --------------------------------------

alter table public.notices add column actor_id uuid references public.profiles (id) on delete cascade;
create index notices_actor_id_idx on public.notices (actor_id);

create or replace function public.wishes_reservations_sync()
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
    insert into public.notices (user_id, kind, actor_name, actor_id)
      select r.reserver_id, 'wish_removed', public.name_for(r.reserver_id, old.owner_id), old.owner_id
      from public.reservations r
      where r.wish_id = old.id and r.cancelled_at is null;
    return old;
  end if;

  v_was_shared := old.removed_at is null and public.wish_is_shared(old.wishlist_id);
  v_is_shared := new.removed_at is null and public.wish_is_shared(new.wishlist_id);

  if v_was_shared and not v_is_shared then
    with cancelled as (
      update public.reservations r set cancelled_at = now()
      where r.wish_id = new.id and r.cancelled_at is null
      returning r.reserver_id
    )
    insert into public.notices (user_id, kind, actor_name, wish_id, actor_id)
      select c.reserver_id, 'wish_removed', public.name_for(c.reserver_id, new.owner_id), new.id, new.owner_id
      from cancelled c;
  elsif v_is_shared and not v_was_shared then
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

-- Account deletion -----------------------------------------------------------------------------------------

-- Runs just before the auth user is deleted (server only). Friends'
-- reservations on your wishes go quietly (no "removed a wish" notes), and
-- notes carrying your name go too. Deleting the auth user then cascades
-- through every table; links from other people's rows are set to null.
create function public.prepare_account_deletion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.reservations r
    using public.wishes w
    where r.wish_id = w.id and w.owner_id = p_user_id;
  delete from public.notices n where n.actor_id = p_user_id;
end;
$$;
revoke execute on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
