/**
 * Domain-friendly aliases over the auto-generated Supabase types.
 * Import from here instead of `database.ts` directly — these names match the
 * vocabulary used across the app's services, hooks, and UI.
 */
import type { Database } from "./database";

// Tables -----------------------------------------------------------------------

type Tables = Database["public"]["Tables"];

export type Organization = Tables["organizations"]["Row"];
export type OrganizationInsert = Tables["organizations"]["Insert"];
export type OrganizationUpdate = Tables["organizations"]["Update"];

export type OrganizationMember = Tables["organization_members"]["Row"];
export type OrganizationMemberInsert = Tables["organization_members"]["Insert"];

export type Profile = Tables["profiles"]["Row"];
export type ProfileUpdate = Tables["profiles"]["Update"];

export type Project = Tables["projects"]["Row"];
export type ProjectInsert = Tables["projects"]["Insert"];
export type ProjectUpdate = Tables["projects"]["Update"];


export type ProjectExpense = Tables["project_expenses"]["Row"];
export type ProjectExpenseInsert = Tables["project_expenses"]["Insert"];

export type ProjectTemplate = Tables["project_templates"]["Row"];
export type ProjectTemplateInsert = Tables["project_templates"]["Insert"];
export type ProjectTemplateUpdate = Tables["project_templates"]["Update"];

export type TaskList = Tables["task_lists"]["Row"];
export type TaskListInsert = Tables["task_lists"]["Insert"];
export type TaskListUpdate = Tables["task_lists"]["Update"];

export type Task = Tables["tasks"]["Row"];
export type TaskInsert = Tables["tasks"]["Insert"];
export type TaskUpdate = Tables["tasks"]["Update"];

export type TaskDependency = Tables["task_dependencies"]["Row"];
export type TimeEntry = Tables["time_entries"]["Row"];
export type TaskAttachment = Tables["task_attachments"]["Row"];
export type TaskCustomField = Tables["task_custom_fields"]["Row"];
export type TaskCustomFieldInsert = Tables["task_custom_fields"]["Insert"];
export type TaskCustomFieldUpdate = Tables["task_custom_fields"]["Update"];

export type EventRow = Tables["events"]["Row"];
export type EventInsert = Tables["events"]["Insert"];
export type EventUpdate = Tables["events"]["Update"];
export type EventParticipant = Tables["event_participants"]["Row"];

export type Recording = Tables["recordings"]["Row"];
export type RecordingInsert = Tables["recordings"]["Insert"];
export type RecordingUpdate = Tables["recordings"]["Update"];
export type RecordingSpeaker = Tables["recording_speakers"]["Row"];
export type RecordingTask = Tables["recording_tasks"]["Row"];

export type RecordingList = Tables["recording_lists"]["Row"];
export type RecordingListInsert = Tables["recording_lists"]["Insert"];
export type RecordingListUpdate = Tables["recording_lists"]["Update"];
export type RecordingListAssignment = Tables["recording_list_assignments"]["Row"];

export type EventCalendar = Tables["event_calendars"]["Row"];
export type EventCalendarInsert = Tables["event_calendars"]["Insert"];
export type EventCalendarUpdate = Tables["event_calendars"]["Update"];

export type CalendarDayNote = Tables["calendar_day_notes"]["Row"];
export type CalendarDayNoteInsert = Tables["calendar_day_notes"]["Insert"];
export type CalendarDayNoteUpdate = Tables["calendar_day_notes"]["Update"];

export type Thought = Tables["thoughts"]["Row"];
export type ThoughtInsert = Tables["thoughts"]["Insert"];
export type ThoughtUpdate = Tables["thoughts"]["Update"];
export type ThoughtList = Tables["thought_lists"]["Row"];
export type ThoughtListAssignment = Tables["thought_list_assignments"]["Row"];
export type ThoughtProcessing = Tables["thought_processings"]["Row"];

export type Question = Tables["questions"]["Row"];
export type QuestionInsert = Tables["questions"]["Insert"];

export type Share = Tables["shares"]["Row"];

export type Notification = Tables["notifications"]["Row"];
export type PushToken = Tables["push_tokens"]["Row"];
export type UserNotificationPreference = Tables["user_notification_preferences"]["Row"];
export type UserSavedFilter = Tables["user_saved_filters"]["Row"];
export type UserDashboardLayout = Tables["user_dashboard_layouts"]["Row"];
export type UserListVisibility = Tables["user_list_visibility"]["Row"];
export type UserTaskStatus = Tables["user_task_statuses"]["Row"];
export type UserTaskStatusInsert = Tables["user_task_statuses"]["Insert"];
export type UserTaskStatusUpdate = Tables["user_task_statuses"]["Update"];

// Enums ------------------------------------------------------------------------

type Enums = Database["public"]["Enums"];

export type OrganizationMemberRole = Enums["organization_member_role"];
export type BillingPlan = Enums["billing_plan"];
export type SubscriptionStatus = Enums["subscription_status"];
export type TaskStatus = Enums["task_status"];
export type TaskStatusKind = Enums["task_status_kind"];
export type TaskListKind = Enums["task_list_kind"];
export type DependencyRelation = Enums["dependency_relation"];
export type CustomFieldType = Enums["custom_field_type"];
export type ProjectPricingMode = Enums["project_pricing_mode"];
export type ProjectSpareMode = Enums["project_spare_mode"];
export type EventRsvpStatus = Enums["event_rsvp_status"];
export type RecordingSource = Enums["recording_source"];
export type RecordingStatus = Enums["recording_status"];
export type SpeakerRole = Enums["speaker_role"];
export type ThoughtSource = Enums["thought_source"];
export type ThoughtStatus = Enums["thought_status"];
export type ThoughtProcessingTarget = Enums["thought_processing_target"];
export type ShareEntityType = Enums["share_entity_type"];
export type SharePermission = Enums["share_permission"];
export type NotificationType = Enums["notification_type"];
export type PushPlatform = Enums["push_platform"];
export type DashboardScreen = Enums["dashboard_screen"];
export type VideoCallProvider = Enums["video_call_provider"];
export type AttachmentType = Enums["attachment_type"];

// Composed view types (denormalized shapes used in the UI) --------------------

export interface TaskWithChildren extends Task {
  children?: TaskWithChildren[];
}

export interface RecordingWithExtras extends Recording {
  speakers?: RecordingSpeaker[];
  extracted_tasks?: (RecordingTask & { task: Task })[];
}

export interface ThoughtWithLists extends Thought {
  lists?: ThoughtList[];
  processings?: ThoughtProcessing[];
}

export interface ProjectWithStats extends Project {
  task_count?: number;
  completed_task_count?: number;
  total_expense_cents?: number;
  total_estimated_hours?: number;
  total_actual_seconds?: number;
}

export interface OrganizationWithMembership extends Organization {
  membership?: OrganizationMember;
}

// Daily Brief (Phase 8.2 / 8.3) ----------------------------------------------

export type DailyBriefRow = Tables["daily_briefs"]["Row"];
export type DailyBriefInsert = Tables["daily_briefs"]["Insert"];
export type DailyBriefUpdate = Tables["daily_briefs"]["Update"];

export interface BriefPersonNote {
  /** Display name from speaker labels / participants. */
  person: string;
  /** What was discussed — 1-2 sentence recap. */
  context: string;
  /** Recording / event ids the note was sourced from (so the UI can deep-link). */
  recording_ids?: string[];
  event_ids?: string[];
}

export interface BriefRecommendation {
  /** Short headline of the suggestion. */
  title: string;
  /** Explanation / reasoning. */
  description: string;
  /** Loose category for icon/colour binding in the UI. */
  category: "time" | "tasks" | "meetings" | "general";
}

export interface BriefOutput {
  /** Hero recap: 2-3 sentences of "what happened in this period". */
  summary: string;
  /** Pull-quote of the most important thing about the period. */
  headline?: string;
  /** Per-person note. Empty array if no recordings/meetings. */
  people_summary: BriefPersonNote[];
  /** Cross-recording recap (sentences, not a list). */
  recordings_digest: string;
  /** Pattern / insight about productive hours. */
  productive_hours_insight: string;
  /** Free-form recommendations. UI shows as chips/cards. */
  recommendations: BriefRecommendation[];
}

// Phase 8.3 — proposals returned alongside the brief.
export type ProposalKind =
  | "move_task"        // change scheduled_at on a task
  | "schedule_task"    // assign scheduled_at to an unscheduled task
  | "create_event"     // create a new calendar event
  | "reorder_day"      // batch reschedule of multiple tasks within a day
  | "complete_task"    // mark a task as completed
  | "split_task";      // split a single task into N smaller ones

export interface MoveTaskPayload {
  task_id: string;
  current_scheduled_at: string | null;
  new_scheduled_at: string;
  task_title?: string;
}

export interface ScheduleTaskPayload {
  task_id: string;
  new_scheduled_at: string;
  duration_minutes?: number | null;
  task_title?: string;
}

export interface CreateEventPayload {
  title: string;
  starts_at: string;
  ends_at: string;
  description?: string | null;
  location?: string | null;
  source_thought_id?: string | null;
  source_recording_id?: string | null;
}

export interface ReorderDayPayload {
  /** Ordered list of (task_id, new_scheduled_at) — preserves duration_minutes. */
  moves: Array<{
    task_id: string;
    new_scheduled_at: string;
    task_title?: string;
  }>;
}

export interface CompleteTaskPayload {
  task_id: string;
  task_title?: string;
}

export interface SplitTaskPayload {
  source_task_id: string;
  source_task_title?: string;
  /** New child tasks. Each becomes a sibling or child of the source. */
  parts: Array<{ title: string; duration_minutes?: number | null }>;
  /** If true, complete the source task once parts are created. */
  archive_source?: boolean;
}

export type ProposalPayload =
  | { kind: "move_task"; payload: MoveTaskPayload }
  | { kind: "schedule_task"; payload: ScheduleTaskPayload }
  | { kind: "create_event"; payload: CreateEventPayload }
  | { kind: "reorder_day"; payload: ReorderDayPayload }
  | { kind: "complete_task"; payload: CompleteTaskPayload }
  | { kind: "split_task"; payload: SplitTaskPayload };

export type Proposal = ProposalPayload & {
  /** Stable client-generated id (uuid) — survives rounds of edits. */
  id: string;
  /** One-sentence Hebrew rationale to show under the proposal card. */
  reason: string;
};

export type ProposalDecisionState = "approved" | "dismissed" | "edited";

export interface ProposalDecision {
  state: ProposalDecisionState;
  applied_at?: string;
  /** id of the entity created/affected (task_id, event_id, ...) once applied. */
  applied_target_id?: string;
  /** When state==='edited', the snapshot of the user-edited payload. */
  edited_payload?: ProposalPayload["payload"];
}

export type ProposalDecisions = Record<string, ProposalDecision>;

export interface DailyBrief extends Omit<DailyBriefRow, "output" | "proposals" | "proposal_decisions"> {
  output: BriefOutput;
  proposals: Proposal[];
  proposal_decisions: ProposalDecisions;
}

// Filter payload shape stored in user_saved_filters.filter_config -------------

export interface FilterConfig {
  projects?: string[];
  lists?: string[];
  statuses?: string[];
  urgencyMin?: number;
  urgencyMax?: number;
  tags?: string[];
  assignees?: string[];
  sources?: string[];
  dueBefore?: string;
  dueAfter?: string;
  scheduledBefore?: string;
  scheduledAfter?: string;
  onlyMine?: boolean;
  onlyWithTimer?: boolean;
  onlyOverBudget?: boolean;
  pricingModes?: ProjectPricingMode[];
}

// Dashboard layout shape stored in user_dashboard_layouts.layout_* ------------

export interface WidgetLayoutItem {
  i: string;         // widget key
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
}

export type WidgetLayout = WidgetLayoutItem[];

export interface WidgetState {
  [widgetKey: string]: {
    collapsed?: boolean;
    hidden?: boolean;
    config?: Record<string, unknown>;
  };
}
