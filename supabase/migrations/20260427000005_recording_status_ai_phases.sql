-- Add AI-phase statuses on recordings -----------------------------------------
-- 'processing' = AI summarize call is in flight (or the user is mid-edit).
-- 'processed'  = AI step completed (or user manually marked it done).
--
-- Postgres requires ALTER TYPE ADD VALUE to run outside a transaction; the
-- supabase CLI handles that automatically per-statement.
alter type public.recording_status add value if not exists 'processing';
alter type public.recording_status add value if not exists 'processed';
