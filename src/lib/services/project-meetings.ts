import { supabase } from "@/lib/supabase/client";

const db = supabase as any;

export interface ProjectMeeting {
  id: string;
  organization_id: string;
  owner_id: string;
  project_id: string;
  title: string;
  meeting_at: string | null;
  location: string | null;
  notes: string | null;
  summary: string | null;
  status: string;
  recording_id: string | null;
  event_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type ProjectMeetingInsert = {
  organization_id: string;
  owner_id: string;
  project_id: string;
  title?: string;
  meeting_at?: string | null;
  location?: string | null;
  notes?: string | null;
  summary?: string | null;
  status?: string;
  recording_id?: string | null;
  event_id?: string | null;
  sort_order?: number;
};

export type ProjectMeetingUpdate = Partial<
  Omit<ProjectMeeting, "id" | "organization_id" | "owner_id" | "project_id" | "created_at">
>;

export async function listProjectMeetings(
  projectId: string
): Promise<ProjectMeeting[]> {
  const { data, error } = await db
    .from("project_meetings")
    .select("*")
    .eq("project_id", projectId)
    .order("meeting_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectMeeting[];
}

export async function createProjectMeeting(
  payload: ProjectMeetingInsert
): Promise<ProjectMeeting> {
  const { data, error } = await db
    .from("project_meetings")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as ProjectMeeting;
}

export async function updateProjectMeeting(
  id: string,
  patch: ProjectMeetingUpdate
): Promise<ProjectMeeting> {
  const { data, error } = await db
    .from("project_meetings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ProjectMeeting;
}

export async function deleteProjectMeeting(id: string): Promise<void> {
  const { error } = await db.from("project_meetings").delete().eq("id", id);
  if (error) throw error;
}

// ── Meeting ⇄ task links ─────────────────────────────────────────────────────

export interface MeetingTaskLink {
  id: string;
  meeting_id: string;
  task_id: string;
}

export async function listMeetingTaskLinks(
  projectId: string
): Promise<MeetingTaskLink[]> {
  // Fetch every link whose meeting belongs to this project, in one round-trip.
  const { data, error } = await db
    .from("meeting_task_links")
    .select("id, meeting_id, task_id, project_meetings!inner(project_id)")
    .eq("project_meetings.project_id", projectId);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    meeting_id: r.meeting_id,
    task_id: r.task_id,
  }));
}

export async function linkMeetingTask(input: {
  organization_id: string;
  meeting_id: string;
  task_id: string;
}): Promise<void> {
  const { error } = await db.from("meeting_task_links").insert(input);
  if (error && error.code !== "23505") throw error; // ignore duplicate link
}

export async function unlinkMeetingTask(linkId: string): Promise<void> {
  const { error } = await db
    .from("meeting_task_links")
    .delete()
    .eq("id", linkId);
  if (error) throw error;
}
