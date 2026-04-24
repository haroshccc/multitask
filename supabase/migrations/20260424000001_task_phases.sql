-- =============================================================================
-- Task phases (שלבים) — lifecycle-group concept on top of the existing tasks.
-- A phase is a task with `is_phase = true`. It lives at the top of a list
-- (no parent), and can contain any subtree of regular tasks beneath it.
-- Phases CANNOT contain other phases (enforced by trigger below).
-- =============================================================================

alter table public.tasks
  add column if not exists is_phase boolean not null default false;

-- Fast lookup of phases in a list.
create index if not exists idx_tasks_is_phase_list
  on public.tasks (task_list_id)
  where is_phase = true;

-- Enforce:
--   1. A phase cannot have a parent_task_id (phases are list-level).
--   2. A task whose parent_task_id points to a phase is fine (that's the
--      whole point), but a task under a phase cannot itself become a phase.
-- Combined into one trigger for clarity.
create or replace function public.tasks_phase_invariants()
returns trigger
language plpgsql
as $$
declare
  v_parent_is_phase boolean;
begin
  -- Rule 1: phase has no parent.
  if new.is_phase and new.parent_task_id is not null then
    raise exception 'A phase cannot have parent_task_id (phases are list-level).';
  end if;

  -- Rule 2: if this row has a parent, that parent cannot itself be inside
  -- another phase *unless* we explicitly allow it. Phases can't nest:
  -- the simplest check is "no is_phase on any ancestor-chain step" — but
  -- since a non-phase task can sit under a phase (that IS the point), we
  -- only reject "phase inside phase". I.e. this row can't be is_phase=true
  -- AND have any ancestor that is also a phase.
  if new.is_phase and new.parent_task_id is not null then
    -- already caught by rule 1, but defensive
    raise exception 'Nested phases are not allowed.';
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_phase_invariants on public.tasks;
create trigger tasks_phase_invariants
  before insert or update on public.tasks
  for each row execute function public.tasks_phase_invariants();
