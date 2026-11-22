-- No duplicate people when someone connects (feat/link-connections-no-duplicates).
--
-- * link_person_to_account(person, profile): links one of your people to a
--   connection's account. If another of your people was linked to that
--   account (a duplicate), it's merged into this one and removed (archived,
--   so the daily clean-up deletes it after 30 days): its other days move
--   here, with their plans; its birthday plans join this person's; its
--   little things are added to these (no repeats, at most 20). This
--   person's own fields always win: name, relation, colour, dates. Returns
--   the merged person's name, or null.
-- * add_person_from_connection(profile, day, month): "No, add as new" from
--   the prompt after someone joins through your personal link: a new person
--   with their first name and look, linked to them. The birthday is theirs
--   when they share it, else the day and month you give.
-- Never matched by name or email: you always choose. unlink_person() (M3)
-- stays the way to unlink. Nothing here widens what anyone can read: both
-- functions check auth.uid(), your own people, and the connection.
--
-- Rollback:
--   drop function if exists public.link_person_to_account(uuid, uuid);
--   drop function if exists public.add_person_from_connection(uuid, integer, integer);

create function public.link_person_to_account(p_person_id uuid, p_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_keep public.people%rowtype;
  v_dup public.people%rowtype;
  v_keep_birthday uuid;
  v_dup_birthday uuid;
  v_plan record;
  v_target uuid;
  v_room integer;
  v_things text[];
  v_emojis text[];
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_keep from public.people p
    where p.id = p_person_id and p.owner_id = v_uid and p.archived_at is null
    for update;
  if not found then
    raise exception 'person_not_found' using errcode = 'P0002';
  end if;
  if p_profile_id is null or not public.are_connected(v_uid, p_profile_id) then
    raise exception 'not_connected' using errcode = '22023';
  end if;
  if v_keep.linked_profile_id = p_profile_id then
    return null;
  end if;

  select * into v_dup from public.people p
    where p.owner_id = v_uid and p.linked_profile_id = p_profile_id
      and p.archived_at is null and p.id <> p_person_id
    for update;

  if found then
    -- Little things: these first, then theirs that aren't here yet (any case).
    select coalesce(array_agg(x.t order by x.n), '{}'), coalesce(array_agg(x.e order by x.n), '{}')
      into v_things, v_emojis
      from (
        select k.t, k.e, k.n from unnest(v_keep.little_things, v_keep.little_thing_emojis)
          with ordinality as k(t, e, n)
        union all
        select d.t, d.e, 1000 + d.n from unnest(v_dup.little_things, v_dup.little_thing_emojis)
          with ordinality as d(t, e, n)
         where not exists (select 1 from unnest(v_keep.little_things) as kt(t)
                           where lower(kt.t) = lower(d.t))
        order by 3
        limit 20
      ) x;

    -- Days: their birthday's plans join this person's birthday; every other
    -- day moves here, with its plans.
    select o.id into v_keep_birthday from public.occasions o
      where o.person_id = v_keep.id and o.kind = 'birthday';
    select o.id into v_dup_birthday from public.occasions o
      where o.person_id = v_dup.id and o.kind = 'birthday';
    if v_dup_birthday is not null and v_keep_birthday is not null then
      for v_plan in select * from public.plans pl where pl.occasion_id = v_dup_birthday loop
        select pl.id into v_target from public.plans pl
          where pl.owner_id = v_uid and pl.occasion_id = v_keep_birthday
            and pl.occurs_on = v_plan.occurs_on;
        if v_target is null then
          update public.plans set occasion_id = v_keep_birthday where id = v_plan.id;
        else
          -- Both had a plan for that year: one plan, both lists (no repeats, 12 steps max).
          select 12 - count(*) into v_room from public.plan_steps s where s.plan_id = v_target;
          insert into public.plan_steps (plan_id, owner_id, kind, label, position, done_at, ticked_by, message)
          select v_target, v_uid, s.kind, s.label,
                 least(99, (select coalesce(max(t.position), 0) from public.plan_steps t
                            where t.plan_id = v_target) + row_number() over (order by s.position)),
                 s.done_at, s.ticked_by, s.message
            from public.plan_steps s
           where s.plan_id = v_plan.id
             and not exists (select 1 from public.plan_steps t
                             where t.plan_id = v_target and t.kind = s.kind
                               and lower(t.label) = lower(s.label))
           order by s.position
           limit greatest(v_room, 0);
          update public.plans set note = coalesce(note, v_plan.note) where id = v_target;
          delete from public.plans where id = v_plan.id;
        end if;
      end loop;
    end if;
    update public.occasions o set person_id = v_keep.id
      where o.person_id = v_dup.id
        and (o.kind <> 'birthday' or v_keep_birthday is null);

    update public.people set little_things = v_things, little_thing_emojis = v_emojis
      where id = v_keep.id;
    update public.people set linked_profile_id = null, archived_at = now()
      where id = v_dup.id;
  end if;

  update public.people set linked_profile_id = p_profile_id where id = v_keep.id;
  return case when v_dup.id is not null then v_dup.name end;
end;
$$;
revoke execute on function public.link_person_to_account(uuid, uuid) from public, anon;
grant execute on function public.link_person_to_account(uuid, uuid) to authenticated;

create function public.add_person_from_connection(
  p_profile_id uuid,
  p_birthday_day integer default null,
  p_birthday_month integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_them public.profiles%rowtype;
  v_day integer;
  v_month integer;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_profile_id is null or not public.are_connected(v_uid, p_profile_id) then
    raise exception 'not_connected' using errcode = '22023';
  end if;
  if exists (select 1 from public.people p
             where p.owner_id = v_uid and p.linked_profile_id = p_profile_id
               and p.archived_at is null) then
    raise exception 'already_linked' using errcode = '22023';
  end if;
  select * into v_them from public.profiles o where o.id = p_profile_id;
  -- Their birthday only if they share it; else the one you give.
  v_day := coalesce(p_birthday_day, case when v_them.share_birthday then v_them.birthday_day end);
  v_month := coalesce(p_birthday_month, case when v_them.share_birthday then v_them.birthday_month end);
  if v_day is null or v_month is null then
    raise exception 'birthday_needed' using errcode = '22023';
  end if;

  v_id := public.save_person(
    p_name => left(coalesce(nullif(btrim(v_them.first_name), ''), 'New friend'), 40),
    p_relation_kind => 'Friend',
    p_color => case when v_them.avatar_color in ('peach', 'lilac', 'mint', 'sky', 'rose', 'butter')
                    then v_them.avatar_color end,
    p_birthday_day => v_day,
    p_birthday_month => v_month
  );
  update public.people set linked_profile_id = p_profile_id where id = v_id;
  return v_id;
end;
$$;
revoke execute on function public.add_person_from_connection(uuid, integer, integer) from public, anon;
grant execute on function public.add_person_from_connection(uuid, integer, integer) to authenticated;
