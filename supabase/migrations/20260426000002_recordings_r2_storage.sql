-- =============================================================================
-- Phase 6א — Recordings ↔ Cloudflare R2 storage.
-- =============================================================================
-- Architecture: SPEC §8 + §28 #9 + Changelog "2026-04-24 — החלטת ארכיטקטורה".
--
-- Renames `storage_path` → `storage_key` (semantically correct: object key,
-- not file-system path), adds `storage_provider` so legacy Supabase-Storage
-- rows can coexist with new R2 rows, and tracks active multipart uploads via
-- `multipart_upload_id` (NULL except while the recording is in progress).
--
-- The recordings table is empty in production at the time of this migration
-- (recordings UI is built in phase 6ב); existing rows in dev environments
-- that came from the QuickCapture FAB land in 'supabase' provider via the
-- default-then-update sequence below.
-- =============================================================================

create type public.storage_provider as enum ('supabase', 'r2');

alter table public.recordings rename column storage_path to storage_key;

-- Default any existing rows to 'supabase' (legacy QuickCapture path), then
-- flip the column default to 'r2' so future rows go to R2 unless overridden.
alter table public.recordings
  add column storage_provider public.storage_provider not null default 'supabase';

alter table public.recordings
  alter column storage_provider set default 'r2';

alter table public.recordings
  add column multipart_upload_id text;

-- Partial index for the "abort stale multiparts" cleanup path (Cloudflare
-- runs a 7-day default abort rule on the bucket, so this is mostly for
-- application-level visibility into in-flight uploads).
create index recordings_multipart_active_idx on public.recordings(created_at)
  where multipart_upload_id is not null;

-- Same column rename in task_attachments to keep storage vocabulary consistent
-- across all storage-bearing tables. Also nullable, so no data backfill.
alter table public.task_attachments rename column storage_path to storage_key;

alter table public.task_attachments
  add column storage_provider public.storage_provider;
