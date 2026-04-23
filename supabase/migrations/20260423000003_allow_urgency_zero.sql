-- =============================================================================
-- Multitask — 19. Allow urgency = 0
-- -----------------------------------------------------------------------------
-- The UI now exposes an explicit "no rating" option (0). The original CHECK
-- constraint was `urgency between 1 and 5`, which rejected 0 silently. Widen
-- to 0..5 so the picker's ∅ option persists.
-- =============================================================================

alter table public.tasks drop constraint if exists tasks_urgency_check;
alter table public.tasks add constraint tasks_urgency_check
  check (urgency between 0 and 5);
