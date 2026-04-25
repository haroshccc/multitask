-- =============================================================================
-- Phase 6א — Add 'recording' status to recording_status enum.
-- =============================================================================
-- 'recording' = the row exists but the audio file isn't closed yet (multipart
--   upload in progress). Transitions to 'uploaded' when CompleteMultipartUpload
--   returns ok.
--
-- Must live in its own migration: Postgres forbids using a freshly-added enum
-- value in the same transaction that added it. Splitting prevents the next
-- migration (and any future column default that references 'recording') from
-- tripping that rule.
-- =============================================================================

alter type public.recording_status add value if not exists 'recording' before 'uploaded';
