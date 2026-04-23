import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFamilies } from "@/lib/query-keys";
import * as service from "@/lib/services/events";
import type {
  EventRow,
  EventInsert,
  EventUpdate,
  EventParticipant,
  EventRsvpStatus,
} from "@/lib/types/domain";
import { useOrgScope, assertOrgScope } from "./useOrgScope";

export function useEvents(range?: { from: string; to: string }) {
  const scope = useOrgScope();
  return useQuery<EventRow[]>({
    queryKey: queryKeys.events(scope.organizationId ?? "", range),
    queryFn: () => service.listEvents(scope.organizationId!, range),
    enabled: scope.enabled,
  });
}

export function useEvent(eventId: string | null | undefined) {
  return useQuery<EventRow | null>({
    queryKey: queryKeys.event(eventId ?? ""),
    queryFn: () => service.getEvent(eventId!),
    enabled: !!eventId,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: Omit<EventInsert, "organization_id" | "owner_id">) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createEvent({
        ...input,
        organization_id: organizationId,
        owner_id: userId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allEvents(scope.organizationId),
        });
      }
    },
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ eventId, patch }: { eventId: string; patch: EventUpdate }) =>
      service.updateEvent(eventId, patch),
    onMutate: async ({ eventId, patch }) => {
      await qc.cancelQueries({ queryKey: queryKeys.event(eventId) });
      const previous = qc.getQueryData<EventRow>(queryKeys.event(eventId));
      if (previous) {
        qc.setQueryData<EventRow>(queryKeys.event(eventId), {
          ...previous,
          ...patch,
        } as EventRow);
      }
      return { previous };
    },
    onError: (_err, { eventId }, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.event(eventId), ctx.previous);
    },
    onSettled: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allEvents(scope.organizationId),
        });
      }
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (eventId: string) => service.deleteEvent(eventId),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allEvents(scope.organizationId),
        });
      }
    },
  });
}

// Participants --------------------------------------------------------------

export function useEventParticipants(eventId: string | null | undefined) {
  return useQuery<EventParticipant[]>({
    queryKey: queryKeys.eventParticipants(eventId ?? ""),
    queryFn: () => service.listEventParticipants(eventId!),
    enabled: !!eventId,
  });
}

export function useAddEventParticipants() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, userIds }: { eventId: string; userIds: string[] }) =>
      service.addEventParticipants(eventId, userIds),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.eventParticipants(vars.eventId) });
    },
  });
}

export function useRemoveEventParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, userId }: { eventId: string; userId: string }) =>
      service.removeEventParticipant(eventId, userId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.eventParticipants(vars.eventId) });
    },
  });
}

export function useUpdateRsvp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eventId,
      userId,
      status,
    }: {
      eventId: string;
      userId: string;
      status: EventRsvpStatus;
    }) => service.updateRsvp(eventId, userId, status),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.eventParticipants(vars.eventId) });
    },
  });
}
