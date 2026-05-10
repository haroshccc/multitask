-- Gantt baseline snapshots: capture scheduled_at + duration_minutes per task
-- at a named point in time, so users can compare planned vs. actual.

CREATE TABLE IF NOT EXISTS gantt_baselines (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gantt_baseline_tasks (
  id              uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_id     uuid     NOT NULL REFERENCES gantt_baselines(id) ON DELETE CASCADE,
  task_id         uuid     NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  scheduled_at    timestamptz,
  duration_minutes integer,
  UNIQUE(baseline_id, task_id)
);

ALTER TABLE gantt_baselines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE gantt_baseline_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "baselines_owner_all" ON gantt_baselines
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "baseline_tasks_follow_baseline" ON gantt_baseline_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM gantt_baselines b
      WHERE b.id = baseline_id AND b.owner_id = auth.uid()
    )
  );
