/**
 * Domain types for thought-developments (פיתוח מחשבה).
 *
 * A thought-development is an independent entity (NOT a `thoughts` row): a
 * developed idea with source files, a free-text summary + summary files, an
 * editable written_at, an optional link to a single project OR task-list, and
 * user→user sharing via the generic `shares` table.
 *
 * Hand-written (typegen lags behind the migration) — the service goes through
 * `supabase as any`, per the documented "Supabase type lag" convention.
 */

export type ThoughtDevelopmentFileRole = "source" | "summary";

export interface ThoughtDevelopment {
  id: string;
  organization_id: string;
  owner_id: string;
  name: string;
  description: string;
  summary_text: string;
  /** When the idea was written/created — user-editable (uploads may lag). */
  written_at: string;
  /** Links to AT MOST one of these (mutually exclusive). */
  project_id: string | null;
  task_list_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ThoughtDevelopmentFile {
  id: string;
  organization_id: string;
  thought_development_id: string;
  role: ThoughtDevelopmentFileRole;
  file_name: string;
  mime_type: string;
  size_bytes: number | null;
  storage_key: string;
  storage_provider: "r2" | "supabase";
  uploaded_at: string;
  edited_at: string | null;
  sort_order: number;
  created_at: string;
}

/** A share row for a thought-development (mirrors ProjectShareRow). */
export interface ThoughtDevelopmentShare {
  user_id: string;
  permission: "read" | "write";
  organization_id: string;
}
