-- Split goals into two types:
-- 'habit'       — recurring, tracked by period (X times per day/week/month)
-- 'achievement' — one-time goal, optionally with a deadline

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS goal_type TEXT CHECK (goal_type IN ('achievement', 'habit')),
  ADD COLUMN IF NOT EXISTS goal_deadline DATE;

-- Backfill: existing goals (goal_period set) are habit goals.
UPDATE tasks SET goal_type = 'habit' WHERE goal_period IS NOT NULL AND goal_type IS NULL;
