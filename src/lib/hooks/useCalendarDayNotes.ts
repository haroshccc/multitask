import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as service from "@/lib/services/calendar-day-notes";
import type { CalendarDayNote } from "@/lib/types/domain";
import { useOrgScope, assertOrgScope } from "./useOrgScope";

const KEY = (orgId: string, userId: string, from: string, to: string) =>
  ["calendar-day-notes", orgId, userId, from, to] as const;

const FAMILY = (orgId: string, userId: string) =>
  ["calendar-day-notes", orgId, userId] as const;

/**
 * Fetch all per-day notes within `[from, to]` (inclusive `yyyy-mm-dd`).
 * Returns a `Map<dateKey, body>` for quick lookup from each calendar view.
 */
export function useCalendarDayNotes(from: string, to: string) {
  const scope = useOrgScope();
  const query = useQuery<CalendarDayNote[]>({
    queryKey: KEY(scope.organizationId ?? "", scope.userId ?? "", from, to),
    queryFn: () =>
      service.listNotesInRange(
        scope.organizationId!,
        scope.userId!,
        from,
        to
      ),
    enabled: scope.enabled,
  });

  const map = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of query.data ?? []) m.set(n.date, n.body);
    return m;
  }, [query.data]);

  return { ...query, notesByDate: map };
}

/** Save (insert-or-replace) a note's body. Empty body deletes instead. */
export function useUpsertDayNote() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: async (input: { date: string; body: string }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      const trimmed = input.body.trim();
      if (trimmed.length === 0) {
        await service.deleteDayNote(organizationId, userId, input.date);
        return null;
      }
      return service.upsertDayNote({
        organization_id: organizationId,
        user_id: userId,
        date: input.date,
        body: trimmed,
      });
    },
    onSuccess: () => {
      if (scope.organizationId && scope.userId) {
        qc.invalidateQueries({
          queryKey: FAMILY(scope.organizationId, scope.userId),
        });
      }
    },
  });
}

export function useDeleteDayNote() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: async (date: string) => {
      const { organizationId, userId } = assertOrgScope(scope);
      await service.deleteDayNote(organizationId, userId, date);
    },
    onSuccess: () => {
      if (scope.organizationId && scope.userId) {
        qc.invalidateQueries({
          queryKey: FAMILY(scope.organizationId, scope.userId),
        });
      }
    },
  });
}
