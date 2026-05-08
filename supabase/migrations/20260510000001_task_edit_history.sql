-- ============================================================
-- task_edits — audit log for task field changes
-- ============================================================

CREATE TABLE task_edits (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  org_id     uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  edited_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  edited_at  timestamptz NOT NULL DEFAULT now(),
  changes    jsonb       NOT NULL  -- { "field": { "from": ..., "to": ... } }
);

CREATE INDEX task_edits_task_id_idx ON task_edits(task_id, edited_at DESC);
CREATE INDEX task_edits_org_id_idx  ON task_edits(org_id);

-- RLS: visible to any org member
ALTER TABLE task_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_edits_select" ON task_edits
  FOR SELECT USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "task_edits_insert_trigger" ON task_edits
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- Trigger: record field changes on task UPDATE
-- ============================================================

CREATE OR REPLACE FUNCTION record_task_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_changes jsonb := '{}'::jsonb;
  v_editor  uuid  := auth.uid();
BEGIN
  IF OLD.title IS DISTINCT FROM NEW.title THEN
    v_changes := v_changes || jsonb_build_object('title', jsonb_build_object('from', OLD.title, 'to', NEW.title));
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  IF OLD.urgency IS DISTINCT FROM NEW.urgency THEN
    v_changes := v_changes || jsonb_build_object('urgency', jsonb_build_object('from', OLD.urgency, 'to', NEW.urgency));
  END IF;
  IF OLD.assignee_user_id IS DISTINCT FROM NEW.assignee_user_id THEN
    v_changes := v_changes || jsonb_build_object('assignee_user_id', jsonb_build_object('from', OLD.assignee_user_id, 'to', NEW.assignee_user_id));
  END IF;
  IF OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at THEN
    v_changes := v_changes || jsonb_build_object('scheduled_at', jsonb_build_object('from', OLD.scheduled_at, 'to', NEW.scheduled_at));
  END IF;
  IF OLD.deadline_at IS DISTINCT FROM NEW.deadline_at THEN
    v_changes := v_changes || jsonb_build_object('deadline_at', jsonb_build_object('from', OLD.deadline_at, 'to', NEW.deadline_at));
  END IF;
  IF OLD.description IS DISTINCT FROM NEW.description THEN
    v_changes := v_changes || jsonb_build_object('description', jsonb_build_object('from', OLD.description, 'to', NEW.description));
  END IF;
  IF OLD.recurrence_rule IS DISTINCT FROM NEW.recurrence_rule THEN
    v_changes := v_changes || jsonb_build_object('recurrence_rule', jsonb_build_object('from', OLD.recurrence_rule, 'to', NEW.recurrence_rule));
  END IF;
  IF OLD.tags IS DISTINCT FROM NEW.tags THEN
    v_changes := v_changes || jsonb_build_object('tags', jsonb_build_object('from', OLD.tags, 'to', NEW.tags));
  END IF;

  IF v_changes <> '{}'::jsonb THEN
    INSERT INTO task_edits (task_id, org_id, edited_by, changes)
    VALUES (NEW.id, NEW.organization_id, v_editor, v_changes);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER task_edit_history
  AFTER UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION record_task_edit();
