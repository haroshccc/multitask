-- Phase 8.4 — Per-task deadline (separate from scheduled_at).
--
-- scheduled_at = "I plan to work on this at X" (calendar slot, may slip)
-- deadline_at = "this MUST be done by X or it's a real miss" (hard cutoff)
--
-- Two distinct concepts that the user kept conflating into scheduled_at.
-- Index helps the dashboard "what's overdue?" query and any future deadline
-- filter on the tasks screen.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS tasks_deadline_at_idx
  ON public.tasks (organization_id, deadline_at)
  WHERE deadline_at IS NOT NULL AND completed_at IS NULL;

COMMENT ON COLUMN public.tasks.deadline_at IS
  'Hard deadline for the task — distinct from scheduled_at (the planned work slot). Nullable.';
