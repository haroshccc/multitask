-- Per-project ordering for the FIXED columns of TasksBlock. Empty array =
-- use the default order from the code; otherwise the array is the canonical
-- left-to-right (RTL: start-to-end) order of fixed-column keys (subset of
-- 'title' | 'estimated_hours' | 'spare_hours' | 'urgency' | 'timer' |
-- 'actual_seconds' | 'notes').
ALTER TABLE projects ADD COLUMN IF NOT EXISTS column_order jsonb NOT NULL DEFAULT '[]'::jsonb;
