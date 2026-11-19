-- New accounts start in light (fix/ui-polish). Dark and System stay a
-- choice away (Settings → Appearance, or the toggle). Existing profiles keep
-- whatever they have.
--
-- Rollback: alter table public.profiles alter column theme set default 'system';

alter table public.profiles alter column theme set default 'light';
