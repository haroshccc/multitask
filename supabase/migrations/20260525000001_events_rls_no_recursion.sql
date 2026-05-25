-- Break the RLS recursion between events and event_participants.
--
-- Old `events: owner or shared or participant read` policy inlined
--   EXISTS (SELECT 1 FROM event_participants ep WHERE ep.event_id = events.id ...)
-- and event_participants' own policy inlined a SELECT against events. That
-- mutually-recursive call chain triggered "infinite recursion detected in
-- policy for relation events" on every INSERT ... RETURNING in the events
-- table (and on most reads where a participant join was involved).
--
-- Fix: extract the participant check into a SECURITY DEFINER function. The
-- function runs as the table owner and therefore bypasses RLS internally, so
-- the SELECT against event_participants no longer re-enters the
-- event_participants policy and the chain terminates.

create or replace function public.user_is_event_participant(
  p_event uuid,
  p_user uuid
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from event_participants ep
    where ep.event_id = p_event
      and ep.user_id = p_user
  );
$$;

grant execute on function public.user_is_event_participant(uuid, uuid) to authenticated, service_role;

drop policy if exists "events: owner or shared or participant read" on public.events;

create policy "events: owner or shared or participant read"
on public.events
for select
using (
  owner_id = auth.uid()
  or user_is_super_admin(auth.uid())
  or user_has_share('event'::share_entity_type, id, auth.uid())
  or user_is_event_participant(id, auth.uid())
);
