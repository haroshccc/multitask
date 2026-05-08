-- Add FK from task_edits.edited_by → profiles(id) so PostgREST can join
-- profiles directly without going through auth.users.
ALTER TABLE task_edits
  ADD CONSTRAINT task_edits_edited_by_profiles_fkey
  FOREIGN KEY (edited_by) REFERENCES profiles(id) ON DELETE SET NULL;
