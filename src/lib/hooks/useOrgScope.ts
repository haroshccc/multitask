import { useAuth } from "@/lib/auth/AuthContext";

/**
 * All queries are scoped to an organization. This hook guarantees a non-null
 * `organizationId` and `userId`, and exposes an `enabled` boolean for use with
 * React Query's `enabled` option — so hooks can suspend until the scope exists.
 *
 * Usage:
 *   const { organizationId, userId, enabled } = useOrgScope();
 *   useQuery({
 *     queryKey: queryKeys.tasks(organizationId ?? ""),
 *     queryFn: () => fetchTasks(organizationId!),
 *     enabled,
 *   });
 */
export function useOrgScope() {
  const { user, activeOrganizationId, loading } = useAuth();

  return {
    userId: user?.id ?? null,
    organizationId: activeOrganizationId,
    enabled: !loading && !!user && !!activeOrganizationId,
    loading,
  };
}

/**
 * Variant that throws if scope is not ready — use inside mutation handlers
 * where the caller has already verified `enabled`.
 */
export function assertOrgScope(scope: ReturnType<typeof useOrgScope>) {
  if (!scope.organizationId || !scope.userId) {
    throw new Error(
      "Organization scope not available. Ensure the component is mounted behind an auth guard."
    );
  }
  return { organizationId: scope.organizationId, userId: scope.userId };
}
