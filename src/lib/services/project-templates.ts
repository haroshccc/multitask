import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import type {
  ProjectTemplate,
  ProjectTemplateInsert,
} from "@/lib/types/domain";

/**
 * Loose shape stored in `project_templates.template_data` (Json column).
 * Each entry becomes one top-level task when the template is applied.
 */
export interface ProjectTemplateData {
  tasks: {
    title: string;
    estimated_hours?: number;
    spare_hours?: number;
    urgency?: number;
  }[];
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
 * Applies the given template to a project: creates a task list (named after
 * the template) under the project, then creates a top-level task per entry
 * in `template_data.tasks`. Returns the new list id.
 */
/**
 * Snapshots the current project's open tasks into a brand-new template row.
 * Mirrors `applyTemplateToProject` in reverse: tasks → template_data shape.
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

  // Pull tasks via the same chain useTasksByProject uses: lists → tasks.
  const { data: lists, error: lErr } = await supabase
    .from("task_lists")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("project_id", projectId);
  if (lErr) throw lErr;
  const listIds = (lists ?? []).map((l) => l.id);

  type SnapshotTask = {
    title: string;
    estimated_hours: number | null;
    spare_hours: number | null;
    urgency: number;
    sort_order: number;
  };
  let tasksRows: SnapshotTask[] = [];
  if (listIds.length > 0) {
    const { data: tasks, error: tErr } = await supabase
      .from("tasks")
      .select("title, estimated_hours, spare_hours, urgency, sort_order, status, completed_at, parent_task_id")
      .in("task_list_id", listIds)
      .is("parent_task_id", null) // top-level only — keep the template flat
      .order("sort_order", { ascending: true });
    if (tErr) throw tErr;
    tasksRows = (tasks ?? [])
      .filter((t) => t.status !== "done" && !t.completed_at)
      .map((t) => ({
        title: t.title,
        estimated_hours: t.estimated_hours,
        spare_hours: t.spare_hours,
        urgency: t.urgency,
        sort_order: t.sort_order,
      }));
  }

  const templateData: ProjectTemplateData = {
    tasks: tasksRows.map((t) => ({
      title: t.title,
      estimated_hours: t.estimated_hours ?? undefined,
      spare_hours: t.spare_hours ?? undefined,
      urgency: t.urgency,
    })),
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

  if (data.tasks.length > 0) {
    const rows = data.tasks.map((t, i) => ({
      organization_id: organizationId,
      owner_id: ownerId,
      task_list_id: list.id,
      title: t.title,
      estimated_hours: t.estimated_hours ?? null,
      spare_hours: t.spare_hours ?? null,
      urgency: t.urgency ?? 0,
      status: "todo",
      sort_order: (i + 1) * 1000,
    }));
    const { error: insErr } = await supabase.from("tasks").insert(rows);
    if (insErr) throw insErr;
  }

  return list.id;
}
