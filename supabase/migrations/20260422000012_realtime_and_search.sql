-- =============================================================================
-- Multitask — 12. Realtime publication + search helpers
-- =============================================================================

-- Realtime: add core tables to supabase_realtime publication --------------------

do $$
declare
  t text;
  tbls text[] := array[
    'tasks',
    'task_lists',
    'task_dependencies',
    'time_entries',
    'task_attachments',
    'events',
    'event_participants',
    'recordings',
    'recording_speakers',
    'recording_tasks',
    'thoughts',
    'thought_lists',
    'thought_list_assignments',
    'thought_processings',
    'projects',
    'project_expenses',
    'questions',
    'notifications',
    'shares',
    'organization_members'
  ];
begin
  foreach t in array tbls loop
    execute format('alter publication supabase_realtime add table public.%I;', t);
  exception when duplicate_object then null;
  end loop;
exception when others then null;
end $$;

-- Full-text search over tasks + thoughts + projects ---------------------------

-- tsvector column for tasks (weighted title >> description)
alter table public.tasks add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) stored;
create index if not exists tasks_search_tsv_idx on public.tasks using gin(search_tsv);

alter table public.thoughts add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(ai_generated_title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(text_content, '')), 'B')
  ) stored;
create index if not exists thoughts_search_tsv_idx on public.thoughts using gin(search_tsv);

alter table public.projects add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) stored;
create index if not exists projects_search_tsv_idx on public.projects using gin(search_tsv);

alter table public.recordings add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(transcript_text, '')), 'C')
  ) stored;
create index if not exists recordings_search_tsv_idx on public.recordings using gin(search_tsv);

-- Global search RPC: returns union of hits across entities -------------------

create or replace function public.global_search(
  p_query text,
  p_organization_id uuid,
  p_limit integer default 20
)
returns table (
  entity_type text,
  id uuid,
  title text,
  snippet text,
  score real
)
language sql
stable
security definer
set search_path = public
as $$
  with query as (select plainto_tsquery('simple', p_query) as q),
       tasks_hits as (
         select 'task'::text as entity_type, t.id, t.title as title,
                left(coalesce(t.description, ''), 120) as snippet,
                ts_rank(t.search_tsv, query.q) as score
           from public.tasks t, query
           where t.organization_id = p_organization_id
             and t.search_tsv @@ query.q
           order by score desc limit p_limit
       ),
       thoughts_hits as (
         select 'thought'::text, th.id, coalesce(th.ai_generated_title, left(th.text_content, 60)),
                left(coalesce(th.text_content, ''), 120),
                ts_rank(th.search_tsv, query.q)
           from public.thoughts th, query
           where th.organization_id = p_organization_id
             and th.search_tsv @@ query.q
           order by ts_rank(th.search_tsv, query.q) desc limit p_limit
       ),
       projects_hits as (
         select 'project'::text, p.id, p.name,
                left(coalesce(p.description, ''), 120),
                ts_rank(p.search_tsv, query.q)
           from public.projects p, query
           where p.organization_id = p_organization_id
             and p.search_tsv @@ query.q
           order by ts_rank(p.search_tsv, query.q) desc limit p_limit
       ),
       recordings_hits as (
         select 'recording'::text, r.id, coalesce(r.title, 'הקלטה'),
                left(coalesce(r.summary, r.transcript_text, ''), 120),
                ts_rank(r.search_tsv, query.q)
           from public.recordings r, query
           where r.organization_id = p_organization_id
             and r.search_tsv @@ query.q
           order by ts_rank(r.search_tsv, query.q) desc limit p_limit
       )
  select * from tasks_hits
  union all select * from thoughts_hits
  union all select * from projects_hits
  union all select * from recordings_hits
  order by score desc
  limit p_limit;
$$;

grant execute on function public.global_search(text, uuid, integer) to authenticated;
