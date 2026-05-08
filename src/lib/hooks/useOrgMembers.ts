import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import * as service from "@/lib/services/organization-members";
import type { OrgMemberWithProfile } from "@/lib/services/organization-members";
import { useOrgScope } from "./useOrgScope";

export type { OrgMemberWithProfile };

export function useOrgMembers() {
  const scope = useOrgScope();
  return useQuery<OrgMemberWithProfile[]>({
    queryKey: queryKeys.organizationMembers(scope.organizationId ?? ""),
    queryFn: () => service.listOrgMembers(scope.organizationId!),
    enabled: scope.enabled,
  });
}

/** Fetch members of any org by explicit id (for delegation org→user picker). */
export function useOrgMembersForOrg(orgId: string | null) {
  return useQuery<OrgMemberWithProfile[]>({
    queryKey: queryKeys.organizationMembers(orgId ?? ""),
    queryFn: () => service.listOrgMembers(orgId!),
    enabled: !!orgId,
  });
}
