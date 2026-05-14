-- Optional per-note text color for calendar day notes.
--
-- A calendar day note ("sticky note" at the top of a day cell) gets an
-- optional CSS color so the user can colour-code notes. Null keeps the
-- default muted ink color. Shared by the regular calendar and the Gantt
-- screen's calendar view (same `calendar_day_notes` table).

alter table public.calendar_day_notes
  add column if not exists text_color text;

comment on column public.calendar_day_notes.text_color is
  'Optional CSS color for the note text (e.g. #ef4444). Null = default muted ink color.';
