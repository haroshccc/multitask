-- Fix: the "frameworks: read" SELECT policy used user_can_read_framework(id),
-- which re-queries the frameworks table for the row's own id. During
-- INSERT ... RETURNING (PostgREST `?select=*`), that self-referential lookup
-- cannot see the in-flight new row, so RETURNING is denied → 403 → the insert
-- rolls back. This blocked creating any framework ("צרי מסגרת חדשה" did nothing).
--
-- Rewrite the policy to evaluate the row's columns directly (owner_id, id),
-- with the share check against the separate framework_shares table. Same read
-- semantics (owner / super-admin / shared-with-user), but the NEW row now
-- satisfies the policy during RETURNING. Child tables are unaffected because
-- their read policies look up the PARENT frameworks row, which already exists.
drop policy if exists "frameworks: read" on public.frameworks;
create policy "frameworks: read" on public.frameworks
for select
using (
  owner_id = auth.uid()
  or user_is_super_admin(auth.uid())
  or exists (
    select 1 from public.framework_shares s
    where s.framework_id = frameworks.id
      and s.user_id = auth.uid()
  )
);
