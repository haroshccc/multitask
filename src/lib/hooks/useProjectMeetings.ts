import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as service from "@/lib/services/project-meetings";
import { useOrgScope, assertOrgScope } from "./useOrgScope";
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

export function useDeleteProjectMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) =>
      service.deleteProjectMeeting(id),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: key(vars.projectId) }),
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
