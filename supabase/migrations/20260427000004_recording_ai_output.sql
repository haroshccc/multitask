-- Recording AI processing ----------------------------------------------------
-- The summarize edge function fills `ai_output` with structured proposals
-- (summary / whatsapp / email / tasks / events / questions). The shape is
-- left intentionally untyped at the DB level so we can iterate on the prompt
-- without schema migrations; the frontend reads it through a local TS type.

alter table public.recordings
  add column if not exists ai_output jsonb;

alter table public.recordings
  add column if not exists ai_output_at timestamptz;

-- Status flag: NULL = never processed, 'pending' = function in flight,
-- 'ready' = ai_output populated, 'error' = call failed (error stored in
-- the existing recordings.error_message column).
alter table public.recordings
  add column if not exists ai_status text;
