-- Free-text Q&A history on recordings.
-- Stored as a JSONB array of { question, answer, created_at } objects so the
-- recording detail panel can show every prior question/answer pair instead of
-- losing it on the next ask. The column was already applied to the remote
-- project via Supabase MCP; this file keeps the local schema in sync with git.

alter table public.recordings
  add column if not exists free_text_qa jsonb not null default '[]'::jsonb;
