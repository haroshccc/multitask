import { supabase } from "@/lib/supabase/client";

export type OrgType = "business" | "family" | "personal";

export interface OrgDetails {
  id: string;
  name: string;
  org_type: OrgType;
  slug: string | null;
  created_by: string | null;
  created_at: string;
}

export interface OrgInvite {
  id: string;
  organization_id: string;
  invited_by: string;
  email: string;
  role: string;
  token: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface InviteInfo {
  valid: boolean;
  email?: string;
  role?: string;
  org_name?: string;
  org_type?: OrgType;
  expires_at?: string;
}

export async function getOrganization(orgId: string): Promise<OrgDetails> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, org_type, slug, created_by, created_at")
    .eq("id", orgId)
    .single();
  if (error) throw error;
  return data as OrgDetails;
}

export async function listUserOrganizations(userId: string): Promise<OrgDetails[]> {
  const { data: members, error: mErr } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId);
  if (mErr) throw mErr;
  const ids = (members ?? []).map((m) => m.organization_id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, org_type, slug, created_by, created_at")
    .in("id", ids)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as OrgDetails[];
}

export async function updateOrganization(
  orgId: string,
  updates: { name?: string; org_type?: OrgType }
) {
  const { error } = await supabase
    .from("organizations")
    .update(updates)
    .eq("id", orgId);
  if (error) throw error;
}

export async function createOrganizationWithType(
  name: string,
  orgType: OrgType,
  joinPassword?: string,
  suggestedEmailDomain?: string
) {
  const { data, error } = await supabase.rpc("create_organization_with_type", {
    p_name: name,
    p_org_type: orgType,
    p_join_password: joinPassword ?? null,
    p_suggested_email_domain: suggestedEmailDomain ?? null,
  });
  if (error) throw error;
  return data as { ok: boolean; organization_id?: string; error?: string };
}

// ---- Invites ----------------------------------------------------------------

export async function listOrgInvites(orgId: string): Promise<OrgInvite[]> {
  const { data, error } = await supabase
    .from("org_invites")
    .select("*")
    .eq("organization_id", orgId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrgInvite[];
}

export async function createInvite(
  orgId: string,
  email: string,
  role: "member" | "admin" = "member"
): Promise<OrgInvite> {
  const { data, error } = await supabase
    .from("org_invites")
    .insert({ organization_id: orgId, email: email.trim().toLowerCase(), role })
    .select()
    .single();
  if (error) throw error;
  return data as OrgInvite;
}

export async function revokeInvite(inviteId: string) {
  const { error } = await supabase.from("org_invites").delete().eq("id", inviteId);
  if (error) throw error;
}

export async function getInviteByToken(token: string): Promise<InviteInfo> {
  const { data, error } = await supabase.rpc("get_invite_by_token", { p_token: token });
  if (error) throw error;
  return data as InviteInfo;
}

export async function acceptInvite(
  token: string
): Promise<{ ok: boolean; organization_id?: string; error?: string }> {
  const { data, error } = await supabase.rpc("accept_org_invite", { p_token: token });
  if (error) throw error;
  return data as { ok: boolean; organization_id?: string; error?: string };
}

// ---- Member management ------------------------------------------------------

export async function removeMember(orgId: string, userId: string) {
  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", orgId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: "owner" | "admin" | "member"
) {
  const { error } = await supabase
    .from("organization_members")
    .update({ role })
    .eq("organization_id", orgId)
    .eq("user_id", userId);
  if (error) throw error;
}
