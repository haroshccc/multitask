-- Per-project schema for the tasks table's dynamic columns. Each entry is
-- { id, type, label, emoji?, opts? } and per-task values land in
-- tasks.custom_fields[id]. The id is a stable string the UI generates.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS dyn_columns jsonb NOT NULL DEFAULT '[]'::jsonb;
