/**
 * Task attachments — link recordings / thoughts / events / external links and
 * upload files onto a task. Backed by the `task_attachments` table.
 *
 * Files are stored in R2 via the generic upload pipeline (`useFileUpload`),
 * exactly like project documents and recordings. On delete we only remove the
 * DB row — the R2 object is reclaimed by Cloudflare's lifecycle policy, the
 * same approach `deleteRecording` takes.
 */
import { supabase } from "@/lib/supabase/client";
import type { TaskAttachment } from "@/lib/types/domain";

// typegen lags behind schema in places — cast to any for this table.
const db = supabase as any;

export type TaskAttachmentType =
  | "recording"
  | "thought"
  | "event"
  | "file"
  | "image"
  | "link";

export async function listTaskAttachments(
  taskId: string
): Promise<TaskAttachment[]> {
  const { data, error } = await db
    .from("task_attachments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TaskAttachment[];
}

/** Type-specific payload (everything except the task/org/author context). */
export type TaskAttachmentPayload =
  | { attachment_type: "recording"; recording_id: string }
  | { attachment_type: "thought"; thought_id: string }
  | { attachment_type: "event"; event_id: string }
  | { attachment_type: "link"; url: string; filename?: string | null }
  | {
      attachment_type: "file" | "image";
      storage_key: string;
      filename: string;
      mime_type: string;
      size_bytes: number;
    };

export type CreateTaskAttachmentInput = {
  taskId: string;
  organizationId: string;
  createdBy: string;
} & TaskAttachmentPayload;

export async function createTaskAttachment(
  input: CreateTaskAttachmentInput
): Promise<TaskAttachment> {
  const row: Record<string, unknown> = {
    task_id: input.taskId,
    organization_id: input.organizationId,
    created_by: input.createdBy,
    attachment_type: input.attachment_type,
  };

  switch (input.attachment_type) {
    case "recording":
      row.recording_id = input.recording_id;
      break;
    case "thought":
      row.thought_id = input.thought_id;
      break;
    case "event":
      row.event_id = input.event_id;
      break;
    case "link":
      row.url = input.url;
      if (input.filename) row.filename = input.filename;
      break;
    case "file":
    case "image":
      row.storage_key = input.storage_key;
      row.storage_provider = "r2";
      row.filename = input.filename;
      row.mime_type = input.mime_type;
      row.size_bytes = input.size_bytes;
      break;
  }

  const { data, error } = await db
    .from("task_attachments")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data as TaskAttachment;
}

export async function deleteTaskAttachment(id: string): Promise<void> {
  const { error } = await db.from("task_attachments").delete().eq("id", id);
  if (error) throw error;
}
