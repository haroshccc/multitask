-- Per-project, per-entity hidden-columns config for the configurable tables.
-- A namespaced map { task: [...ids], meeting: [...], payment: [...] } where each
-- id is either a fixed column key or a custom field id. Hiding only affects the
-- project tables (tasks / meetings / payments) — NOT the global Gantt, which
-- reads the field definitions directly. Additive + backward-compatible.
alter table public.projects
  add column if not exists entity_hidden_columns jsonb not null default '{}'::jsonb;
