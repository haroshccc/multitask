-- Link calendar events to a project (additive, nullable). Lets the project
-- calendar show and create events that belong to the project. RLS is
-- unchanged: events remain owner/org-scoped; project_id is just a
-- filter/grouping dimension.
alter table public.events
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists events_project_id_idx
  on public.events (project_id) where project_id is not null;
