import { useMemo } from "react";
import { useProject, useUpdateProject } from "./useProjects";
import {
  normalizeFixedOrder,
  type FixedColumnDescriptor,
} from "@/components/configurable-table/gridLayout";
import type { CustomFieldEntity } from "./useTaskCustomFields";

/**
 * Generic per-entity fixed-column configuration (labels + order) for a
 * configurable table. Reads/writes the project's column config and exposes
 * normalized ordered keys plus rename/reorder mutators.
 *
 * For the `task` entity it reads the legacy flat maps
 * (`project.column_labels` / `project.column_order`). For every other entity
 * (e.g. `meeting`, `payment`) it reads/writes the NAMESPACED maps
 * `project.entity_column_labels[entityType]` / `entity_column_order[entityType]`.
 *
 * The generated `Project` type lags behind the `entity_column_*` columns, so we
 * cast to `any` to read/write them.
 */
export function useEntityColumns<TKey extends string>({
  entityType,
  projectId,
  descriptors,
}: {
  entityType: CustomFieldEntity;
  projectId: string | null | undefined;
  descriptors: FixedColumnDescriptor<TKey>[];
}): {
  fixedLabels: Record<string, string>;
  orderedKeys: TKey[];
  renameFixed: (key: string, label: string) => void;
  reorderFixed: (newOrder: TKey[]) => void;
} {
  const { data: project } = useProject(projectId);
  const updateProject = useUpdateProject();
  const isTask = entityType === "task";

  const defaultOrder = useMemo(
    () => descriptors.map((d) => d.key),
    [descriptors]
  );

  // Pull the raw label/order maps for this entity from the project row.
  const { rawLabels, rawOrder } = useMemo(() => {
    const p = (project ?? null) as any;
    if (!p) return { rawLabels: {}, rawOrder: undefined as unknown };
    if (isTask) {
      return {
        rawLabels: (p.column_labels ?? {}) as Record<string, unknown>,
        rawOrder: p.column_order,
      };
    }
    const labelsNs = (p.entity_column_labels ?? {}) as Record<string, unknown>;
    const orderNs = (p.entity_column_order ?? {}) as Record<string, unknown>;
    return {
      rawLabels: (labelsNs[entityType] ?? {}) as Record<string, unknown>,
      rawOrder: orderNs[entityType],
    };
  }, [project, isTask, entityType]);

  const fixedLabels = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawLabels)) {
      if (typeof v === "string" && v.trim()) out[k] = v;
    }
    return out;
  }, [rawLabels]);

  const orderedKeys = useMemo(
    () => normalizeFixedOrder<TKey>(rawOrder, defaultOrder),
    [rawOrder, defaultOrder]
  );

  const renameFixed = (key: string, label: string) => {
    if (!projectId) return;
    const next = { ...fixedLabels };
    if (label) next[key] = label;
    else delete next[key];
    if (isTask) {
      updateProject.mutate({
        projectId,
        patch: { column_labels: next } as any,
      });
      return;
    }
    const p = (project ?? null) as any;
    const allLabels = { ...((p?.entity_column_labels ?? {}) as Record<string, unknown>) };
    allLabels[entityType] = next;
    updateProject.mutate({
      projectId,
      patch: { entity_column_labels: allLabels } as any,
    });
  };

  const reorderFixed = (newOrder: TKey[]) => {
    if (!projectId) return;
    if (isTask) {
      updateProject.mutate({
        projectId,
        patch: { column_order: newOrder } as any,
      });
      return;
    }
    const p = (project ?? null) as any;
    const allOrder = { ...((p?.entity_column_order ?? {}) as Record<string, unknown>) };
    allOrder[entityType] = newOrder;
    updateProject.mutate({
      projectId,
      patch: { entity_column_order: allOrder } as any,
    });
  };

  return { fixedLabels, orderedKeys, renameFixed, reorderFixed };
}
