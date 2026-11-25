-- Noor drafts a message (AI phase 2): "Use in plan" keeps the chosen text on
-- the plan's step (the Message step of a birthday plan) and ticks it.
--
-- * plan_steps.message: the text, at most 400 characters, trimmed, or null.
--   Owner only, like the rest of the step (RLS unchanged); users may update it.
-- * Nothing else changes: the AI never writes it. The app saves it only when
--   the person taps "Use in plan", after they could edit it.
--
-- Rollback:
--   revoke update (message) on public.plan_steps from authenticated;
--   Keep the column to preserve saved user data. Any future cleanup must be a
--   separate opt-in migration with a backup warning.

alter table public.plan_steps
  add column message text
    check (message is null or (char_length(message) between 1 and 400 and message = btrim(message)));

comment on column public.plan_steps.message is
  'The message chosen for this step (e.g. from Noor''s drafts, edited by the owner). Owner only.';

grant update (message) on public.plan_steps to authenticated;
