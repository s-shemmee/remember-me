-- Personal invite link, and reusing a person's invite (fix/invite-link-and-plan-dots).
--
-- Two kinds of invite now:
-- * 'personal': your one link (My profile → Invite your people). Made once,
--   shown every time, no expiry, works for anyone, any number of times.
--   "Reset link" revokes it and makes a new one.
-- * 'once': an invite for one of your people (their page), as before: 7
--   days, one use, links them on accept. Asking again for the same person
--   returns their open invite instead of making a new one.
--
-- To show a link again, its token is kept in invites.token. The API can't
-- read it (no column grant; table grants are per column since M3): only
-- my_invite_link(), reset_invite_link() and create_invite() return it, and
-- only to the inviter. Lookups still go through the SHA-256 hash.
--
-- Limits: at most 30 invites made a day (any kind), 5 of them personal
-- (resets), and 20 open 'once' invites at a time (unchanged).
-- Clean-up: a revoked personal link gets expires_at = now(), so the daily
-- clean-up (expires_at older than a day) deletes it like any expired invite.
--
-- Rollback:
--   drop function if exists public.my_invite_link(), public.reset_invite_link();
--   -- then re-create create_invite, accept_invite and revoke_invite from
--   -- 20261110163107_wishlists_and_connections.sql, and:
--   drop index if exists public.invites_one_personal_idx;
--   drop index if exists public.invites_inviter_created_idx;
--   alter table public.invites drop constraint if exists invites_personal_no_person;
--   alter table public.invites drop column if exists use_count, drop column if exists token,
--     drop column if exists kind;

alter table public.invites
  add column kind text not null default 'once' check (kind in ('once', 'personal')),
  add column token text check (token is null or token ~ '^[0-9a-f]{64}$'),
  add column use_count integer not null default 0 check (use_count >= 0);

alter table public.invites
  add constraint invites_personal_no_person check (kind = 'once' or person_id is null);

comment on column public.invites.kind is
  'once: 7 days, one use, maybe for a person. personal: the inviter''s own link, no expiry, many uses.';
comment on column public.invites.token is
  'The link''s token, so the inviter can see it again. Never granted to the API; read only by the inviter through security definer functions.';

-- One live personal link per person.
create unique index invites_one_personal_idx
  on public.invites (inviter_id) where kind = 'personal' and revoked_at is null;
-- "Made today" for the daily limit, and the newest-first list.
create index invites_inviter_created_idx on public.invites (inviter_id, created_at desc);

-- Readable: the kind and how often a personal link was used. Still never the
-- hash, and never the token.
grant select (kind, use_count) on public.invites to authenticated;

-- The daily limit, shared by every way of making an invite.
create function public.invites_rate_check(p_uid uuid, p_kind text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.invites i
      where i.inviter_id = p_uid and i.created_at > now() - interval '1 day') >= 30 then
    raise exception 'too_many_invites_today' using errcode = '22023';
  end if;
  if p_kind = 'personal' and (select count(*) from public.invites i
      where i.inviter_id = p_uid and i.kind = 'personal'
        and i.created_at > now() - interval '1 day') >= 5 then
    raise exception 'too_many_resets' using errcode = '22023';
  end if;
end;
$$;
revoke execute on function public.invites_rate_check(uuid, text) from public, anon, authenticated;

-- Your personal link's token: the live one, else a new one (made once).
create function public.my_invite_link()
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
  select i.token into v_token from public.invites i
    where i.inviter_id = v_uid and i.kind = 'personal' and i.revoked_at is null;
  if v_token is not null then
    return v_token;
  end if;

  perform public.invites_rate_check(v_uid, 'personal');
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.invites (inviter_id, kind, token_hash, token, expires_at)
  values (v_uid, 'personal', extensions.digest(v_token, 'sha256'), v_token, 'infinity')
  on conflict (inviter_id) where kind = 'personal' and revoked_at is null do nothing;
  -- Two first loads at once: both get the one that won.
  select i.token into v_token from public.invites i
    where i.inviter_id = v_uid and i.kind = 'personal' and i.revoked_at is null;
  return v_token;
end;
$$;
revoke execute on function public.my_invite_link() from public, anon;
grant execute on function public.my_invite_link() to authenticated;

-- "Reset link": the old link stops working at once; a new one replaces it.
create function public.reset_invite_link()
returns text
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
  perform public.invites_rate_check(v_uid, 'personal');
  update public.invites i set revoked_at = now(), expires_at = now()
    where i.inviter_id = v_uid and i.kind = 'personal' and i.revoked_at is null;
  return public.my_invite_link();
end;
$$;
revoke execute on function public.reset_invite_link() from public, anon;
grant execute on function public.reset_invite_link() to authenticated;

-- A person's invite (once, 7 days): their open one if there is one, else a
-- new one. Without a person: your personal link.
create or replace function public.create_invite(p_person_id uuid default null)
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
  if p_person_id is null then
    return public.my_invite_link();
  end if;
  if not exists (select 1 from public.people p
                 where p.id = p_person_id and p.owner_id = v_uid and p.archived_at is null) then
    raise exception 'person_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.people p where p.id = p_person_id and p.linked_profile_id is not null) then
    raise exception 'already_connected' using errcode = '22023';
  end if;

  -- Their open invite, if it can be shown again.
  select i.token into v_token from public.invites i
    where i.inviter_id = v_uid and i.person_id = p_person_id and i.kind = 'once'
      and i.used_at is null and i.revoked_at is null and i.expires_at > now()
      and i.token is not null
    order by i.created_at desc
    limit 1;
  if v_token is not null then
    return v_token;
  end if;

  if (select count(*) from public.invites i
      where i.inviter_id = v_uid and i.kind = 'once' and i.used_at is null
        and i.revoked_at is null and i.expires_at > now()) >= 20 then
    raise exception 'too_many_invites' using errcode = '22023';
  end if;
  perform public.invites_rate_check(v_uid, 'once');
  -- An older open one that can't be shown again (made before tokens were
  -- kept) is replaced, as before.
  update public.invites i set revoked_at = now()
    where i.inviter_id = v_uid and i.person_id = p_person_id
      and i.used_at is null and i.revoked_at is null;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.invites (inviter_id, person_id, kind, token_hash, token)
  values (v_uid, p_person_id, 'once', extensions.digest(v_token, 'sha256'), v_token);
  return v_token;
end;
$$;

-- Accept: a personal link stays valid (its use is counted and the inviter
-- hears who); a 'once' invite is marked used, as before.
create or replace function public.accept_invite(p_token text)
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

  if v_invite.kind = 'personal' then
    update public.invites set use_count = use_count + 1 where id = v_invite.id;
    -- The same notice a used 'once' invite sends (notify_invite_accepted).
    insert into public.notifications (user_id, kind, actor_id, group_key)
    values (v_invite.inviter_id, 'invite_accepted', v_uid, 'invite:' || v_uid)
    on conflict (user_id, group_key, day) do nothing;
  else
    update public.invites set used_at = now(), used_by = v_uid where id = v_invite.id;
  end if;
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

-- Cancel: a personal link also expires now, so the daily clean-up removes it.
create or replace function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  update public.invites i
    set revoked_at = now(),
        expires_at = case when i.kind = 'personal' then now() else i.expires_at end
    where i.id = p_invite_id and i.inviter_id = auth.uid()
      and i.used_at is null and i.revoked_at is null;
  if not found then
    raise exception 'invite_not_found' using errcode = 'P0002';
  end if;
end;
$$;
