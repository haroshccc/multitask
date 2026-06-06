import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as service from "@/lib/services/document-links";
export type {
  DocumentLink,
  DocumentLinkTargetType,
  LinkedDocument,
} from "@/lib/services/document-links";

const linksKey = (
  targetType: service.DocumentLinkTargetType,
  targetId: string
) => ["document-links", targetType, targetId];

const projectDocsKey = (projectId: string) => ["project-documents", projectId];

export function useLinkedDocuments(
  targetType: service.DocumentLinkTargetType,
  targetId: string | null | undefined
) {
  return useQuery({
    queryKey: linksKey(targetType, targetId ?? ""),
    queryFn: () => service.listLinkedDocuments(targetType, targetId!),
    enabled: !!targetId,
  });
}

export function useCreateDocumentLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      documentId: string;
      targetType: service.DocumentLinkTargetType;
      targetId: string;
      /** Only used to invalidate the project documents list. */
      projectId?: string | null;
    }) =>
      service.createDocumentLink(
        input.documentId,
        input.targetType,
        input.targetId
      ),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: linksKey(vars.targetType, vars.targetId),
      });
      if (vars.projectId)
        qc.invalidateQueries({ queryKey: projectDocsKey(vars.projectId) });
    },
  });
}

export function useDeleteDocumentLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      linkId: string;
      targetType: service.DocumentLinkTargetType;
      targetId: string;
      projectId?: string | null;
    }) => service.deleteDocumentLink(input.linkId),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: linksKey(vars.targetType, vars.targetId),
      });
      if (vars.projectId)
        qc.invalidateQueries({ queryKey: projectDocsKey(vars.projectId) });
    },
  });
}
