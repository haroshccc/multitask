import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as service from "@/lib/services/project-meetings";
import { useOrgScope, assertOrgScope } from "./useOrgScope";
import { queryFamilies } from "@/lib/query-keys";
export type { ProjectMeeting } from "@/lib/services/project-meetings";

const key = (projectId: string) => ["project-meetings", projectId];

export function useProjectMeetings(projectId: string | null | undefined) {
  return useQuery({
    queryKey: key(projectId ?? ""),
    queryFn: () => service.listProjectMeetings(projectId!),
    enabled: !!projectId,
  });
}

export function useCreateProjectMeeting() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: {
      projectId: string;
      title?: string;
      meeting_at?: string | null;
    }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createProjectMeeting({
        organization_id: organizationId,
        owner_id: userId,
        project_id: input.projectId,
        title: input.title ?? "",
        meeting_at: input.meeting_at ?? null,
      });
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: key(vars.projectId) }),
  });
}

export function useUpdateProjectMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      projectId: string;
      patch: service.ProjectMeetingUpdate;
    }) => service.updateProjectMeeting(id, patch),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: key(vars.projectId) }),
  });
}

/**
 * Saves a meeting AND keeps its linked calendar event in sync (create / update /
 * delete) based on its date + all-day flag, then writes the resulting event_id
 * back onto the meeting. This is the single save path the detail modal uses.
 */
export function useSaveProjectMeeting() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      projectId: string;
      existingEventId: string | null;
      patch: {
        title: string;
        meeting_at: string | null;
        all_day: boolean;
        location: string | null;
        status: string;
        notes: string | null;
        summary: string | null;
        recording_id: string | null;
      };
    }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      const eventId = await service.reconcileMeetingEvent({
        organizationId,
        ownerId: userId,
        title: input.patch.title,
        meetingAt: input.patch.meeting_at,
        allDay: input.patch.all_day,
        location: input.patch.location,
        recordingId: input.patch.recording_id,
        existingEventId: input.existingEventId,
      });
      await service.updateProjectMeeting(input.id, {
        ...input.patch,
        event_id: eventId,
      });
      return eventId;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: key(vars.projectId) });
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allEvents(scope.organizationId),
        });
      }
    },
  });
}

export function useDeleteProjectMeeting() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: async ({
      id,
      eventId,
    }: {
      id: string;
      projectId: string;
      eventId?: string | null;
    }) => {
      if (eventId) await service.deleteMeetingEvent(eventId);
      await service.deleteProjectMeeting(id);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: key(vars.projectId) });
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allEvents(scope.organizationId),
        });
      }
    },
  });
}

// ── Meeting ⇄ task links ─────────────────────────────────────────────────────

const linksKey = (projectId: string) => ["meeting-task-links", projectId];

export function useMeetingTaskLinks(projectId: string | null | undefined) {
  return useQuery({
    queryKey: linksKey(projectId ?? ""),
    queryFn: () => service.listMeetingTaskLinks(projectId!),
    enabled: !!projectId,
  });
}

export function useLinkMeetingTask() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: {
      projectId: string;
      meetingId: string;
      taskId: string;
    }) => {
      const { organizationId } = assertOrgScope(scope);
      return service.linkMeetingTask({
        organization_id: organizationId,
        meeting_id: input.meetingId,
        task_id: input.taskId,
      });
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: linksKey(vars.projectId) }),
  });
}

export function useUnlinkMeetingTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ linkId }: { linkId: string; projectId: string }) =>
      service.unlinkMeetingTask(linkId),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: linksKey(vars.projectId) }),
  });
}
