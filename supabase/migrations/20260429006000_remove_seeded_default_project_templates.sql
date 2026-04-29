-- Per user request: the 3 default templates (UX סטנדרטי / מיתוג בסיסי /
-- פיתוח אג'יל) were seeded in 20260429002000 as a sample but the user prefers
-- a clean slate — each user adds their own templates as needed. Drop them and
-- never reseed.
DELETE FROM project_templates WHERE is_default = true;
