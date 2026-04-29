-- Spec MD calls out 12 dynamic column types. Add the four missing values to
-- the enum so the picker can offer them: שעה / מיקום / אחראי / תג.
ALTER TYPE custom_field_type ADD VALUE IF NOT EXISTS 'time';
ALTER TYPE custom_field_type ADD VALUE IF NOT EXISTS 'location';
ALTER TYPE custom_field_type ADD VALUE IF NOT EXISTS 'person';
ALTER TYPE custom_field_type ADD VALUE IF NOT EXISTS 'tag';

-- Per-project label overrides for the FIXED columns of TasksBlock — lets the
-- user rename "שעות"/"ספייר"/"דחיפות"/"סטופר"/"בפועל"/"הערות"/"משימה" to
-- match the project's vocabulary. Shape: { [colKey: string]: label }.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS column_labels jsonb NOT NULL DEFAULT '{}'::jsonb;
