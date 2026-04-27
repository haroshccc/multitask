-- Recording merge ------------------------------------------------------------
-- When the user splits a single conversation across two uploads, they can
-- merge them into one recording. Whichever they pick as "first" keeps its
-- audio and absorbs the other's transcript at the appropriate time offset.
-- The second row stays in the table but is marked `merged_into` (and its
-- audio is archived) so we never lose the original metadata trail.

alter table public.recordings
  add column if not exists merged_into uuid
    references public.recordings(id) on delete set null;

create index if not exists recordings_merged_into_idx
  on public.recordings(merged_into);
