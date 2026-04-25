import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as service from "@/lib/services/event-calendars";
import type { EventCalendar } from "@/lib/types/domain";
import { useOrgScope, assertOrgScope } from "./useOrgScope";

const KEY = (orgId: string, userId: string) =>
  ["event-calendars", orgId, userId] as const;

export function useEventCalendars() {
  const scope = useOrgScope();
  return useQuery<EventCalendar[]>({
    queryKey: KEY(scope.organizationId ?? "", scope.userId ?? ""),
    queryFn: () =>
      service.listEventCalendars(scope.organizationId!, scope.userId!),
    enabled: scope.enabled,
  });
}

export function useCreateEventCalendar() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: { name: string; emoji?: string; color?: string }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createEventCalendar({
        ...input,
        organization_id: organizationId,
        owner_id: userId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId && scope.userId) {
        qc.invalidateQueries({
          queryKey: KEY(scope.organizationId, scope.userId),
        });
      }
    },
  });
}

export function useUpdateEventCalendar() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({
      calendarId,
      patch,
    }: {
      calendarId: string;
      patch: Partial<
        Pick<EventCalendar, "name" | "emoji" | "color" | "sort_order">
      >;
    }) => service.updateEventCalendar(calendarId, patch),
    onSuccess: () => {
      if (scope.organizationId && scope.userId) {
        qc.invalidateQueries({
          queryKey: KEY(scope.organizationId, scope.userId),
        });
      }
      qc.invalidateQueries({ queryKey: ["task-lists"] });
    },
  });
}

export function useArchiveEventCalendar() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (calendarId: string) =>
      service.archiveEventCalendar(calendarId),
    onSuccess: () => {
      if (scope.organizationId && scope.userId) {
        qc.invalidateQueries({
          queryKey: KEY(scope.organizationId, scope.userId),
        });
      }
    },
  });
}

/** Bi-directional link between a calendar and a task list. */
export function useLinkCalendarToList() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: { calendarId: string; taskListId: string | null }) =>
      service.linkCalendarToList(input.calendarId, input.taskListId),
    onSuccess: () => {
      if (scope.organizationId && scope.userId) {
        qc.invalidateQueries({
          queryKey: KEY(scope.organizationId, scope.userId),
        });
      }
      qc.invalidateQueries({ queryKey: ["task-lists"] });
    },
  });
}
