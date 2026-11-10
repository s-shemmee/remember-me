# Data model (Supabase)

All tables live in `public`, have RLS **enabled**, and use `uuid` keys (`gen_random_uuid()`), `created_at timestamptz default now()`. `owner_id` always references `profiles.id`, which equals `auth.users.id`.

## Tables

**profiles**: one per user, created by a trigger on `auth.users` insert.
`id uuid pk → auth.users`, `first_name`, `last_name`, `handle citext unique`, `birthday_day smallint`, `birthday_month smallint`, `birth_year smallint null` (private, never exposed to others), `city`, `bio`, `avatar_kind enum('initials','photo','character')`, `avatar_color text` (pastel name), `avatar_character text`, `avatar_path text`, `timezone text default 'Africa/Casablanca'`.
Built (M1, `…_profiles.sql`): trigger `on_auth_user_created` → `handle_new_user()` (security definer, `search_path = ''`, not callable through the API) sets `first_name` from the sign-up form, else Google's `given_name`, else the first word of `full_name`; it may be null and onboarding asks again. `handle` is null until onboarding (`^[A-Za-z0-9_]{3,30}$`, unique ignoring case). Birthday checks: day and month together, a real date (29 Feb allowed), `birth_year` only with a birthday. RLS: read and update own row only; no insert (trigger only) and no delete (M5). Column grants: `anon` nothing; `authenticated` can't change `id` or `created_at`. Since `…_name_limits_and_relation_colours.sql`: `first_name` 1–40 (was 50), and the trigger cuts longer names to 40.

**people**: someone you remember (they may or may not use the app).
`id`, `owner_id`, `name`, `relation text`, `group enum('family','friends','work','other')`, `color text`, `linked_profile_id uuid null → profiles` (set when connected), `little_things text[] default '{}'`, `archived_at null`.
Built (M1 part 2, `…_onboarding.sql`, pulled forward from M2): `name` 1–40 (was 80; `…_name_limits_and_relation_colours.sql`), `relation` ≤ 40, `group` enum `person_group`, `color` one of the six pastels (default `lilac`; onboarding gives the relation's colour, see `docs/design-system.md`), `little_things` ≤ 20, `owner_id` defaults to `auth.uid()`. RLS: owner only for select/insert/update/delete. Column grants: users can't write `owner_id` or `linked_profile_id` (server only, M3).
Since `…_people_editing.sql` (M2 part 1): `relation_kind` is the relation chip (`Best friend`, `Family`, `Partner`, `Friend`, `Colleague`; it sets the default colour and the group), and `relation` is the optional "How you'd describe them" (1–30 characters, e.g. "Little sister"). The app shows `relation` when set, otherwise `relation_kind`. Existing rows were backfilled (chip text moved from `relation` to `relation_kind`). **Removing a person sets `archived_at`** (Undo clears it): archived people are hidden everywhere. Every app query filters `archived_at is null` (index `people_owner_active_idx`), `save_person()` refuses them (`not_found`), and the reminder job (M4) must skip occasions whose person is archived. A job in M4 deletes people archived more than 30 days ago (their occasions go with them, `on delete cascade`).

**occasions**: a day to remember. Belongs to a person, or to the owner themselves (`person_id null`).
`id`, `owner_id`, `person_id null`, `kind enum('birthday','anniversary','graduation','other')`, `title`, `day smallint check 1–31`, `month smallint check 1–12`, `year smallint null`, `recurring bool default true`.
Built (M1 part 2): enum `occasion_kind`; `day`/`month` must be a real day of the year (29 Feb allowed), and with a `year` 29 Feb must be a leap year; one `birthday` per person (partial unique index); index on `(month, day)` for reminders. Your own birthday stays on `profiles` (not duplicated as an occasion). RLS: owner only, and inserts/updates may only reference your own people.

**connections**: two users who agreed to see each other's shared things.
`id`, `requester_id`, `addressee_id`, `status enum('pending','accepted','declined')`, unique on the unordered pair.

**wishlists**: `id`, `owner_id`, `title`, `kind enum('birthday','treat','other')`, `visibility enum('private','connections','selected')`.
**wishlist_shares**: `wishlist_id`, `profile_id` (used when visibility = selected).
**wishes**: `id`, `wishlist_id`, `title`, `price_amount numeric null`, `currency char(3) default 'MAD'`, `url text null`, `image_path null`, `emoji null`, `note null`, `position int`.
**reservations**: `wish_id pk → wishes`, `reserver_id`, `created_at`. One reservation per wish.

**plans** + **plan_steps**: per occasion per year. Steps: `gift`, `reserve`, `wish`, `celebrate`, or custom (Celebrate Me checklist). `done bool`.

**reminder_settings**: `profile_id pk`, `offsets_days int[] default '{7,1,0}'`, `send_time time default '09:00'`, `email bool default true`, `push bool default false`, `remind_my_people bool default true`.
Built (M1 part 2; 14 added in `…_onboarding_reminders_and_push.sql`): `offsets_days` limited to 14/7/3/1/0 (default `{7,1,0}`), `send_time` 09:00, `email` on, `push` off, `remind_my_people` on. RLS: owner select/insert/update; no delete (goes with the profile). `profiles.onboarded_at` is null until `complete_onboarding()` finishes.
**push_subscriptions**: `id`, `profile_id`, `endpoint unique`, `p256dh`, `auth`, `user_agent`.
**notification_log**: `id`, `profile_id`, `occasion_id`, `offset_days`, `occurs_on date`, `channel`, `sent_at`. Unique on `(occasion_id, offset_days, occurs_on, channel)` so a reminder is never sent twice.

**future_notes**: `id`, `profile_id`, `body text`, `opens_on date`. Readable by the owner only, and only on/after `opens_on` (enforce in the policy).
**memories**: `id`, `profile_id`, `year`, `title`, `body`, `image_path`.

**ai_usage**: `id`, `profile_id`, `feature`, `model`, `input_tokens`, `output_tokens`, `cost_usd numeric`, `created_at`. Used for per-user daily limits.
**embeddings** (Phase 3): `id`, `owner_id`, `source_type enum('person','wish','memory')`, `source_id`, `content text`, `embedding vector(N)` (N = the embedding model's dimension), HNSW index.

## RLS rules (write a test for each)
- Owners can do everything on their own rows (`owner_id = auth.uid()`).
- Connected users can read a person's **shared** wishlists and wishes (`visibility = 'connections'`, or `selected` and listed in `wishlist_shares`).
- `reservations`: the **reserver** can insert/delete their own. Other connected friends can see *that* a wish is taken. The **wishlist owner can never select from `reservations`**. They read `wish_status` (a `security definer` view/function returning only `is_reserved boolean`).
- `profiles`: others see `first_name`, `handle`, `avatar_*`, `birthday_day/month` only if connected and allowed by privacy settings; never `birth_year`, `timezone`, email.
- `future_notes`: owner only, and `select` only when `current_date >= opens_on`.
- `ai_usage`, `notification_log`, `push_subscriptions`: owner read; writes only from Edge Functions (service role, server side).

## Functions
- `health_check()`: `returns boolean`, `security invoker`, reads no data. Executable by `anon` and `authenticated` only. Used by `GET /api/health`.
- `save_person(p_id?, p_name, p_relation_kind, p_relation?, p_color?, p_birthday_day, p_birthday_month, p_birthday_year?, p_little_things? = {}, p_days? = []) returns uuid`: `security invoker` (RLS applies), one transaction. Adds a person (`p_id` null) or edits one of yours that isn't archived (someone else's or an archived one raises `P0002 not_found`, so it never reveals whether an id exists). Saves the name (1–40), relation chip and description (≤ 30), colour (default: the relation's colour), group (from the chip: Family / Partner → family, Colleague → work, else friends), little things (trimmed, empty ones dropped, ≤ 20 of 1–60 characters) and the birthday (required, year not in the future, 29 February only in a leap year). `p_days` is a JSON array (≤ 10) of `{id?, kind: anniversary | graduation | other, title?, day, month, year?}`: rows with an `id` are edited (ids stay stable for `notification_log`), rows without are added, missing ones are deleted; `other` needs a title (≤ 40), other kinds drop it; an id from another person is refused. Errors: errcode `22023` with `invalid_name`, `invalid_relation`, `invalid_color`, `invalid_little_things`, `invalid_birthday`, `invalid_days`; `42501` `not_authenticated`. Executable by `authenticated` only. Tests: `supabase/tests/people.test.sql`.
- `complete_onboarding(p_first_name, p_birthday_day, p_birthday_month, p_birth_year?, p_avatar_kind?, p_avatar_color?, p_avatar_character?, p_avatar_path?, p_person_name?, p_person_relation?, p_person_color?, p_person_birthday_day?, p_person_birthday_month?, p_person_birthday_year?, p_person_little_thing?, p_reminder_offsets? = {7,1,0}, p_reminder_email? = true, p_reminder_push? = false, p_timezone?, p_person_description?) returns uuid`: `security invoker` (RLS applies), one transaction. Saves your name, birthday and look, the first person and their birthday (no name = skipped, returns null), reminder settings, then `onboarded_at`. Refuses a second call (`already_onboarded`). Offsets are de-duplicated and sorted, longest first. Names up to 40 characters. `p_person_relation` is the chip (saved in `relation_kind`; anything but the five chips is `invalid_person`), `p_person_description` the optional "How you'd describe them" (≤ 30, saved in `relation`), the little thing ≤ 60 characters. No `p_person_color`: the relation's colour (Best friend rose, Family sky, Partner peach, Friend lilac, Colleague mint, else lilac). Relation → group: Family / Partner → family, Colleague → work, Best friend / Friend → friends, else other. Errors: errcode `22023` with a code as the message (`invalid_first_name`, `invalid_birthday`, `invalid_birth_year`, `invalid_timezone`, `invalid_avatar`, `person_name_required`, `invalid_person`, `invalid_person_birthday`, `invalid_reminders`, `already_onboarded`); `42501` `not_authenticated`. Executable by `authenticated` only.

## Storage buckets (private, signed URLs)
`avatars` (2 MB, images only), `wish-images` (2 MB), `memories` (5 MB). Path prefix = `auth.uid()`; policies check the prefix.

## Jobs
- `pg_cron` every 15 minutes → Edge Function `send-reminders`: finds occasions whose next occurrence minus an offset falls in the user's `send_time` window in their timezone; writes `notification_log` first (idempotent), then sends email (Resend) and/or web push.
- Edge Function `link-preview`: fetches a product URL server side (SSRF-safe), extracts title/price/image.
- Nightly: clean expired push subscriptions; remind connected people about your day if `remind_my_people`.

## Dates
`src/lib/dates.ts` owns: next occurrence of `day/month` from today in a timezone, days until, 29 Feb → 28 Feb in non-leap years, age from optional year. Unit-test all of it.
Built (M2 part 1): plain calendar dates only (`{year, month, day}`), so daylight saving and the server's timezone never shift a day. `todayIn(timeZone)` (falls back to Africa/Casablanca), `nextOccurrence`, `daysUntil`, `daysBetween`, `yearsOn` (age or anniversary years, null without a year), `countdownLabel` ("today", "tomorrow", "in N days" up to 45, then "in N months"), `formatLongDate` ("Fri, 6 November"), `formatShortDate` ("Sun, 22 Nov"), `formatDayMonth`, plus `isLeapYear`, `isRealDayMonth` and `MONTHS`. Tests: `src/lib/dates.test.ts`.
