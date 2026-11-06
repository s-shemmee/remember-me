-- Profiles: one per user, created by a trigger when someone signs up.
-- Spec: docs/data-model.md (profiles). Tests: supabase/tests/profiles.test.sql.
--
-- Roll back (in this order):
--   drop trigger if exists on_auth_user_created on auth.users;
--   drop function if exists public.handle_new_user();
--   drop table if exists public.profiles;
--   drop type if exists public.avatar_kind;

create extension if not exists citext with schema extensions;

create type public.avatar_kind as enum ('initials', 'photo', 'character');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text check (char_length(first_name) between 1 and 50),
  last_name text check (char_length(last_name) between 1 and 50),
  -- Set in onboarding (M1 part 2). Unique regardless of case.
  handle extensions.citext unique check (handle ~ '^[A-Za-z0-9_]{3,30}$'),
  birthday_day smallint check (birthday_day between 1 and 31),
  birthday_month smallint check (birthday_month between 1 and 12),
  -- Private: never shown to other people (enforced when sharing arrives in M3).
  birth_year smallint check (birth_year between 1900 and 2100),
  city text check (char_length(city) <= 80),
  bio text check (char_length(bio) <= 280),
  avatar_kind public.avatar_kind not null default 'initials',
  avatar_color text check (avatar_color in ('peach', 'lilac', 'mint', 'sky', 'rose', 'butter')),
  avatar_character text,
  avatar_path text,
  timezone text not null default 'Africa/Casablanca',
  created_at timestamptz not null default now(),

  -- Day and month come together, and make a real date (29 February allowed).
  constraint profiles_birthday_complete check ((birthday_day is null) = (birthday_month is null)),
  constraint profiles_birthday_valid check (
    birthday_day is null
    or (birthday_month = 2 and birthday_day <= 29)
    or (birthday_month in (4, 6, 9, 11) and birthday_day <= 30)
    or (birthday_month in (1, 3, 5, 7, 8, 10, 12) and birthday_day <= 31)
  ),
  -- A year only makes sense with a birthday.
  constraint profiles_birth_year_needs_birthday check (birth_year is null or birthday_day is not null)
);

comment on table public.profiles is 'One per user (id = auth.users.id). Created by on_auth_user_created.';
comment on column public.profiles.birth_year is 'Private. Never exposed to other users.';

-- Row level security: people see and edit only their own profile for now.
-- Reading other people's profiles arrives with connections (M3).
alter table public.profiles enable row level security;

create policy "Profiles: read own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Profiles: update own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No insert policy (only the trigger creates profiles) and no delete policy
-- (account deletion comes in M5, through a server-side flow).

-- Table privileges on top of RLS: anon gets nothing; signed-in users can read
-- and update their own row, but never change id or created_at.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (
  first_name, last_name, handle, birthday_day, birthday_month, birth_year,
  city, bio, avatar_kind, avatar_color, avatar_character, avatar_path, timezone
) on public.profiles to authenticated;

-- Create the profile when a user signs up. The first name comes from the
-- sign-up form (first_name) or Google (given_name, else the first word of
-- full_name/name). security definer: it must write to public.profiles while
-- running inside the auth schema's insert.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name text;
begin
  name := coalesce(
    nullif(btrim(meta ->> 'first_name'), ''),
    nullif(btrim(meta ->> 'given_name'), ''),
    nullif(split_part(btrim(coalesce(meta ->> 'full_name', meta ->> 'name', '')), ' ', 1), '')
  );

  insert into public.profiles (id, first_name)
  values (new.id, left(name, 50));

  return new;
end;
$$;

-- Trigger functions are never called directly; keep them out of the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
