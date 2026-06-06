import { supabase } from "@/lib/supabase/client";
import {
  createProjectDocument,
  type ProjectDocument,
} from "@/lib/services/project-documents";

const db = supabase as any;

export type DocumentLinkTargetType = "contact" | "payment";

export interface DocumentLink {
  id: string;
  document_id: string;
  target_type: DocumentLinkTargetType;
  target_id: string;
  created_at: string;
}

/** A linked document carries the document row plus the link id (so the
 *  shortcut can be removed without dropping the underlying document). */
export interface LinkedDocument extends ProjectDocument {
  link_id: string;
}

const PAYMENTS_FOLDER_NAME = "תשלומים";

/**
 * List the documents linked to a contact/payment, joining
 * `document_links` → `project_documents`. Returns each underlying document
 * plus the `link_id` of its shortcut.
 */
export async function listLinkedDocuments(
  targetType: DocumentLinkTargetType,
  targetId: string
): Promise<LinkedDocument[]> {
  const { data, error } = await db
    .from("document_links")
    .select("id, document:project_documents!inner(*)")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .filter((r: any) => r.document)
    .map((r: any) => ({
      ...(r.document as ProjectDocument),
      link_id: r.id,
    })) as LinkedDocument[];
}

/** Create a shortcut from a document to a target. Duplicate links (unique
 *  constraint, 23505) are silently ignored. */
export async function createDocumentLink(
  documentId: string,
  targetType: DocumentLinkTargetType,
  targetId: string
): Promise<void> {
  const { error } = await db.from("document_links").insert({
    document_id: documentId,
    target_type: targetType,
    target_id: targetId,
  });
  if (error && error.code !== "23505") throw error;
}

export async function deleteDocumentLink(linkId: string): Promise<void> {
  const { error } = await db.from("document_links").delete().eq("id", linkId);
  if (error) throw error;
}

/**
 * Return the id of the root-level `folder` named "תשלומים" in the project,
 * creating it if it doesn't exist yet. Payment documents live inside it.
 */
export async function findOrCreatePaymentsFolder(
  projectId: string,
  orgId: string,
  ownerId: string
): Promise<string> {
  const { data, error } = await db
    .from("project_documents")
    .select("id")
    .eq("project_id", projectId)
    .eq("kind", "folder")
    .is("parent_id", null)
    .eq("name", PAYMENTS_FOLDER_NAME)
    .limit(1);
  if (error) throw error;
  const existing = (data ?? [])[0];
  if (existing) return existing.id as string;

  const folder = await createProjectDocument({
    organization_id: orgId,
    owner_id: ownerId,
    project_id: projectId,
    parent_id: null,
    kind: "folder",
    name: PAYMENTS_FOLDER_NAME,
  });
  return folder.id;
}
