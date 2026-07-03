-- Quick-access project links: an external files-folder URL (e.g. Drive) and a
-- Canva presentation URL. Surfaced in the documents tab and the projects table.
alter table public.projects
  add column if not exists files_folder_url text,
  add column if not exists presentation_url text;
