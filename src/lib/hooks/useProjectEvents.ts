import { useQuery } from "@tanstack/react-query";
import * as service from "@/lib/services/project-events";
import type { EventRow } from "@/lib/types/domain";

/**
 * Project-scoped calendar events. Returns events where `events.project_id =
 * projectId` inside the given window. Keyed separately from the global
 * `useEvents` cache so it can be invalidated independently; the event/meeting
 * mutations already invalidate the whole `["events", orgId]` family, which
 * does NOT collide with this key — so to stay fresh after a meeting save we
 * still rely on React Query's window refetch (staleTime default) plus an
 * explicit key shape that includes the range.
 */
export function useProjectEvents(
  projectId: string | null | undefined,
  range?: { from: string; to: string }
) {
  return useQuery<EventRow[]>({
    queryKey: ["project-events", projectId ?? "", range ?? {}],
    queryFn: () => service.listProjectEvents(projectId!, range),
    enabled: !!projectId,
  });
}
