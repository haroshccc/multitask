import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getOrganization,
  listUserOrganizations,
  updateOrganization,
  createOrganizationWithType,
  listOrgInvites,
  createInvite,
  revokeInvite,
  acceptInvite,
  removeMember,
  updateMemberRole,
  type OrgType,
} from "@/lib/services/organizations";

export function useOrganization(orgId: string | null) {
  return useQuery({
    queryKey: ["organization", orgId],
    queryFn: () => getOrganization(orgId!),
    enabled: !!orgId,
  });
}

export function useUserOrganizations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-organizations", user?.id],
    queryFn: () => listUserOrganizations(user!.id),
    enabled: !!user,
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, updates }: { orgId: string; updates: { name?: string; org_type?: OrgType } }) =>
      updateOrganization(orgId, updates),
    onSuccess: (_data, { orgId }) => {
      qc.invalidateQueries({ queryKey: ["organization", orgId] });
      qc.invalidateQueries({ queryKey: ["user-organizations"] });
    },
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  const { user, refreshProfile } = useAuth();
  return useMutation({
    mutationFn: ({
      name,
      orgType,
      joinPassword,
      suggestedEmailDomain,
    }: {
      name: string;
      orgType: OrgType;
      joinPassword?: string;
      suggestedEmailDomain?: string;
    }) => createOrganizationWithType(name, orgType, joinPassword, suggestedEmailDomain),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["user-organizations", user?.id] });
      await refreshProfile();
    },
  });
}

// ---- Invites ----------------------------------------------------------------

export function useOrgInvites(orgId: string | null) {
  return useQuery({
    queryKey: ["org-invites", orgId],
    queryFn: () => listOrgInvites(orgId!),
    enabled: !!orgId,
  });
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orgId,
      email,
      role,
    }: {
      orgId: string;
      email: string;
      role?: "member" | "admin";
    }) => createInvite(orgId, email, role),
    onSuccess: (_data, { orgId }) => {
      qc.invalidateQueries({ queryKey: ["org-invites", orgId] });
    },
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ inviteId, orgId }: { inviteId: string; orgId: string }) =>
      revokeInvite(inviteId),
    onSuccess: (_data, { orgId }) => {
      qc.invalidateQueries({ queryKey: ["org-invites", orgId] });
    },
  });
}

export function useAcceptInvite() {
  const { refreshProfile } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => acceptInvite(token),
    onSuccess: async (result) => {
      if (result.ok && result.organization_id) {
        await refreshProfile();
        qc.invalidateQueries({ queryKey: ["user-organizations"] });
      }
    },
  });
}

// ---- Member management ------------------------------------------------------

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, userId }: { orgId: string; userId: string }) =>
      removeMember(orgId, userId),
    onSuccess: (_data, { orgId }) => {
      qc.invalidateQueries({ queryKey: ["org-members", orgId] });
    },
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orgId,
      userId,
      role,
    }: {
      orgId: string;
      userId: string;
      role: "owner" | "admin" | "member";
    }) => updateMemberRole(orgId, userId, role),
    onSuccess: (_data, { orgId }) => {
      qc.invalidateQueries({ queryKey: ["org-members", orgId] });
    },
  });
}
