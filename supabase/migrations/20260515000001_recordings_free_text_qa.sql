-- Persistent history of free-text Q&A pairs from the recording AI Insights
-- "שאלה חופשית" tab. Previously the response lived only in React local
-- state and vanished on tab switch / refresh / next question.
alter table public.recordings
  add column if not exists free_text_qa jsonb not null default '[]'::jsonb;

comment on column public.recordings.free_text_qa is
  'Array of {question, answer, created_at} pairs from the AI Insights "שאלה חופשית" tab. Persisted so the user can ask multiple questions and keep the full history visible across refreshes / tab switches.';
