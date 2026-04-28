-- Per-user customizable Claude prompts for recording AI processing.
-- Defaults are inlined in client + edge function code; this column only
-- holds user overrides. Each key maps to a free-text prompt fragment that
-- the summarize edge function splices into the system prompt.
--
-- Shape: { short_summary?: string, long_summary?: string,
--          whatsapp_message?: string, email?: string,
--          tasks?: string, events?: string }
-- Missing keys fall back to defaults; an empty string also falls back so
-- "Restore defaults" is just clearing the textarea.

alter table public.user_thought_preferences
  add column if not exists recording_ai_prompts jsonb not null default '{}'::jsonb;
