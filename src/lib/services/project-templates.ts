import { supabase } from "@/lib/supabase/client";
import type { Database, Json } from "@/lib/types/database";
import type {
  ProjectTemplate,
  ProjectTemplateInsert,
} from "@/lib/types/domain";

/**
 * Shape stored in `project_templates.template_data` (Json column).
 *
 * v1 (legacy): only `tasks` array of top-level entries.
 * v2: also `pricing` snapshot, `layout` (column order/labels + dyn columns),
 *     and `tasks[].subs` for nested sub-tasks + per-task `custom_fields`.
 *
 * `applyTemplateToProject` accepts both — older templates created before v2
 * still load via the legacy code path.
 */
export interface ProjectTemplateTaskV2 {
  title: string;
  estimated_hours?: number;
  spare_hours?: number;
  urgency?: number;
  notes?: string | null;
  custom_fields?: Record<string, unknown>;
  subs?: ProjectTemplateTaskV2[];
}

export interface ProjectTemplatePricing {
  pricing_mode: "hourly" | "fixed_price" | "quote";
  hourly_rate_cents: number | null;
  profit_percentage: number | null;
  spare_mode: "percent" | "hours" | null;
  spare_value: number | null;
  total_price_cents: number | null;
  vat_percentage: number | null;
  currency: string;
}

export interface ProjectTemplateDynColumn {
  field_key: string;
  field_label: string;
  field_type: Database["public"]["Enums"]["custom_field_type"];
  options: Json | null;
  sort_order: number;
}

export interface ProjectTemplateLayout {
  column_order: string[];
  column_labels: Record<string, string>;
  dyn_columns: ProjectTemplateDynColumn[];
}

export interface ProjectTemplateData {
  version?: 1 | 2;
  tasks: ProjectTemplateTaskV2[];
  pricing?: ProjectTemplatePricing;
  layout?: ProjectTemplateLayout;
}

export async function listProjectTemplates(
  organizationId: string
): Promise<ProjectTemplate[]> {
  const { data, error } = await supabase
    .from("project_templates")
    .select("*")
    .eq("organization_id", organizationId)
    .order("is_favorite", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createProjectTemplate(
  payload: ProjectTemplateInsert
): Promise<ProjectTemplate> {
  const { data, error } = await supabase
    .from("project_templates")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Snapshots the current project state into a v2 template:
 * tasks (with sub-tasks + custom_fields), pricing config, column layout, and
 * dynamic columns. Done tasks are skipped — templates are about future work.
 */
export async function saveProjectAsTemplate(args: {
  projectId: string;
  organizationId: string;
  ownerId: string;
  name: string;
  description?: string | null;
  emoji?: string | null;
}): Promise<ProjectTemplate> {
  const { projectId, organizationId, ownerId, name, description, emoji } = args;

  // Project row → pricing + layout overrides + emoji/desc fallback.
  const { data: project, error: pErr } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  if (pErr) throw pErr;

  // Lists for this project — feeds task lookup.
  const { data: lists, error: lErr } = await supabase
    .from("task_lists")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("project_id", projectId);
  if (lErr) throw lErr;
  const listIds = (lists ?? []).map((l) => l.id);

  // All tasks (top-level + subs), open only.
  type RawTask = {
    id: string;
    title: string;
    estimated_hours: number | null;
    spare_hours: number | null;
    urgency: number;
    notes: string | null;
    parent_task_id: string | null;
    sort_order: number;
    custom_fields: Json;
    status: string;
    completed_at: string | null;
  };
  let allTasks: RawTask[] = [];
  if (listIds.length > 0) {
    const { data, error } = await supabase
      .from("tasks")
      .select(
        "id, title, estimated_hours, spare_hours, urgency, notes, parent_task_id, sort_order, custom_fields, status, completed_at"
      )
      .in("task_list_id", listIds)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    allTasks = (data ?? []).filter(
      (t) => t.status !== "done" && !t.completed_at
    );
  }

  // Build tree from flat list.
  const byParent = new Map<string | null, RawTask[]>();
  for (const t of allTasks) {
    const arr = byParent.get(t.parent_task_id) ?? [];
    arr.push(t);
    byParent.set(t.parent_task_id, arr);
  }
  const buildTree = (parentId: string | null): ProjectTemplateTaskV2[] =>
    (byParent.get(parentId) ?? []).map((t) => ({
      title: t.title,
      estimated_hours: t.estimated_hours ?? undefined,
      spare_hours: t.spare_hours ?? undefined,
      urgency: t.urgency,
      notes: t.notes,
      custom_fields:
        (t.custom_fields as Record<string, unknown> | null) ?? undefined,
      subs: buildTree(t.id),
    }));
  const tasksTree = buildTree(null);

  // Dynamic columns of the project.
  const { data: dynColsRaw, error: dynErr } = await supabase
    .from("task_custom_fields")
    .select("field_key, field_label, field_type, options, sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  if (dynErr) throw dynErr;
  const dynColumns: ProjectTemplateDynColumn[] = (dynColsRaw ?? []).map(
    (c) => ({
      field_key: c.field_key,
      field_label: c.field_label,
      field_type: c.field_type,
      options: c.options,
      sort_order: c.sort_order,
    })
  );

  // Pricing snapshot (only meaningful if mode != quote).
  const pricing: ProjectTemplatePricing = {
    pricing_mode: project.pricing_mode,
    hourly_rate_cents: project.hourly_rate_cents,
    profit_percentage: project.profit_percentage,
    spare_mode:
      (project.spare_mode as "percent" | "hours" | null) ?? null,
    spare_value: project.spare_value,
    total_price_cents: project.total_price_cents,
    vat_percentage: project.vat_percentage,
    currency: project.currency,
  };

  // Layout snapshot — column order + label overrides + dyn columns.
  const columnOrder = (() => {
    const raw = project.column_order;
    if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
    return [];
  })();
  const columnLabels = (() => {
    const raw = project.column_labels as Record<string, unknown> | null;
    const out: Record<string, string> = {};
    if (raw && typeof raw === "object") {
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === "string") out[k] = v;
      }
    }
    return out;
  })();
  const layout: ProjectTemplateLayout = {
    column_order: columnOrder,
    column_labels: columnLabels,
    dyn_columns: dynColumns,
  };

  const templateData: ProjectTemplateData = {
    version: 2,
    tasks: tasksTree,
    pricing,
    layout,
  };

  return createProjectTemplate({
    organization_id: organizationId,
    owner_id: ownerId,
    name,
    description: description ?? null,
    emoji: emoji ?? null,
    is_default: false,
    template_data: templateData as unknown as ProjectTemplate["template_data"],
  });
}

/**
 * Applies a template to a project. v1 templates only seed tasks; v2 templates
 * also restore pricing + column layout + dynamic columns.
 *
 * Returns the new list id (one is always created).
 */
export async function applyTemplateToProject(args: {
  templateId: string;
  projectId: string;
  organizationId: string;
  ownerId: string;
}): Promise<string> {
  const { templateId, projectId, organizationId, ownerId } = args;

  const { data: template, error: tErr } = await supabase
    .from("project_templates")
    .select("*")
    .eq("id", templateId)
    .single();
  if (tErr) throw tErr;

  const data = (template.template_data as ProjectTemplateData | null) ?? {
    tasks: [],
  };

  // Create the list to hold the seeded tasks.
  const { data: list, error: lErr } = await supabase
    .from("task_lists")
    .insert({
      organization_id: organizationId,
      owner_id: ownerId,
      project_id: projectId,
      name: template.name,
      kind: "project" as Database["public"]["Enums"]["task_list_kind"],
    })
    .select()
    .single();
  if (lErr) throw lErr;

  // Recursive insert: top-level tasks first, then per-parent we insert their
  // subs after we know the inserted parent's id.
  const insertSubtree = async (
    items: ProjectTemplateTaskV2[],
    parentTaskId: string | null
  ) => {
    for (let i = 0; i < items.length; i++) {
      const t = items[i];
      const { data: created, error: insErr } = await supabase
        .from("tasks")
        .insert({
          organization_id: organizationId,
          owner_id: ownerId,
          task_list_id: list.id,
          parent_task_id: parentTaskId,
          title: t.title,
          notes: t.notes ?? null,
          estimated_hours: t.estimated_hours ?? null,
          spare_hours: t.spare_hours ?? null,
          urgency: t.urgency ?? 0,
          status: "todo",
          sort_order: (i + 1) * 1000,
          custom_fields:
            (t.custom_fields as unknown as Json) ?? ({} as Json),
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      if (t.subs && t.subs.length > 0) {
        await insertSubtree(t.subs, created.id);
      }
    }
  };
  await insertSubtree(data.tasks ?? [], null);

  // v2 extras: pricing + layout overrides + dyn columns.
  if (data.version === 2) {
    if (data.pricing) {
      // Honor template pricing only if user hasn't already set their own
      // (heuristic: project still on default mode 'quote' or unset rate).
      const { data: currentProject } = await supabase
        .from("projects")
        .select("pricing_mode, hourly_rate_cents")
        .eq("id", projectId)
        .single();
      const hasOwnPricing =
        currentProject &&
        (currentProject.pricing_mode !== "quote" ||
          (currentProject.hourly_rate_cents ?? 0) > 0);
      if (!hasOwnPricing) {
        await supabase
          .from("projects")
          .update({
            pricing_mode: data.pricing.pricing_mode,
            hourly_rate_cents: data.pricing.hourly_rate_cents,
            profit_percentage: data.pricing.profit_percentage,
            spare_mode: data.pricing.spare_mode,
            spare_value: data.pricing.spare_value,
            total_price_cents: data.pricing.total_price_cents,
            vat_percentage: data.pricing.vat_percentage,
            currency: data.pricing.currency,
          })
          .eq("id", projectId);
      }
    }

    if (data.layout) {
      // Apply column order/labels — these are project-level prefs and are safe
      // to overwrite (the user explicitly chose this template).
      await supabase
        .from("projects")
        .update({
          column_order: data.layout.column_order as unknown as Json,
          column_labels: data.layout.column_labels as unknown as Json,
        })
        .eq("id", projectId);

      // Re-create dyn columns. Skip ones already present (same field_key) to
      // not duplicate. Tasks created above carry over `custom_fields` keyed
      // by field_key, so as long as the column with same key exists, values
      // will display.
      if (data.layout.dyn_columns.length > 0) {
        const { data: existing } = await supabase
          .from("task_custom_fields")
          .select("field_key")
          .eq("project_id", projectId);
        const existingKeys = new Set(
          (existing ?? []).map((c) => c.field_key)
        );
        const toInsert = data.layout.dyn_columns
          .filter((c) => !existingKeys.has(c.field_key))
          .map((c) => ({
            project_id: projectId,
            field_key: c.field_key,
            field_label: c.field_label,
            field_type: c.field_type,
            options: c.options,
            sort_order: c.sort_order,
            is_visible: true,
          }));
        if (toInsert.length > 0) {
          const { error: dynInsErr } = await supabase
            .from("task_custom_fields")
            .insert(toInsert);
          if (dynInsErr) throw dynInsErr;
        }
      }
    }
  }

  return list.id;
}
