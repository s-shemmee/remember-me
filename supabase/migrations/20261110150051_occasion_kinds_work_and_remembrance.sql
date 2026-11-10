-- Occasion types (part 1 of 2): two new kinds, Work milestone and
-- Remembrance. On its own because new enum values must be committed before
-- anything uses them (the next migration does).
-- Spec: docs/decisions.md ("Occasion types"), docs/data-model.md.
--
-- Roll back: Postgres can't drop an enum value. Roll back the next
-- migration first; the unused values can stay, or recreate the type:
--   (only if no occasion uses them) create a new enum without them,
--   alter table public.occasions alter column kind type <new> using kind::text::<new>,
--   drop the old type and rename the new one.

alter type public.occasion_kind add value if not exists 'work_milestone' before 'other';
alter type public.occasion_kind add value if not exists 'remembrance' before 'other';
