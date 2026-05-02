-- =============================================================================
-- Phase 8.2 — AI-generated dashboard briefs (Daily / Weekly / Monthly).
--
-- One row per (user, organization, view, anchor). Cached so a brief generated
-- in the morning is served instantly the rest of the day for the same period;
-- a manual "🔄 רענן" button re-runs the edge function and overwrites the row.
--
-- Phase 8.3 will add `proposals[]` and `proposal_decisions{}` to the same row
-- (already present below — the schema is forward-compatible). The 8.2 edge
-- function ignores those columns; the 8.3 function fills them.
-- =============================================================================

create table if not exists public.daily_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,

  -- Period definition — matches the front-end `useDateRange` shape.
  view text not null check (view in ('day', 'week', 'month')),
  anchor date not null,         -- yyyy-mm-dd start of the period

  -- 8.2 output: structured analysis of the period.
  output jsonb not null,        -- { summary, people_summary[], recordings_digest, productive_hours_insight, recommendations[] }

  -- 8.3 output (filled later): actionable proposals + per-proposal decisions.
  proposals jsonb not null default '[]'::jsonb,           -- [{ id, kind, payload, reason }]
  proposal_decisions jsonb not null default '{}'::jsonb,  -- { proposal_id: { state: 'approved'|'dismissed'|'edited', applied_at?, applied_target_id? } }

  -- Bookkeeping.
  generated_at timestamptz not null default now(),
  model text,                                              -- 'claude-sonnet-4-6' etc — useful for cost analysis
  input_token_count int,
  output_token_count int,

  unique (user_id, organization_id, view, anchor)
);

-- Lookup pattern: load the latest brief for a (user, view, anchor) tuple.
create index if not exists daily_briefs_user_view_anchor_idx
  on public.daily_briefs (user_id, view, anchor desc);

-- =============================================================================
-- RLS — strictly per-user. Service role (used by edge function) bypasses RLS.
-- =============================================================================
alter table public.daily_briefs enable row level security;

drop policy if exists daily_briefs_select on public.daily_briefs;
create policy daily_briefs_select
  on public.daily_briefs
  for select
  using (auth.uid() = user_id);

drop policy if exists daily_briefs_insert on public.daily_briefs;
create policy daily_briefs_insert
  on public.daily_briefs
  for insert
  with check (auth.uid() = user_id);

drop policy if exists daily_briefs_update on public.daily_briefs;
create policy daily_briefs_update
  on public.daily_briefs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists daily_briefs_delete on public.daily_briefs;
create policy daily_briefs_delete
  on public.daily_briefs
  for delete
  using (auth.uid() = user_id);

-- Touch updated_at-style helpers aren't needed — `generated_at` is rewritten
-- on every regenerate via UPSERT, and the row is immutable apart from the
-- 8.3 proposal_decisions column which the API patches explicitly.
