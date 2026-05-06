-- =============================================================================
-- Multitask — org type ('business'|'family'|'personal') + email invite tokens
-- =============================================================================

-- 1. Enum for org type --------------------------------------------------------
do $$ begin
  create type organization_type as enum ('business', 'family', 'personal');
exception when duplicate_object then null; end $$;

-- 2. Add type column to organizations -----------------------------------------
alter table public.organizations
  add column if not exists org_type organization_type not null default 'business';

-- 3. Email invite tokens table ------------------------------------------------
create table if not exists public.org_invites (
  id            uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invited_by    uuid not null references auth.users(id) on delete cascade,
  email         text not null,
  role          organization_member_role not null default 'member',
  token         text not null unique default encode(gen_random_bytes(32), 'hex'),
  accepted_at   timestamptz,
  expires_at    timestamptz not null default (now() + interval '7 days'),
  created_at    timestamptz not null default now()
);

create index if not exists org_invites_org_idx   on public.org_invites(organization_id);
create index if not exists org_invites_email_idx on public.org_invites(email);
create index if not exists org_invites_token_idx on public.org_invites(token);

-- 4. RLS on org_invites -------------------------------------------------------
alter table public.org_invites enable row level security;

-- Members of the org can see pending invites for that org
create policy "org members can view invites"
  on public.org_invites for select
  using (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

-- Org owners/admins can insert invites
create policy "org owners can create invites"
  on public.org_invites for insert
  with check (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- Only the inviter or org owner can delete (revoke) an invite
create policy "org owners can delete invites"
  on public.org_invites for delete
  using (
    invited_by = auth.uid()
    or organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- 5. RPC: accept an invite by token -------------------------------------------
create or replace function public.accept_org_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invite   public.org_invites;
  v_user_id  uuid := auth.uid();
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_invite
  from public.org_invites
  where token = p_token
    and accepted_at is null
    and expires_at > now();

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_expired_token');
  end if;

  -- Insert member (ignore if already a member)
  insert into public.organization_members(organization_id, user_id, role)
  values (v_invite.organization_id, v_user_id, v_invite.role)
  on conflict (organization_id, user_id) do nothing;

  -- Mark invite as accepted
  update public.org_invites set accepted_at = now() where id = v_invite.id;

  return jsonb_build_object(
    'ok', true,
    'organization_id', v_invite.organization_id
  );
end;
$$;

-- 6. RPC: create org with type (extends existing pattern) ---------------------
create or replace function public.create_organization_with_type(
  p_name               text,
  p_org_type           organization_type default 'business',
  p_join_password      text default null,
  p_suggested_email_domain text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_org_id  uuid;
  v_user_id uuid := auth.uid();
  v_hash    text;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if p_join_password is not null and length(p_join_password) >= 4 then
    v_hash := crypt(p_join_password, gen_salt('bf'));
  end if;

  insert into public.organizations(name, org_type, join_password_hash, suggested_email_domain, created_by)
  values (p_name, p_org_type, v_hash, p_suggested_email_domain, v_user_id)
  returning id into v_org_id;

  insert into public.organization_members(organization_id, user_id, role)
  values (v_org_id, v_user_id, 'owner');

  return jsonb_build_object('ok', true, 'organization_id', v_org_id);
end;
$$;

-- 7. RPC: get pending invites for a token (pre-auth, for invite landing page) --
create or replace function public.get_invite_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  select i.id, i.email, i.role, i.expires_at,
         o.name as org_name, o.org_type
  into v_row
  from public.org_invites i
  join public.organizations o on o.id = i.organization_id
  where i.token = p_token
    and i.accepted_at is null
    and i.expires_at > now();

  if not found then
    return jsonb_build_object('valid', false);
  end if;

  return jsonb_build_object(
    'valid',    true,
    'email',    v_row.email,
    'role',     v_row.role,
    'org_name', v_row.org_name,
    'org_type', v_row.org_type,
    'expires_at', v_row.expires_at
  );
end;
$$;
