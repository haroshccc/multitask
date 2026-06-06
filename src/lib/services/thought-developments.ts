/**
 * Service layer for thought-developments (פיתוח מחשבה).
 *
 * Independent of `thoughts`. Files live in R2 and are accessed via the shared
 * `storage` Edge Function (presignDownload). Sharing reuses the generic
 * `shares` table (entity_type='thought_development'), mirroring project-shares.
 *
 * Typegen lags behind the migration, so we go through `db` (an `any` view of
 * the client) — the documented "Supabase type lag" convention.
 */
import { supabase } from "@/lib/supabase/client";
import { presignDownload } from "@/lib/services/storage";
import type {
  ThoughtDevelopment,
  ThoughtDevelopmentFile,
  ThoughtDevelopmentFileRole,
  ThoughtDevelopmentShare,
} from "@/lib/types/thought-developments";

const db = supabase as any;

// ---------------------------------------------------------------------------
// Developments
// ---------------------------------------------------------------------------

export async function listThoughtDevelopments(
  organizationId: string
): Promise<ThoughtDevelopment[]> {
  const { data, error } = await db
    .from("thought_developments")
    .select("*")
    .eq("organization_id", organizationId)
    .order("written_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ThoughtDevelopment[];
}

export async function getThoughtDevelopment(
  id: string
): Promise<ThoughtDevelopment | null> {
  const { data, error } = await db
    .from("thought_developments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ThoughtDevelopment | null;
}

export interface CreateThoughtDevelopmentInput {
  organization_id: string;
  owner_id: string;
  name?: string;
  description?: string;
  summary_text?: string;
  written_at?: string | null;
  project_id?: string | null;
  task_list_id?: string | null;
}

export async function createThoughtDevelopment(
  input: CreateThoughtDevelopmentInput
): Promise<ThoughtDevelopment> {
  const { data, error } = await db
    .from("thought_developments")
    .insert({
      organization_id: input.organization_id,
      owner_id: input.owner_id,
      name: input.name ?? "",
      description: input.description ?? "",
      summary_text: input.summary_text ?? "",
      ...(input.written_at ? { written_at: input.written_at } : {}),
      project_id: input.project_id ?? null,
      task_list_id: input.task_list_id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ThoughtDevelopment;
}

export type ThoughtDevelopmentPatch = Partial<
  Pick<
    ThoughtDevelopment,
    | "name"
    | "description"
    | "summary_text"
    | "written_at"
    | "project_id"
    | "task_list_id"
  >
>;

export async function updateThoughtDevelopment(
  id: string,
  patch: ThoughtDevelopmentPatch
): Promise<ThoughtDevelopment> {
  const { data, error } = await db
    .from("thought_developments")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ThoughtDevelopment;
}

export async function deleteThoughtDevelopment(id: string): Promise<void> {
  const { error } = await db.from("thought_developments").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export async function listThoughtDevelopmentFiles(
  developmentId: string
): Promise<ThoughtDevelopmentFile[]> {
  const { data, error } = await db
    .from("thought_development_files")
    .select("*")
    .eq("thought_development_id", developmentId)
    .order("sort_order", { ascending: true })
    .order("uploaded_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ThoughtDevelopmentFile[];
}

/** Bulk: every file for a set of developments, in one round-trip (card badges). */
export async function listFilesForDevelopments(
  developmentIds: string[]
): Promise<ThoughtDevelopmentFile[]> {
  if (developmentIds.length === 0) return [];
  const { data, error } = await db
    .from("thought_development_files")
    .select("*")
    .in("thought_development_id", developmentIds);
  if (error) throw error;
  return (data ?? []) as ThoughtDevelopmentFile[];
}

export interface AddThoughtDevelopmentFileInput {
  organization_id: string;
  thought_development_id: string;
  role: ThoughtDevelopmentFileRole;
  file_name: string;
  mime_type: string;
  size_bytes?: number | null;
  storage_key: string;
}

export async function addThoughtDevelopmentFile(
  input: AddThoughtDevelopmentFileInput
): Promise<ThoughtDevelopmentFile> {
  const { data, error } = await db
    .from("thought_development_files")
    .insert({
      organization_id: input.organization_id,
      thought_development_id: input.thought_development_id,
      role: input.role,
      file_name: input.file_name,
      mime_type: input.mime_type,
      size_bytes: input.size_bytes ?? null,
      storage_key: input.storage_key,
      storage_provider: "r2",
    })
    .select()
    .single();
  if (error) throw error;
  return data as ThoughtDevelopmentFile;
}

export async function deleteThoughtDevelopmentFile(
  fileId: string
): Promise<void> {
  const { error } = await db
    .from("thought_development_files")
    .delete()
    .eq("id", fileId);
  if (error) throw error;
}

/** A signed download URL for a stored file (R2 via the storage Edge Function). */
export async function getThoughtDevelopmentFileUrl(
  storageKey: string
): Promise<string> {
  const { url } = await presignDownload(storageKey);
  return url;
}

// ---------------------------------------------------------------------------
// Sharing (generic `shares` table, entity_type='thought_development')
// ---------------------------------------------------------------------------

const SHARE_ENTITY = "thought_development";

export async function listThoughtDevelopmentShares(
  developmentId: string
): Promise<ThoughtDevelopmentShare[]> {
  const { data, error } = await db
    .from("shares")
    .select("user_id, permission, organization_id")
    .eq("entity_type", SHARE_ENTITY)
    .eq("entity_id", developmentId);
  if (error) throw error;
  return (data ?? []) as ThoughtDevelopmentShare[];
}

/** Bulk: share rows for many developments (card "shared" badges). */
export async function listSharesForDevelopments(
  developmentIds: string[]
): Promise<Array<ThoughtDevelopmentShare & { entity_id: string }>> {
  if (developmentIds.length === 0) return [];
  const { data, error } = await db
    .from("shares")
    .select("entity_id, user_id, permission, organization_id")
    .eq("entity_type", SHARE_ENTITY)
    .in("entity_id", developmentIds);
  if (error) throw error;
  return (data ?? []) as Array<ThoughtDevelopmentShare & { entity_id: string }>;
}

export async function setThoughtDevelopmentShare(
  orgId: string,
  developmentId: string,
  userId: string,
  permission: "read" | "write"
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await db.from("shares").upsert(
    {
      organization_id: orgId,
      entity_type: SHARE_ENTITY,
      entity_id: developmentId,
      user_id: userId,
      permission,
      granted_by: user?.id ?? null,
    },
    { onConflict: "entity_type,entity_id,user_id" }
  );
  if (error) throw error;
}

export async function removeThoughtDevelopmentShare(
  developmentId: string,
  userId: string
): Promise<void> {
  const { error } = await db
    .from("shares")
    .delete()
    .eq("entity_type", SHARE_ENTITY)
    .eq("entity_id", developmentId)
    .eq("user_id", userId);
  if (error) throw error;
}
