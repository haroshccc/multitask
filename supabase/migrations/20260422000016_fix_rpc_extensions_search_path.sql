-- =============================================================================
-- Multitask — 16. Fix: RPCs that call pgcrypto must include `extensions` in
-- their search_path. Supabase installs pgcrypto in the `extensions` schema,
-- not `public`, so `gen_salt()` and `crypt()` are unresolved without this.
-- =============================================================================

alter function public.create_organization_with_password(text, text, text)
  set search_path = public, extensions;

alter function public.join_organization_with_password(uuid, text)
  set search_path = public, extensions;
