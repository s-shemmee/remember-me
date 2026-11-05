# Data model (Supabase)

All tables live in `public`, have RLS **enabled**, and use `uuid` keys (`gen_random_uuid()`), `created_at timestamptz default now()`. `owner_id` always references `profiles.id`, which equals `auth.users.id`.

## Tables

**profiles**: one per user, created by a trigger on `auth.users` insert.
`id uuid pk → auth.users`, `first_name`, `last_name`, `handle citext unique`, `birthday_day smallint`, `birthday_month smallint`, `birth_year smallint null` (private, never exposed to others), `city`, `bio`, `avatar_kind enum('initials','photo','character')`, `avatar_color text` (pastel name), `avatar_character text`, `avatar_path text`, `timezone text default 'Africa/Casablanca'`.

**people**: someone you remember (they may or may not use the app).
`id`, `owner_id`, `name`, `relation text`, `group enum('family','friends','work','other')`, `color text`, `linked_profile_id uuid null → profiles` (set when connected), `little_things text[] default '{}'`, `archived_at null`.

**occasions**: a day to remember. Belongs to a person, or to the owner themselves (`person_id null`).
`id`, `owner_id`, `person_id null`, `kind enum('birthday','anniversary','graduation','other')`, `title`, `day smallint check 1–31`, `month smallint check 1–12`, `year smallint null`, `recurring bool default true`.

**connections**: two users who agreed to see each other's shared things.
`id`, `requester_id`, `addressee_id`, `status enum('pending','accepted','declined')`, unique on the unordered pair.

**wishlists**: `id`, `owner_id`, `title`, `kind enum('birthday','treat','other')`, `visibility enum('private','connections','selected')`.
**wishlist_shares**: `wishlist_id`, `profile_id` (used when visibility = selected).
**wishes**: `id`, `wishlist_id`, `title`, `price_amount numeric null`, `currency char(3) default 'MAD'`, `url text null`, `image_path null`, `emoji null`, `note null`, `position int`.
**reservations**: `wish_id pk → wishes`, `reserver_id`, `created_at`. One reservation per wish.

**plans** + **plan_steps**: per occasion per year. Steps: `gift`, `reserve`, `wish`, `celebrate`, or custom (Celebrate Me checklist). `done bool`.

**reminder_settings**: `profile_id pk`, `offsets_days int[] default '{7,1,0}'`, `send_time time default '09:00'`, `email bool default true`, `push bool default false`, `remind_my_people bool default true`.
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

## Storage buckets (private, signed URLs)
`avatars` (2 MB, images only), `wish-images` (2 MB), `memories` (5 MB). Path prefix = `auth.uid()`; policies check the prefix.

## Jobs
- `pg_cron` every 15 minutes → Edge Function `send-reminders`: finds occasions whose next occurrence minus an offset falls in the user's `send_time` window in their timezone; writes `notification_log` first (idempotent), then sends email (Resend) and/or web push.
- Edge Function `link-preview`: fetches a product URL server side (SSRF-safe), extracts title/price/image.
- Nightly: clean expired push subscriptions; remind connected people about your day if `remind_my_people`.

## Dates
`src/lib/dates.ts` owns: next occurrence of `day/month` from today in a timezone, days until, 29 Feb → 28 Feb in non-leap years, age from optional year. Unit-test all of it.
