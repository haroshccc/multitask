import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as service from "@/lib/services/project-documents";
import { useOrgScope, assertOrgScope } from "./useOrgScope";
export type {
  ProjectDocument,
  ProjectDocumentKind,
} from "@/lib/services/project-documents";

const key = (projectId: string) => ["project-documents", projectId];

export function useProjectDocuments(projectId: string | null | undefined) {
  return useQuery({
    queryKey: key(projectId ?? ""),
    queryFn: () => service.listProjectDocuments(projectId!),
    enabled: !!projectId,
  });
}

export function useCreateProjectDocument() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: {
      projectId: string;
      parentId: string | null;
      kind: service.ProjectDocumentKind;
      name?: string;
      content?: string | null;
      url?: string | null;
      file_key?: string | null;
      file_size?: number | null;
      mime?: string | null;
    }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createProjectDocument({
        organization_id: organizationId,
        owner_id: userId,
        project_id: input.projectId,
        parent_id: input.parentId,
        kind: input.kind,
        name: input.name ?? "",
        content: input.content ?? null,
        url: input.url ?? null,
        file_key: input.file_key ?? null,
        file_size: input.file_size ?? null,
        mime: input.mime ?? null,
      });
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: key(vars.projectId) }),
  });
}

export function useUpdateProjectDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      projectId: string;
      patch: service.ProjectDocumentUpdate;
    }) => service.updateProjectDocument(id, patch),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: key(vars.projectId) }),
  });
}

export function useDeleteProjectDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) =>
      service.deleteProjectDocument(id),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: key(vars.projectId) }),
  });
}
