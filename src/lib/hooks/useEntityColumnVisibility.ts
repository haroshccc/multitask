import { useCallback, useMemo } from "react";
import { useProject, useUpdateProject } from "./useProjects";
import type { CustomFieldEntity } from "./useTaskCustomFields";

/**
 * Per-project, per-entity column visibility for the configurable tables.
 * Hidden column ids (fixed column keys OR custom field ids) live in
 * `projects.entity_hidden_columns[entityType]` (a string[]). Hiding never
 * deletes data — it only removes the column from this project's table — and is
 * scoped to the project surfaces, so the global Gantt is unaffected.
 *
 * The generated `Project` type lags behind the column, so we cast to `any`.
 */
export function useEntityColumnVisibility({
  entityType,
  projectId,
}: {
  entityType: CustomFieldEntity;
  projectId: string | null | undefined;
}): {
  hiddenIds: Set<string>;
  isHidden: (id: string) => boolean;
  toggleHidden: (id: string) => void;
  setHidden: (id: string, hidden: boolean) => void;
} {
  const { data: project } = useProject(projectId);
  const updateProject = useUpdateProject();

  const hiddenIds = useMemo(() => {
    const p = (project ?? null) as any;
    const map = (p?.entity_hidden_columns ?? {}) as Record<string, unknown>;
    const arr = Array.isArray(map[entityType]) ? (map[entityType] as unknown[]) : [];
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  }, [project, entityType]);

  const setHidden = useCallback(
    (id: string, hidden: boolean) => {
      if (!projectId) return;
      const next = new Set(hiddenIds);
      if (hidden) next.add(id);
      else next.delete(id);
      const p = (project ?? null) as any;
      const allMap = {
        ...((p?.entity_hidden_columns ?? {}) as Record<string, unknown>),
      };
      allMap[entityType] = Array.from(next);
      updateProject.mutate({
        projectId,
        patch: { entity_hidden_columns: allMap } as any,
      });
    },
    [projectId, hiddenIds, project, entityType, updateProject]
  );

  const toggleHidden = useCallback(
    (id: string) => setHidden(id, !hiddenIds.has(id)),
    [setHidden, hiddenIds]
  );

  const isHidden = useCallback((id: string) => hiddenIds.has(id), [hiddenIds]);

  return { hiddenIds, isHidden, toggleHidden, setHidden };
}
