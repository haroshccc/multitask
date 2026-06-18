-- Active/inactive flag for projects. Inactive projects stay visible in the
-- projects list (with a toggle) but their tasks/events are hidden from the
-- task list and calendar until reactivated. Distinct from is_archived (which
-- soft-deletes the project from the main list).
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
