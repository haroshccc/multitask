import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Play,
  Pause,
  Calendar as CalendarIcon,
  Clock,
  ListTodo,
  Paperclip,
  History,
  Trash2,
  Plus,
  Mic,
  Lightbulb,
  Link as LinkIcon,
  FileText,
  MapPin,
  Pencil,
  ExternalLink,
  Save,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useTask,
  useUpdateTask,
  useCompleteTask,
  useCreateTask,
  useDeleteTask,
} from "@/lib/hooks/useTasks";
import { pushUndo } from "@/lib/undo/store";
import { useThought } from "@/lib/hooks/useThoughts";
import { ThoughtEditModal } from "@/components/thoughts/ThoughtEditModal";
import { RrulePicker } from "@/components/calendar/RrulePicker";
import {
  useActiveTimer,
  useStartTimer,
  useStopTimer,
  useTaskTimeEntries,
  useCreateManualTimeEntry,
  useUpdateTimeEntry,
  useDeleteTimeEntry,
} from "@/lib/hooks/useTimer";
import { useTimeUnit, formatSeconds, type TimeUnit } from "@/lib/hooks/useTimeUnit";
import { useTaskLists } from "@/lib/hooks/useTaskLists";
import {
  useMyTaskStatuses,
  useCreateUserTaskStatus,
  useUpdateUserTaskStatus,
} from "@/lib/hooks/useUserTaskStatuses";
import { slugifyStatusKey } from "@/lib/services/user-task-statuses";
import { useOrgMembers } from "@/lib/hooks/useOrgMembers";
import { useAuth } from "@/lib/auth/AuthContext";
import type { TimeEntry, UserTaskStatus } from "@/lib/types/domain";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import {
  DurationInput,
  hoursToMinutes,
  minutesToHours,
} from "@/components/ui/DurationInput";
import { TaskDependenciesSection } from "@/components/tasks/TaskDependenciesSection";
import { PlanVsActualBar } from "@/components/tasks/PlanVsActualBar";
import { UnsavedChangesGuard } from "@/components/ui/UnsavedChangesGuard";

/** Initial draft for create mode — only fields the caller wants to pre-fill. */
export interface TaskCreateDraft {
  title?: string;
  description?: string | null;
  task_list_id?: string | null;
  scheduled_at?: string | null;
  duration_minutes?: number | null;
  estimated_hours?: number | null;
  urgency?: number;
  status?: string;
  source_thought_id?: string | null;
  tags?: string[];
}

interface TaskEditModalProps {
  /** When non-null = edit mode. */
  taskId: string | null;
  onClose: () => void;
  /** Which tab should be active when the modal opens. Default "overview". */
  defaultTab?: "overview" | "schedule" | "history" | "attachments";
  /**
   * When provided AND `taskId` is null, the modal opens in **create mode**:
   * the form is pre-filled from the draft, "save" creates the task, and
   * the new id is reported via `onCreated` ONLY on a successful save.
   * Closing without saving does NOT create anything.
   */
  createDraft?: TaskCreateDraft | null;
  /** Fires once after the create-mode save completes. */
  onCreated?: (taskId: string) => void;
  /**
   * Optional UI strip rendered at the top of the modal in CREATE mode
   * only — used by Calendar's "create event/task picker" so the user
   * can flip between event and task without losing the time/date context.
   */
  topSlot?: React.ReactNode;
}

type Tab = "overview" | "schedule" | "history" | "attachments";

export function TaskEditModal({
  taskId,
  onClose,
  defaultTab = "overview",
  createDraft = null,
  onCreated,
  topSlot,
}: TaskEditModalProps) {
  const isCreate = !taskId && !!createDraft;
  const open = !!taskId || isCreate;
  const { data: task } = useTask(taskId);
  const { data: lists = [] } = useTaskLists();
  const { data: myStatuses = [] } = useMyTaskStatuses();
  const { data: orgMembers = [] } = useOrgMembers();
  const { user } = useAuth();
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const createTask = useCreateTask();
  const deleteTaskM = useDeleteTask();

  const [tab, setTab] = useState<Tab>(defaultTab);

  // If the caller changes `defaultTab`, honour it on re-open.
  useEffect(() => {
    if (open) setTab(defaultTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, isCreate]);

  // Local draft state — committed to DB only via the explicit save button
  // (or via the unsaved-changes guard on close). Autosave-on-blur was
  // removed in favor of full draft mode so the user has a single, clear
  // mental model: edit → save (or close → guard).
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [urgency, setUrgency] = useState<number>(0);
  const [status, setStatus] = useState<string>("todo");
  const [listId, setListId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState<string | null>(null); // ISO
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null); // ISO — hard deadline, distinct from scheduledAt
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(null);

  // Recurring tasks need a scheduled_at to anchor expansion. When the user
  // enables recurrence on a task with no scheduled_at, anchor to today.
  // If the rule has a specific time (BYHOUR) use it; otherwise use start-of-day.
  useEffect(() => {
    if (!recurrenceRule) return;
    if (scheduledAt) return;
    const hourMatch = recurrenceRule.match(/BYHOUR=(\d+)/);
    const minuteMatch = recurrenceRule.match(/BYMINUTE=(\d+)/);
    const today = new Date();
    if (hourMatch) {
      today.setHours(Number(hourMatch[1]), minuteMatch ? Number(minuteMatch[1]) : 0, 0, 0);
    } else {
      today.setHours(0, 0, 0, 0);
    }
    setScheduledAt(today.toISOString());
  }, [recurrenceRule, scheduledAt]);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [requiresApproval, setRequiresApproval] = useState<boolean>(false);
  const [approverId, setApproverId] = useState<string | null>(null);
  const [isPhase, setIsPhase] = useState<boolean>(false);

  // Goal / habit configuration. A task is a goal iff goalEnabled === true.
  // When disabled, all goal_* columns are written as null (or default true
  // for goal_track_time, which has a NOT NULL default).
  const [goalEnabled, setGoalEnabled] = useState<boolean>(false);
  const [goalPeriod, setGoalPeriod] = useState<"day" | "week" | "month">("week");
  const [goalTarget, setGoalTarget] = useState<number>(3);
  /** "Ongoing" — true means no end milestone, just track forever. */
  const [goalForever, setGoalForever] = useState<boolean>(true);
  const [goalMinStreak, setGoalMinStreak] = useState<number>(4);
  /** YYYY-MM-DD; null means "use today" at save time. */
  const [goalStartedOn, setGoalStartedOn] = useState<string | null>(null);
  const [goalTrackTime, setGoalTrackTime] = useState<boolean>(true);

  useEffect(() => {
    // Edit mode: hydrate from the persisted task.
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setNotes(task.notes ?? "");
      setUrgency(task.urgency);
      setStatus(task.status);
      setListId(task.task_list_id);
      setTags(task.tags ?? []);
      setLocation(task.location ?? "");
      setExternalUrl(task.external_url ?? "");
      setScheduledAt(task.scheduled_at ?? null);
      setDeadlineAt(task.deadline_at ?? null);
      setRecurrenceRule(task.recurrence_rule ?? null);
      setAssigneeId(task.assignee_user_id ?? null);
      setRequiresApproval(task.requires_approval ?? false);
      setApproverId(task.approver_user_id ?? null);
      setDurationMinutes(task.duration_minutes ?? null);
      setEstimatedMinutes(hoursToMinutes(task.estimated_hours ?? null));
      setIsPhase(!!task.is_phase);
      setGoalEnabled(!!task.goal_period);
      setGoalPeriod(
        (task.goal_period as "day" | "week" | "month" | null) ?? "week"
      );
      setGoalTarget(task.goal_target ?? 3);
      setGoalForever(task.goal_min_streak_periods == null);
      setGoalMinStreak(task.goal_min_streak_periods ?? 4);
      setGoalStartedOn(task.goal_started_on ?? null);
      setGoalTrackTime(task.goal_track_time ?? true);
      return;
    }
    // Create mode: seed from the draft (if any). Closing without saving
    // never creates anything.
    if (isCreate && createDraft) {
      setTitle(createDraft.title ?? "");
      setDescription(createDraft.description ?? "");
      setNotes("");
      setUrgency(createDraft.urgency ?? 0);
      setStatus(createDraft.status ?? "todo");
      setListId(createDraft.task_list_id ?? null);
      setTags(createDraft.tags ?? []);
      setLocation("");
      setExternalUrl("");
      setScheduledAt(createDraft.scheduled_at ?? null);
      setDeadlineAt(null);
      setRecurrenceRule(null);
      setAssigneeId(null);
      setDurationMinutes(createDraft.duration_minutes ?? null);
      setEstimatedMinutes(
        createDraft.estimated_hours != null
          ? hoursToMinutes(createDraft.estimated_hours)
          : null
      );
      setIsPhase(false);
      setGoalEnabled(false);
      setGoalPeriod("week");
      setGoalTarget(3);
      setGoalForever(true);
      setGoalMinStreak(4);
      setGoalStartedOn(null);
      setGoalTrackTime(true);
    }
  }, [task?.id, isCreate]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Dirty:
   *  - edit mode: any draft field differs from the persisted task row.
   *  - create mode: the user typed at least a title (the form is otherwise
   *    pre-filled by the draft, which we don't count as "their changes").
   */
  const dirty = useMemo(() => {
    if (isCreate) return title.trim().length > 0;
    if (!task) return false;
    const tagsEqual =
      tags.length === (task.tags?.length ?? 0) &&
      tags.every((x, i) => x === task.tags?.[i]);
    return (
      (title.trim() || task.title) !== task.title ||
      description !== (task.description ?? "") ||
      notes !== (task.notes ?? "") ||
      urgency !== task.urgency ||
      status !== task.status ||
      listId !== task.task_list_id ||
      assigneeId !== (task.assignee_user_id ?? null) ||
      requiresApproval !== (task.requires_approval ?? false) ||
      approverId !== (task.approver_user_id ?? null) ||
      location !== (task.location ?? "") ||
      externalUrl !== (task.external_url ?? "") ||
      scheduledAt !== (task.scheduled_at ?? null) ||
      deadlineAt !== (task.deadline_at ?? null) ||
      recurrenceRule !== (task.recurrence_rule ?? null) ||
      durationMinutes !== (task.duration_minutes ?? null) ||
      estimatedMinutes !== hoursToMinutes(task.estimated_hours ?? null) ||
      isPhase !== !!task.is_phase ||
      goalEnabled !== !!task.goal_period ||
      (goalEnabled &&
        (goalPeriod !== task.goal_period ||
          goalTarget !== (task.goal_target ?? null) ||
          goalForever !== (task.goal_min_streak_periods == null) ||
          (!goalForever &&
            goalMinStreak !== (task.goal_min_streak_periods ?? null)) ||
          goalStartedOn !== (task.goal_started_on ?? null) ||
          goalTrackTime !== (task.goal_track_time ?? true))) ||
      !tagsEqual
    );
  }, [
    isCreate,
    task,
    title,
    description,
    notes,
    urgency,
    status,
    listId,
    assigneeId,
    requiresApproval,
    approverId,
    location,
    externalUrl,
    scheduledAt,
    deadlineAt,
    recurrenceRule,
    durationMinutes,
    estimatedMinutes,
    isPhase,
    tags,
    goalEnabled,
    goalPeriod,
    goalTarget,
    goalForever,
    goalMinStreak,
    goalStartedOn,
    goalTrackTime,
  ]);

  const [guardOpen, setGuardOpen] = useState(false);

  const saveAll = async (): Promise<boolean> => {
    // Create mode — the entity does not exist yet. Build it now, surface
    // its id via `onCreated`, then close. If the user discards instead,
    // nothing is created.
    if (isCreate) {
      if (!title.trim()) return false;
      try {
        const payload = {
          title: title.trim(),
          description: description || null,
          notes: notes || null,
          urgency,
          status,
          task_list_id: listId,
          parent_task_id: null,
          assignee_user_id: assigneeId,
          requires_approval: requiresApproval,
          approver_user_id: requiresApproval ? approverId : null,
          tags,
          location: location || null,
          external_url: externalUrl || null,
          scheduled_at: scheduledAt,
          deadline_at: deadlineAt,
          recurrence_rule: recurrenceRule,
          duration_minutes: durationMinutes,
          estimated_hours:
            estimatedMinutes != null ? minutesToHours(estimatedMinutes) : null,
          is_phase: isPhase,
          goal_period: goalEnabled ? goalPeriod : null,
          goal_target: goalEnabled ? goalTarget : null,
          goal_min_streak_periods: goalEnabled
            ? goalForever
              ? null
              : goalMinStreak
            : null,
          goal_started_on: goalEnabled
            ? goalStartedOn ?? new Date().toISOString().slice(0, 10)
            : null,
          goal_track_time: goalEnabled ? goalTrackTime : true,
          source_thought_id: createDraft?.source_thought_id ?? null,
        };
        const created = await createTask.mutateAsync(payload);
        pushUndo({
          description: "יצירת משימה",
          undo: () => deleteTaskM.mutate(created.id),
          redo: () => createTask.mutate(payload),
        });
        onCreated?.(created.id);
        return true;
      } catch {
        return false;
      }
    }

    if (!task) return true;
    // Snapshot the previous state of every editable field so the undo entry
    // can put the task back exactly where it was — title, schedule, list,
    // tags, the lot. One Ctrl+Z reverses the whole save.
    const prevPatch = {
      title: task.title,
      description: task.description,
      notes: task.notes,
      urgency: task.urgency,
      status: task.status,
      task_list_id: task.task_list_id,
      assignee_user_id: task.assignee_user_id,
      requires_approval: task.requires_approval,
      approver_user_id: task.approver_user_id,
      tags: task.tags,
      location: task.location,
      external_url: task.external_url,
      scheduled_at: task.scheduled_at,
      deadline_at: task.deadline_at,
      recurrence_rule: task.recurrence_rule,
      duration_minutes: task.duration_minutes,
      estimated_hours: task.estimated_hours,
      is_phase: task.is_phase,
      goal_period: task.goal_period,
      goal_target: task.goal_target,
      goal_min_streak_periods: task.goal_min_streak_periods,
      goal_started_on: task.goal_started_on,
      goal_track_time: task.goal_track_time,
    };
    const newPatch = {
      title: title.trim() || task.title,
      description: description || null,
      notes: notes || null,
      urgency,
      status,
      task_list_id: listId,
      assignee_user_id: assigneeId,
      requires_approval: requiresApproval,
      approver_user_id: requiresApproval ? approverId : null,
      tags,
      location: location || null,
      external_url: externalUrl || null,
      scheduled_at: scheduledAt,
      deadline_at: deadlineAt,
      recurrence_rule: recurrenceRule,
      duration_minutes: durationMinutes,
      estimated_hours:
        estimatedMinutes != null ? minutesToHours(estimatedMinutes) : null,
      is_phase: isPhase,
      goal_period: goalEnabled ? goalPeriod : null,
      goal_target: goalEnabled ? goalTarget : null,
      goal_min_streak_periods: goalEnabled
        ? goalForever
          ? null
          : goalMinStreak
        : null,
      goal_started_on: goalEnabled
        ? goalStartedOn ?? new Date().toISOString().slice(0, 10)
        : null,
      goal_track_time: goalEnabled ? goalTrackTime : true,
    };
    try {
      await updateTask.mutateAsync({ taskId: task.id, patch: newPatch });
      pushUndo({
        description: "עריכת משימה",
        undo: () => updateTask.mutate({ taskId: task.id, patch: prevPatch }),
        redo: () => updateTask.mutate({ taskId: task.id, patch: newPatch }),
      });
      return true;
    } catch {
      return false;
    }
  };

  const handleClose = () => {
    if (dirty) {
      setGuardOpen(true);
      return;
    }
    onClose();
  };

  if (!task && !open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-lift w-full max-w-3xl my-8 overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  onClick={() =>
                    completeTask.mutate({
                      taskId: task!.id,
                      completed: !task!.completed_at,
                    })
                  }
                  className={cn(
                    "w-6 h-6 rounded-md border-2 shrink-0 flex items-center justify-center transition-all",
                    task?.completed_at
                      ? "bg-success-500 border-success-500 text-white"
                      : "border-ink-300 hover:border-ink-500"
                  )}
                  aria-label="השלם"
                  disabled={!task}
                >
                  {task?.completed_at && (
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-4 h-4"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 5.29a1 1 0 010 1.415l-8 8a1 1 0 01-1.415 0l-4-4a1 1 0 011.415-1.414L8 12.586l7.29-7.293a1 1 0 011.415 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="שם המשימה"
                  className="text-lg font-semibold text-ink-900 bg-transparent border-0 outline-none flex-1 min-w-0"
                />
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg hover:bg-ink-100"
              >
                <X className="w-4 h-4 text-ink-600" />
              </button>
            </div>

            {isCreate && topSlot && (
              <div className="px-5 py-2 border-b border-ink-200 bg-ink-50/40">
                {topSlot}
              </div>
            )}

            {/* Tabs */}
            <div className="border-b border-ink-200 px-3 flex items-center gap-1 text-sm">
              <TabBtn active={tab === "overview"} onClick={() => setTab("overview")}>
                <ListTodo className="w-4 h-4" />
                פרטים
              </TabBtn>
              <TabBtn active={tab === "schedule"} onClick={() => setTab("schedule")}>
                <CalendarIcon className="w-4 h-4" />
                תזמון
              </TabBtn>
              <TabBtn active={tab === "history"} onClick={() => setTab("history")}>
                <History className="w-4 h-4" />
                זמן
              </TabBtn>
              <TabBtn active={tab === "attachments"} onClick={() => setTab("attachments")}>
                <Paperclip className="w-4 h-4" />
                צירופים
              </TabBtn>
            </div>

            {/* Body */}
            <div className="p-5 max-h-[calc(100vh-16rem)] overflow-y-auto">
              {tab === "overview" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="סטטוס">
                      <StatusPicker
                        value={status}
                        statuses={myStatuses}
                        onChange={setStatus}
                      />
                    </Field>
                    <Field label="רשימה">
                      <select
                        value={listId ?? ""}
                        onChange={(e) => setListId(e.target.value || null)}
                        className="field"
                      >
                        <option value="">לא משויכת</option>
                        {lists.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.emoji && !l.emoji.startsWith("icon:")
                              ? `${l.emoji} `
                              : ""}
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="דחיפות">
                      <UrgencyBars value={urgency} onChange={setUrgency} />
                    </Field>
                    <Field label="אחראי">
                      <AssigneePicker
                        value={assigneeId}
                        members={orgMembers}
                        onChange={setAssigneeId}
                      />
                    </Field>
                  </div>

                  {/* Approval workflow */}
                  <div className="rounded-xl border border-ink-200 p-3 space-y-2.5">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={requiresApproval}
                        onChange={(e) => setRequiresApproval(e.target.checked)}
                        className="w-4 h-4 rounded accent-primary-500"
                      />
                      <span className="text-sm font-medium text-ink-700">דורש אישור לסיום</span>
                    </label>

                    {requiresApproval && (
                      <Field label="מי מאשר?">
                        <AssigneePicker
                          value={approverId}
                          members={orgMembers}
                          onChange={setApproverId}
                          placeholder="בחר מאשר..."
                        />
                      </Field>
                    )}

                    {/* Assignee action: submit for approval */}
                    {task && task.requires_approval &&
                      task.assignee_user_id === user?.id &&
                      task.status === "in_progress" &&
                      !task.completion_submitted_at && (
                      <button
                        type="button"
                        onClick={async () => {
                          await updateTask.mutateAsync({
                            taskId: task.id,
                            patch: {
                              completion_submitted_at: new Date().toISOString(),
                              status: "pending_approval",
                            },
                          });
                        }}
                        className="w-full py-2 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
                      >
                        ✓ שלח לאישור
                      </button>
                    )}

                    {/* Pending badge for assignee */}
                    {task && task.status === "pending_approval" &&
                      task.assignee_user_id === user?.id &&
                      task.approver_user_id !== user?.id && (
                      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
                        <span>⏳</span>
                        <span>ממתין לאישור</span>
                      </div>
                    )}

                    {/* Approver actions: approve / reject */}
                    {task && task.status === "pending_approval" &&
                      task.approver_user_id === user?.id && (
                      <div className="space-y-2">
                        <div className="text-xs text-ink-500 text-center">ממתין לאישורך</div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await updateTask.mutateAsync({
                                taskId: task.id,
                                patch: {
                                  status: "done",
                                  approved_at: new Date().toISOString(),
                                  approved_by_user_id: user.id,
                                },
                              });
                              onClose();
                            }}
                            className="py-2 rounded-xl bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors"
                          >
                            ✓ אשר
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await updateTask.mutateAsync({
                                taskId: task.id,
                                patch: {
                                  status: "in_progress",
                                  completion_submitted_at: null,
                                },
                              });
                            }}
                            className="py-2 rounded-xl bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200 transition-colors"
                          >
                            ✗ דחה
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <Field label="תיאור">
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="field min-h-[80px] resize-y"
                      placeholder="פרטים על המשימה..."
                    />
                  </Field>

                  <Field label="תגים">
                    <TagInput tags={tags} onChange={setTags} onBlur={() => {}} />
                  </Field>

                  <Field label="הערות">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="field min-h-[60px] resize-y"
                    />
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="מיקום">
                      <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="field"
                      />
                    </Field>
                    <Field label="קישור חיצוני">
                      <input
                        type="url"
                        value={externalUrl}
                        onChange={(e) => setExternalUrl(e.target.value)}
                        className="field"
                        dir="ltr"
                      />
                    </Field>
                  </div>

                  {/* Phase toggle — only allowed for top-level tasks. A phase
                      groups children under a single lifecycle band; planned
                      vs. actual is shown as an overage stripe in Gantt /
                      Calendar (SPEC §15.11 / §16 / §17). */}
                  {task && task.parent_task_id === null && (
                    <label className="flex items-start gap-2 cursor-pointer select-none p-2 rounded-md border border-ink-200 hover:bg-ink-50">
                      <input
                        type="checkbox"
                        checked={isPhase}
                        onChange={(e) => setIsPhase(e.target.checked)}
                        className="w-4 h-4 mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium text-ink-900">
                          הגדר כשלב
                        </div>
                        <div className="text-[11px] text-ink-500">
                          שלב מקבץ תחתיו תתי-משימות ומופיע כרצועת-זמן רחבה
                          ביומן וב-Gantt כשרואים את הרשימה לבדה.
                        </div>
                      </div>
                    </label>
                  )}

                  {task?.source_thought_id && (
                    <TaskSourceThoughtRow thoughtId={task.source_thought_id} />
                  )}
                </div>
              )}

              {tab === "schedule" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field
                      label="זמן עבודה מתוכנן"
                      hint="מתי את מתכננת לעבוד עליה"
                    >
                      <DateTimePicker
                        value={scheduledAt}
                        onChange={setScheduledAt}
                      />
                    </Field>
                    <Field label="משך">
                      <DurationInput
                        value={durationMinutes}
                        onChange={setDurationMinutes}
                        placeholder="00:00"
                        ariaLabel="משך משימה"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field
                      label="דד-ליין"
                      hint="הזמן האחרון לביצוע — שונה מהזמן המתוכנן"
                    >
                      <DateTimePicker
                        value={deadlineAt}
                        onChange={setDeadlineAt}
                      />
                    </Field>
                  </div>

                  <div className="pt-2 border-t border-ink-200">
                    <Field
                      label="חזרה"
                      hint="המשימה תופיע ביומן בכל מופע של הכלל. סימון מופע בודד אינו סוגר את הסדרה."
                    >
                      <RrulePicker
                        value={recurrenceRule}
                        onChange={setRecurrenceRule}
                        anchorDate={scheduledAt ? new Date(scheduledAt) : null}
                      />
                    </Field>
                  </div>

                  <div className="pt-2 border-t border-ink-200">
                    <GoalConfigSection
                      enabled={goalEnabled}
                      setEnabled={(v) => {
                        setGoalEnabled(v);
                        // A goal needs recurrence to be tracked. Auto-enable
                        // a sensible default (daily) when the user turns on a
                        // goal without having set one yet.
                        if (v && !recurrenceRule) {
                          setRecurrenceRule("FREQ=DAILY");
                        }
                      }}
                      hasRecurrence={!!recurrenceRule}
                      period={goalPeriod}
                      setPeriod={setGoalPeriod}
                      target={goalTarget}
                      setTarget={setGoalTarget}
                      forever={goalForever}
                      setForever={setGoalForever}
                      minStreak={goalMinStreak}
                      setMinStreak={setGoalMinStreak}
                      startedOn={goalStartedOn}
                      setStartedOn={setGoalStartedOn}
                      trackTime={goalTrackTime}
                      setTrackTime={setGoalTrackTime}
                    />
                  </div>

                  <div className="pt-2 border-t border-ink-200">
                    {task && <TaskDependenciesSection taskId={task.id} />}
                  </div>

                  <p className="text-xs text-ink-400">
                    הערכת שעות בפועל עברה לטאב "זמן" ליד הסטופר.
                  </p>
                </div>
              )}

              {tab === "history" && task && (
                <div className="space-y-4">
                  <Field label="הערכת שעות (לתכנון)">
                    <DurationInput
                      value={estimatedMinutes}
                      onChange={setEstimatedMinutes}
                      placeholder="00:00"
                      ariaLabel="הערכת שעות"
                    />
                  </Field>
                  <TimeEntriesTab task={task} />
                </div>
              )}

              {tab === "attachments" && <AttachmentsTab />}
            </div>

            {/* Footer: explicit save. The autosave-on-blur in each field
                still works (typing → blur → mutate), so this button is the
                "commit unblurred edits" affordance + the visible save
                indicator the user wants. */}
            <div className="px-5 py-3 border-t border-ink-200 flex items-center justify-end gap-2">
              {dirty && (
                <span className="text-[11px] text-warning-600 me-auto">
                  יש שינויים לא שמורים
                </span>
              )}
              <button
                onClick={handleClose}
                className="btn-ghost text-sm"
                type="button"
              >
                סגור
              </button>
              <button
                onClick={async () => {
                  const ok = await saveAll();
                  if (ok) onClose();
                }}
                disabled={!dirty || updateTask.isPending}
                className={cn(
                  "btn-primary text-sm",
                  (!dirty || updateTask.isPending) &&
                    "opacity-40 cursor-not-allowed"
                )}
                type="button"
              >
                <Save className="w-3.5 h-3.5" />
                {updateTask.isPending ? "שומר..." : "שמור"}
              </button>
            </div>
          </motion.div>

          <UnsavedChangesGuard
            open={guardOpen}
            saving={updateTask.isPending}
            onSaveAndClose={async () => {
              const ok = await saveAll();
              if (ok) {
                setGuardOpen(false);
                onClose();
              }
            }}
            onDiscardAndClose={() => {
              setGuardOpen(false);
              onClose();
            }}
            onCancel={() => setGuardOpen(false)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * "מקור" row shown in the overview tab when the task was created from a
 * thought. Clicking the link opens the thought's own edit modal in place
 * so the user can see the original context without leaving the task.
 */
function TaskSourceThoughtRow({ thoughtId }: { thoughtId: string }) {
  const { data: thought } = useThought(thoughtId);
  const [open, setOpen] = useState(false);
  if (!thought) return null;
  const label =
    thought.ai_generated_title ??
    (thought.text_content ?? "מחשבה").slice(0, 80);
  return (
    <>
      <div className="p-2 rounded-md border border-ink-200 bg-ink-50/40 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-accent-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-ink-500">נוצרה מהמחשבה</div>
          <div className="text-sm text-ink-900 truncate">{label}</div>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
          type="button"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          פתח
        </button>
      </div>
      <ThoughtEditModal
        thoughtId={open ? thoughtId : null}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-2 border-b-2 -mb-px transition-colors",
        active
          ? "border-primary-500 text-primary-700 font-medium"
          : "border-transparent text-ink-600 hover:text-ink-900"
      )}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="eyebrow mb-1 block">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-ink-400 mt-1">{hint}</p>}
    </div>
  );
}

// =============================================================================
// Goal / habit configuration section, rendered inside the schedule tab right
// after recurrence. Toggling "הגדר כיעד" off writes nulls to all goal_*
// columns at save time; the section just hides the inputs locally.
// =============================================================================

const GOAL_PERIOD_OPTIONS: Array<{
  id: "day" | "week" | "month";
  label: string;
  /** Word used in "X פעמים ב…". */
  perLabel: string;
  /** Word used for the streak unit ("ימים" / "שבועות" / "חודשים"). */
  unitLabel: string;
}> = [
  { id: "day", label: "יומי", perLabel: "ביום", unitLabel: "ימים" },
  { id: "week", label: "שבועי", perLabel: "בשבוע", unitLabel: "שבועות" },
  { id: "month", label: "חודשי", perLabel: "בחודש", unitLabel: "חודשים" },
];

function GoalConfigSection(props: {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  hasRecurrence: boolean;
  period: "day" | "week" | "month";
  setPeriod: (v: "day" | "week" | "month") => void;
  target: number;
  setTarget: (v: number) => void;
  forever: boolean;
  setForever: (v: boolean) => void;
  minStreak: number;
  setMinStreak: (v: number) => void;
  startedOn: string | null;
  setStartedOn: (v: string | null) => void;
  trackTime: boolean;
  setTrackTime: (v: boolean) => void;
}) {
  const {
    enabled,
    setEnabled,
    hasRecurrence,
    period,
    setPeriod,
    target,
    setTarget,
    forever,
    setForever,
    minStreak,
    setMinStreak,
    startedOn,
    setStartedOn,
    trackTime,
    setTrackTime,
  } = props;
  const periodMeta =
    GOAL_PERIOD_OPTIONS.find((p) => p.id === period) ?? GOAL_PERIOD_OPTIONS[1];

  return (
    <div>
      <div className="eyebrow mb-1 flex items-center gap-1.5">
        <Target className="w-3.5 h-3.5" />
        יעד / הרגל
      </div>
      <div className="space-y-2.5">
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-ink-300 text-primary-600 focus:ring-primary-500"
          />
          <span>הגדר כיעד</span>
        </label>

        {enabled && !hasRecurrence && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
            יעד ללא חזרה לא יימדד — הגדר חזרה בטאב "תזמון".
          </div>
        )}

        {enabled && (
          <div className="space-y-2.5 ps-6 border-s-2 border-primary-100">
            {/* Target + period on one row */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-ink-700">לבצע</span>
              <div className="inline-flex items-center gap-2">
                <div className="inline-flex items-center border border-ink-200 rounded-md overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setTarget(Math.max(1, target - 1))}
                    className="px-2.5 py-1.5 text-ink-500 hover:bg-ink-100 active:bg-ink-200 text-sm leading-none select-none"
                    aria-label="הפחת"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-medium text-ink-900 tabular-nums select-none">
                    {target}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTarget(target + 1)}
                    className="px-2.5 py-1.5 text-ink-500 hover:bg-ink-100 active:bg-ink-200 text-sm leading-none select-none"
                    aria-label="הוסף"
                  >
                    +
                  </button>
                </div>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as "day" | "week" | "month")}
                  className="field text-sm py-1"
                >
                  {GOAL_PERIOD_OPTIONS.map((p) => (
                    <option key={p.id} value={p.id}>{p.perLabel}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Forever toggle + min streak */}
            <div className="space-y-1.5">
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={forever}
                  onChange={(e) => setForever(e.target.checked)}
                  className="w-4 h-4 rounded border-ink-300 text-primary-600 focus:ring-primary-500"
                />
                <span>ללא סיום (ההרגל ימשיך לעד)</span>
              </label>
              {!forever && (
                <div className="flex items-center gap-2 flex-wrap text-sm ps-6">
                  <span className="text-ink-700">אבן דרך ראשונה:</span>
                  <div className="inline-flex items-center border border-ink-200 rounded-md overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => setMinStreak(Math.max(1, minStreak - 1))}
                      className="px-2.5 py-1.5 text-ink-500 hover:bg-ink-100 active:bg-ink-200 text-sm leading-none select-none"
                      aria-label="הפחת"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-medium text-ink-900 tabular-nums select-none">
                      {minStreak}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMinStreak(minStreak + 1)}
                      className="px-2.5 py-1.5 text-ink-500 hover:bg-ink-100 active:bg-ink-200 text-sm leading-none select-none"
                      aria-label="הוסף"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-ink-700">{periodMeta.unitLabel} ברצף</span>
                </div>
              )}
            </div>

            {/* Started-on date */}
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="text-ink-700">התחלת מעקב:</span>
              <input
                type="date"
                value={startedOn ?? ""}
                onChange={(e) => setStartedOn(e.target.value || null)}
                className="field text-sm py-1.5 w-auto"
                placeholder="היום"
              />
              <span className="text-[11px] text-ink-400">
                ריק = יישמר היום אוטומטית
              </span>
            </div>

            {/* Track time? */}
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={trackTime}
                onChange={(e) => setTrackTime(e.target.checked)}
                className="w-4 h-4 rounded border-ink-300 text-primary-600 focus:ring-primary-500"
              />
              <span>עקבי גם אחרי זמן בפועל (סטופר/הזנה ידנית)</span>
            </label>
            <p className="text-[11px] text-ink-400 ps-6 -mt-1">
              כבוי = לא ניצור תזכורות "פעימה ללא זמן" עבור משימה זו.
            </p>
          </div>
        )}
        {!enabled && (
          <p className="text-[11px] text-ink-400">
            הפכי את המשימה ליעד עם מעקב סטריק והתקדמות שבועית/חודשית.
          </p>
        )}
      </div>
    </div>
  );
}

function UrgencyBars({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const filled = Math.min(3, Math.max(0, value));
  return (
    <div className="flex items-center gap-2">
      {[0, 1, 2, 3].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={cn(
            "flex flex-col items-center gap-1 p-2 rounded-lg border transition-colors",
            n === filled
              ? "border-primary-500 bg-primary-50"
              : "border-ink-200 bg-white hover:bg-ink-50"
          )}
          title={n === 0 ? "ללא דירוג" : `${n}/3`}
        >
          {n === 0 ? (
            <span className="h-[16px] flex items-center justify-center text-ink-400 text-sm">
              ∅
            </span>
          ) : (
            <div className="flex flex-col items-center gap-[3px]">
              {[3, 2, 1].map((row) => (
                <span
                  key={row}
                  className={cn(
                    "h-[3px] w-6 rounded-sm",
                    row <= n ? "bg-ink-900" : "bg-ink-200"
                  )}
                />
              ))}
            </div>
          )}
          <span className="text-[10px] font-mono text-ink-500">{n}</span>
        </button>
      ))}
    </div>
  );
}

function AssigneePicker({
  value,
  members,
  onChange,
  placeholder = "ללא הקצאה",
}: {
  value: string | null;
  members: { membership: { user_id: string }; profile: { full_name: string | null; avatar_url: string | null } | null }[];
  onChange: (userId: string | null) => void;
  placeholder?: string;
}) {
  const current = members.find((m) => m.membership.user_id === value);
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="field"
    >
      <option value="">{placeholder}</option>
      {members.map((m) => {
        const name = m.profile?.full_name ?? m.membership.user_id;
        return (
          <option key={m.membership.user_id} value={m.membership.user_id}>
            {name}
          </option>
        );
      })}
      {/* If the current assignee isn't in the members list (edge case), keep
          them in the select so we don't silently drop the value. */}
      {value && !current && (
        <option value={value}>{value}</option>
      )}
    </select>
  );
}

function TagInput({
  tags,
  onChange,
  onBlur,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
  onBlur: () => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div className="field flex flex-wrap items-center gap-1 min-h-[40px] px-2 py-1.5">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-xs"
        >
          {t}
          <button
            onClick={() => onChange(tags.filter((x) => x !== t))}
            className="text-ink-500 hover:text-danger-500"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim()) {
            onChange([...tags, draft.trim()]);
            setDraft("");
          }
          onBlur();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            if (draft.trim()) {
              onChange([...tags, draft.trim()]);
              setDraft("");
            }
          }
          if (e.key === "Backspace" && !draft && tags.length > 0) {
            onChange(tags.slice(0, -1));
          }
        }}
        placeholder={tags.length === 0 ? "הקלד תג והקש Enter" : ""}
        className="flex-1 min-w-[80px] bg-transparent outline-none text-sm"
      />
    </div>
  );
}

function TimeEntriesTab({
  task,
}: {
  task: { id: string; actual_seconds: number; estimated_hours?: number | null };
}) {
  const { data: entries = [] } = useTaskTimeEntries(task.id);
  const { data: active } = useActiveTimer();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const createManual = useCreateManualTimeEntry();
  const updateEntry = useUpdateTimeEntry();
  const deleteEntry = useDeleteTimeEntry();
  const [showManual, setShowManual] = useState(false);
  const [timeUnit, setTimeUnit] = useTimeUnit();
  const isActive = active?.task_id === task.id;

  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [manualNote, setManualNote] = useState("");

  const addManual = async () => {
    if (!manualStart || !manualEnd) return;
    await createManual.mutateAsync({
      task_id: task.id,
      started_at: new Date(manualStart).toISOString(),
      ended_at: new Date(manualEnd).toISOString(),
      note: manualNote || null,
    });
    setManualStart("");
    setManualEnd("");
    setManualNote("");
    setShowManual(false);
  };

  const estimatedSeconds = task.estimated_hours
    ? Math.round(Number(task.estimated_hours) * 3600)
    : null;

  return (
    <div className="space-y-4">
      <div className="card-lift p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-ink-500" />
            <div>
              <div className="text-xs text-ink-500 flex items-center gap-2">
                סה"כ עד כה
                <UnitSwitch value={timeUnit} onChange={setTimeUnit} />
              </div>
              <div className="font-mono text-lg tabular-nums">
                {formatSeconds(task.actual_seconds, timeUnit)}
                {estimatedSeconds && (
                  <span className="text-sm text-ink-500 ms-2">
                    / {formatSeconds(estimatedSeconds, timeUnit)}
                  </span>
                )}
              </div>
            </div>
          </div>
          {isActive ? (
            <button onClick={() => stopTimer.mutate()} className="btn-primary text-sm">
              <Pause className="w-4 h-4" />
              עצור
            </button>
          ) : (
            <button
              onClick={() => startTimer.mutate({ taskId: task.id })}
              className="btn-accent text-sm"
            >
              <Play className="w-4 h-4" />
              התחל
            </button>
          )}
        </div>
        {/* Plan-vs-actual progress — visible regardless of estimate so users
            can eyeball how close they are to their budget in real time. */}
        <PlanVsActualBar
          estimatedSeconds={estimatedSeconds}
          actualSeconds={task.actual_seconds}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-sm text-ink-900">סשנים ({entries.length})</h4>
          <button
            onClick={() => setShowManual((v) => !v)}
            className="btn-ghost text-xs py-1 px-2"
          >
            <Plus className="w-3 h-3" />
            הוסף ידנית
          </button>
        </div>

        {showManual && (
          <div className="card p-3 space-y-2 mb-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="datetime-local"
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                className="field text-sm"
              />
              <input
                type="datetime-local"
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                className="field text-sm"
              />
            </div>
            <input
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
              placeholder="הערה (אופציונלי)"
              className="field text-sm"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowManual(false)} className="btn-ghost text-xs">
                בטל
              </button>
              <button onClick={addManual} className="btn-accent text-xs">
                שמור
              </button>
            </div>
          </div>
        )}

        {entries.length === 0 ? (
          <p className="text-sm text-ink-500 text-center py-6">אין סשנים עדיין</p>
        ) : (
          <ul className="divide-y divide-ink-200">
            {entries.map((e) => (
              <EntryRow
                key={e.id}
                entry={e}
                onUpdate={(patch) =>
                  updateEntry.mutate({ entryId: e.id, taskId: task.id, patch })
                }
                onDelete={() => deleteEntry.mutate({ entryId: e.id, taskId: task.id })}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  onUpdate,
  onDelete,
}: {
  entry: TimeEntry;
  onUpdate: (patch: Partial<TimeEntry>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(entry.started_at.slice(0, 16));
  const [end, setEnd] = useState(entry.ended_at?.slice(0, 16) ?? "");
  const [note, setNote] = useState(entry.note ?? "");

  if (editing) {
    return (
      <li className="py-2 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="field text-sm"
          />
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="field text-sm"
          />
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="הערה"
          className="field text-sm"
        />
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(false)} className="btn-ghost text-xs">
            בטל
          </button>
          <button
            onClick={() => {
              onUpdate({
                started_at: new Date(start).toISOString(),
                ended_at: end ? new Date(end).toISOString() : null,
                note: note || null,
              });
              setEditing(false);
            }}
            className="btn-accent text-xs"
          >
            שמור
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="py-2 flex items-center justify-between gap-2 text-sm">
      <div className="flex-1 min-w-0">
        <div className="text-ink-900">
          {new Date(entry.started_at).toLocaleString("he-IL")}
          {entry.ended_at && (
            <span className="text-ink-500 ms-2">
              ({formatDuration(entry.duration_seconds ?? 0)})
            </span>
          )}
          {!entry.ended_at && (
            <span className="chip-accent ms-2">פעיל</span>
          )}
        </div>
        {entry.note && <div className="text-xs text-ink-500 truncate">{entry.note}</div>}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-ink-600 hover:text-ink-900 px-2"
        >
          ערוך
        </button>
        <button onClick={onDelete} className="p-1 text-ink-500 hover:text-danger-500">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function UnitSwitch({
  value,
  onChange,
}: {
  value: TimeUnit;
  onChange: (v: TimeUnit) => void;
}) {
  const options: { v: TimeUnit; label: string }[] = [
    { v: "auto", label: "אוטו" },
    { v: "minutes", label: "דקות" },
    { v: "hours", label: "שעות" },
    { v: "days", label: "ימים" },
  ];
  return (
    <div className="inline-flex items-center rounded-lg bg-ink-100 p-0.5 text-[10px]">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "px-1.5 py-0.5 rounded-md transition-colors",
            o.v === value
              ? "bg-white text-ink-900 shadow-soft"
              : "text-ink-500 hover:text-ink-900"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Attachments tab — visual scaffolding only. Wiring lands with the recordings /
// thoughts / files features. The empty state shows what CAN be attached.

function AttachmentsTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <AttachmentSlot icon={<Mic className="w-4 h-4" />} label="הקלטה" />
        <AttachmentSlot icon={<Lightbulb className="w-4 h-4" />} label="מחשבה" />
        <AttachmentSlot icon={<FileText className="w-4 h-4" />} label="קובץ" />
        <AttachmentSlot icon={<LinkIcon className="w-4 h-4" />} label="קישור" />
        <AttachmentSlot icon={<MapPin className="w-4 h-4" />} label="מיקום" />
        <AttachmentSlot icon={<CalendarIcon className="w-4 h-4" />} label="אירוע" />
      </div>

      <div className="rounded-xl border border-dashed border-ink-300 bg-ink-50/60 p-6 text-center">
        <Paperclip className="w-5 h-5 mx-auto text-ink-400 mb-1.5" />
        <p className="text-sm text-ink-600">
          אין צירופים למשימה הזו עדיין.
        </p>
        <p className="text-xs text-ink-400 mt-0.5">
          לחצי על אחד מהטיפוסים למעלה כדי לצרף.
        </p>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// StatusPicker — user-customisable chip dropdown reading from useMyTaskStatuses.
// Renders the current status as a coloured chip + opens a popover of all
// statuses in the user's palette.

const STATUS_COLORS = [
  "#a8a8bc",
  "#f59e0b",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
];

function StatusPicker({
  value,
  statuses,
  onChange,
}: {
  value: string;
  statuses: UserTaskStatus[];
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");

  const updateStatus = useUpdateUserTaskStatus();
  const createStatus = useCreateUserTaskStatus();

  const current = statuses.find((s) => s.key === value);
  const label = current?.label ?? value;
  const color = current?.color ?? "#a8a8bc";

  const commitNewStatus = async () => {
    const lbl = draftLabel.trim();
    if (!lbl) {
      setAdding(false);
      return;
    }
    const existing = new Set(statuses.map((s) => s.key));
    let key = slugifyStatusKey(lbl);
    let i = 1;
    while (existing.has(key)) key = `${slugifyStatusKey(lbl)}_${i++}`;
    const created = await createStatus.mutateAsync({
      key,
      label: lbl,
      kind: "active",
      color: "#f59e0b",
      sort_order: (statuses.at(-1)?.sort_order ?? 0) + 100,
      is_builtin: false,
    });
    setDraftLabel("");
    setAdding(false);
    onChange(created.key);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2.5 text-sm transition-all",
          open
            ? "border-primary-500 ring-2 ring-primary-500/25"
            : "border-ink-300 hover:border-ink-400"
        )}
      >
        <span className="inline-flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="font-medium text-ink-900">{label}</span>
        </span>
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-ink-500">
          <path d="M5 7l5 6 5-6H5z" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute start-0 mt-1 w-full bg-white border border-ink-200 rounded-xl shadow-lift z-20 py-1 max-h-80 overflow-y-auto scrollbar-thin">
            {statuses.length === 0 && (
              <div className="px-3 py-2 text-xs text-ink-500">
                עוד לא הוגדרו סטטוסים.
              </div>
            )}
            {statuses.map((s) => (
              <StatusPickerRow
                key={s.id}
                status={s}
                selected={s.key === value}
                editing={editingId === s.id}
                onSelect={() => {
                  onChange(s.key);
                  setOpen(false);
                }}
                onStartEdit={() => setEditingId(s.id)}
                onStopEdit={() => setEditingId(null)}
                onRename={(label) =>
                  updateStatus.mutate({
                    statusId: s.id,
                    patch: { label },
                  })
                }
                onRecolor={(color) =>
                  updateStatus.mutate({
                    statusId: s.id,
                    patch: { color },
                  })
                }
              />
            ))}
            <div className="border-t border-ink-100 mt-1 pt-1">
              {adding ? (
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: "#f59e0b" }}
                  />
                  <input
                    autoFocus
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    onBlur={commitNewStatus}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitNewStatus();
                      if (e.key === "Escape") {
                        setDraftLabel("");
                        setAdding(false);
                      }
                    }}
                    placeholder="שם סטטוס חדש..."
                    className="flex-1 min-w-0 bg-transparent border-b border-primary-500 outline-none text-sm text-ink-900"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-100 text-start"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-dashed border-ink-300" />
                  <span>הוסף סטטוס חדש</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatusPickerRow({
  status,
  selected,
  editing,
  onSelect,
  onStartEdit,
  onStopEdit,
  onRename,
  onRecolor,
}: {
  status: UserTaskStatus;
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onRename: (label: string) => void;
  onRecolor: (color: string) => void;
}) {
  const [draft, setDraft] = useState(status.label);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    setDraft(status.label);
  }, [status.label]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== status.label) onRename(trimmed);
    onStopEdit();
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-ink-100",
        selected && "bg-primary-50"
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setPaletteOpen((v) => !v);
        }}
        className="w-2.5 h-2.5 rounded-full shrink-0 hover:ring-2 hover:ring-ink-300"
        style={{ backgroundColor: status.color ?? "#a8a8bc" }}
        title="שנה צבע"
      />
      {paletteOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setPaletteOpen(false)}
          />
          <div className="absolute start-4 mt-8 z-20 bg-white border border-ink-200 rounded-xl shadow-lift p-2 flex gap-1 flex-wrap w-[200px]">
            {STATUS_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRecolor(c);
                  setPaletteOpen(false);
                }}
                className="w-5 h-5 rounded-full border border-ink-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </>
      )}
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(status.label);
              onStopEdit();
            }
          }}
          className="flex-1 min-w-0 bg-transparent border-b border-primary-500 outline-none text-sm text-ink-900"
        />
      ) : (
        <>
          <button
            type="button"
            onClick={onSelect}
            className="flex-1 min-w-0 text-start text-ink-900"
          >
            {status.label}
          </button>
          <button
            type="button"
            onClick={onStartEdit}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-ink-400 hover:text-ink-900"
            title="ערוך שם"
          >
            <Pencil className="w-3 h-3" />
          </button>
        </>
      )}
    </div>
  );
}

function AttachmentSlot({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled
      className="group flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-700 cursor-not-allowed opacity-70"
      title="בקרוב"
    >
      <span className="text-ink-700">{icon}</span>
      <span className="font-medium">{label}</span>
      <Plus className="w-3.5 h-3.5 ms-auto text-ink-400" />
    </button>
  );
}
