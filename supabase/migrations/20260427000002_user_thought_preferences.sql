-- User thought preferences ----------------------------------------------------
-- Per-user toggles for the Thoughts surface. Currently a single boolean —
-- auto-transcribe newly recorded thoughts — but laid out as a row so we can
-- add more thought-screen knobs without a schema change each time.

create table public.user_thought_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  auto_transcribe_recorded_thoughts boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_thought_preferences enable row level security;

create policy "user_thought_preferences: self"
  on public.user_thought_preferences for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Match the maintained_at trigger pattern used elsewhere in the schema.
create trigger user_thought_preferences_set_updated_at
  before update on public.user_thought_preferences
  for each row execute function public.set_updated_at();
