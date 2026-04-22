-- =============================================================================
-- Multitask — 14. Seed
-- =============================================================================
-- Note: this migration runs once when the schema is first applied. It promotes
-- the bootstrap user to super admin AFTER their auth.users row exists.
-- If the user hasn't signed up yet, the trigger on auth.users will create a
-- profile row the first time they log in; we then upgrade it to super admin.
-- =============================================================================

do $$
declare
  v_super_admin_email text := 'harosh.ccc@gmail.com';
  v_user_id uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower(v_super_admin_email);

  if v_user_id is not null then
    insert into public.profiles (id, is_super_admin)
      values (v_user_id, true)
      on conflict (id) do update set is_super_admin = true;
  end if;
  -- If the user doesn't exist yet, a separate post-signup migration can
  -- promote them. Alternatively run this statement manually in SQL editor
  -- after the user signs in for the first time.
end $$;

-- Convenience: function super admins can call after signup to promote themselves
-- if their email matches the allow-list. Kept narrow and auditable.

create or replace function public.promote_self_to_super_admin_if_allowed()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_allowlist text[] := array['harosh.ccc@gmail.com'];
begin
  if auth.uid() is null then return false; end if;

  select email into v_email from auth.users where id = auth.uid();
  if v_email is null or not (lower(v_email) = any(select lower(x) from unnest(v_allowlist) as x)) then
    return false;
  end if;

  update public.profiles set is_super_admin = true where id = auth.uid();
  return true;
end;
$$;

grant execute on function public.promote_self_to_super_admin_if_allowed() to authenticated;
