import { supabase } from "@/lib/supabase/client";

const db = supabase as any;

export type ProjectDocumentKind = "folder" | "file" | "note" | "link";

export interface ProjectDocument {
  id: string;
  organization_id: string;
  owner_id: string;
  project_id: string;
  parent_id: string | null;
  kind: ProjectDocumentKind;
  name: string;
  content: string | null;
  url: string | null;
  file_key: string | null;
  file_size: number | null;
  mime: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type ProjectDocumentInsert = {
  organization_id: string;
  owner_id: string;
  project_id: string;
  parent_id?: string | null;
  kind: ProjectDocumentKind;
  name?: string;
  content?: string | null;
  url?: string | null;
  file_key?: string | null;
  file_size?: number | null;
  mime?: string | null;
  sort_order?: number;
};

export type ProjectDocumentUpdate = Partial<
  Omit<
    ProjectDocument,
    "id" | "organization_id" | "owner_id" | "project_id" | "created_at"
  >
>;

export async function listProjectDocuments(
  projectId: string
): Promise<ProjectDocument[]> {
  const { data, error } = await db
    .from("project_documents")
    .select("*")
    .eq("project_id", projectId)
    // Folders first (kind: folder < file < link < note alphabetically would
    // not group folders first, so we sort client-side too — but order by a
    // stable triple here so the list is deterministic).
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as ProjectDocument[];
  // Folders first, then by sort_order, then by name.
  return rows.sort((a, b) => {
    const af = a.kind === "folder" ? 0 : 1;
    const bf = b.kind === "folder" ? 0 : 1;
    if (af !== bf) return af - bf;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name, "he");
  });
}

export async function createProjectDocument(
  payload: ProjectDocumentInsert
): Promise<ProjectDocument> {
  const { data, error } = await db
    .from("project_documents")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as ProjectDocument;
}

export async function updateProjectDocument(
  id: string,
  patch: ProjectDocumentUpdate
): Promise<ProjectDocument> {
  const { data, error } = await db
    .from("project_documents")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ProjectDocument;
}

export async function deleteProjectDocument(id: string): Promise<void> {
  const { error } = await db.from("project_documents").delete().eq("id", id);
  if (error) throw error;
}
