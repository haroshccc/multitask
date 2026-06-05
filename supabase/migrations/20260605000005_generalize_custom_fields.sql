-- =============================================================================
-- Generalize the custom-columns system to any project entity (Phase 0 — DB).
-- Additive + backward-compatible: every existing definition becomes entity
-- 'task'; the legacy projects.column_order / column_labels keep driving the
-- task table unchanged. Meetings (and future payments) gain their own custom
-- columns via entity_type + project_meetings.custom_fields.
-- =============================================================================

-- 1. Entity-kind enum (extensible later)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'custom_field_entity') then
    create type public.custom_field_entity as enum ('task', 'meeting', 'payment');
  end if;
end $$;

-- 2. entity_type on the definitions table; default 'task' keeps every existing
--    field meaning identical.
alter table public.task_custom_fields
  add column if not exists entity_type public.custom_field_entity not null default 'task';

-- 3. Unique slug now scoped per entity_type as well.
alter table public.task_custom_fields
  drop constraint if exists task_custom_fields_project_id_field_key_key;
alter table public.task_custom_fields
  drop constraint if exists task_custom_fields_project_entity_field_key_key;
alter table public.task_custom_fields
  add constraint task_custom_fields_project_entity_field_key_key
  unique (project_id, entity_type, field_key);

-- 4. Per-row value bag on the meetings table.
alter table public.project_meetings
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

-- 5. Per-entity fixed-column config on projects (task config stays on the
--    legacy column_order / column_labels columns; these namespace the rest).
alter table public.projects
  add column if not exists entity_column_order  jsonb not null default '{}'::jsonb,
  add column if not exists entity_column_labels jsonb not null default '{}'::jsonb;
