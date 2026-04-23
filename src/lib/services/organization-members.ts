import { supabase } from "@/lib/supabase/client";
import type { OrganizationMember, Profile } from "@/lib/types/domain";

export interface OrgMemberWithProfile {
  membership: OrganizationMember;
  profile: Profile | null;
}

/**
 * Lists all members of an organization with their profile info denormalized.
 * Used for assignee pickers, approver pickers, and list-share pickers.
 */
export async function listOrgMembers(
  organizationId: string
): Promise<OrgMemberWithProfile[]> {
  const { data: members, error: mErr } = await supabase
    .from("organization_members")
    .select("*")
    .eq("organization_id", organizationId);
  if (mErr) throw mErr;

  const userIds = (members ?? []).map((m) => m.user_id);
  if (userIds.length === 0) return [];

  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("*")
    .in("id", userIds);
  if (pErr) throw pErr;

  const profileById = new Map<string, Profile>();
  (profiles ?? []).forEach((p) => profileById.set(p.id, p));

  return (members ?? []).map((m) => ({
    membership: m,
    profile: profileById.get(m.user_id) ?? null,
  }));
}
