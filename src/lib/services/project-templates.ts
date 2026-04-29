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
