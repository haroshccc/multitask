import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Star,
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
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useTask, useUpdateTask, useCompleteTask } from "@/lib/hooks/useTasks";
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
import type { TimeEntry, UserTaskStatus } from "@/lib/types/domain";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import {
  DurationInput,
  hoursToMinutes,
  minutesToHours,
} from "@/components/ui/DurationInput";

interface TaskEditModalProps {
  taskId: string | null;
  onClose: () => void;
}

type Tab = "overview" | "schedule" | "history" | "attachments";

export function TaskEditModal({ taskId, onClose }: TaskEditModalProps) {
  const open = !!taskId;
  const { data: task } = useTask(taskId);
  const { data: lists = [] } = useTaskLists();
  const { data: myStatuses = [] } = useMyTaskStatuses();
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();

  const [tab, setTab] = useState<Tab>("overview");

  // Local draft state — committed to DB on blur / explicit save.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [urgency, setUrgency] = useState<number>(3);
  const [status, setStatus] = useState<string>("todo");
  const [listId, setListId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState<string | null>(null); // ISO
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (!task) return;
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
    setDurationMinutes(task.duration_minutes ?? null);
    setEstimatedMinutes(hoursToMinutes(task.estimated_hours ?? null));
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBlurSave = () => {
    if (!task) return;
    updateTask.mutate({
      taskId: task.id,
      patch: {
        title: title.trim() || task.title,
        description: description || null,
        notes: notes || null,
        urgency,
        status,
        task_list_id: listId,
        tags,
        location: location || null,
        external_url: externalUrl || null,
      },
    });
  };

  const saveSchedulePatch = (
    patch: Partial<{
      scheduled_at: string | null;
      duration_minutes: number | null;
      estimated_hours: number | null;
    }>
  ) => {
    if (!task) return;
    updateTask.mutate({ taskId: task.id, patch });
  };

  if (!task && !open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
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
                  onBlur={handleBlurSave}
                  placeholder="שם המשימה"
                  className="text-lg font-semibold text-ink-900 bg-transparent border-0 outline-none flex-1 min-w-0"
                />
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-ink-100"
              >
                <X className="w-4 h-4 text-ink-600" />
              </button>
            </div>

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
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="סטטוס">
                      <StatusPicker
                        value={status}
                        statuses={myStatuses}
                        onChange={(next) => {
                          setStatus(next);
                          if (task) {
                            updateTask.mutate({
                              taskId: task.id,
                              patch: { status: next },
                            });
                          }
                        }}
                      />
                    </Field>
                    <Field label="רשימה">
                      <select
                        value={listId ?? ""}
                        onChange={(e) => setListId(e.target.value || null)}
                        onBlur={handleBlurSave}
                        className="field"
                      >
                        <option value="">לא משויכת</option>
                        {lists.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.emoji ? `${l.emoji} ` : ""}
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field label="דחיפות">
                    <UrgencyStars
                      value={urgency}
                      onChange={(v) => {
                        setUrgency(v);
                        updateTask.mutate({
                          taskId: task!.id,
                          patch: { urgency: v },
                        });
                      }}
                    />
                  </Field>

                  <Field label="תיאור">
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onBlur={handleBlurSave}
                      className="field min-h-[80px] resize-y"
                      placeholder="פרטים על המשימה..."
                    />
                  </Field>

                  <Field label="תגים">
                    <TagInput tags={tags} onChange={setTags} onBlur={handleBlurSave} />
                  </Field>

                  <Field label="הערות">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      onBlur={handleBlurSave}
                      className="field min-h-[60px] resize-y"
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="מיקום">
                      <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        onBlur={handleBlurSave}
                        className="field"
                      />
                    </Field>
                    <Field label="קישור חיצוני">
                      <input
                        type="url"
                        value={externalUrl}
                        onChange={(e) => setExternalUrl(e.target.value)}
                        onBlur={handleBlurSave}
                        className="field"
                        dir="ltr"
                      />
                    </Field>
                  </div>
                </div>
              )}

              {tab === "schedule" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="תאריך ושעה">
                      <DateTimePicker
                        value={scheduledAt}
                        onChange={(iso) => {
                          setScheduledAt(iso);
                          saveSchedulePatch({ scheduled_at: iso });
                        }}
                      />
                    </Field>
                    <Field label="משך">
                      <DurationInput
                        value={durationMinutes}
                        onChange={(m) => {
                          setDurationMinutes(m);
                          saveSchedulePatch({ duration_minutes: m });
                        }}
                        placeholder="00:00"
                        ariaLabel="משך משימה"
                      />
                    </Field>
                  </div>
                  <Field label="הערכת שעות">
                    <DurationInput
                      value={estimatedMinutes}
                      onChange={(m) => {
                        setEstimatedMinutes(m);
                        saveSchedulePatch({ estimated_hours: minutesToHours(m) });
                      }}
                      placeholder="00:00"
                      ariaLabel="הערכת שעות"
                    />
                  </Field>
                  <p className="text-xs text-ink-500">
                    חזרה, תלויות ומשימת-אם — בקרוב.
                  </p>
                </div>
              )}

              {tab === "history" && task && <TimeEntriesTab task={task} />}

              {tab === "attachments" && <AttachmentsTab />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="eyebrow mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function UrgencyStars({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n === value ? 0 : n)}
          className="p-0.5 text-ink-300 hover:text-primary-500"
          aria-label={`${n} כוכבים`}
        >
          <Star
            className={cn(
              "w-5 h-5",
              n <= value ? "text-primary-500 fill-primary-500" : ""
            )}
          />
        </button>
      ))}
    </div>
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

function TimeEntriesTab({ task }: { task: { id: string; actual_seconds: number } }) {
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

  return (
    <div className="space-y-4">
      <div className="card-lift p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-ink-500" />
          <div>
            <div className="text-xs text-ink-500 flex items-center gap-2">
              סה"כ עד כה
              <UnitSwitch value={timeUnit} onChange={setTimeUnit} />
            </div>
            <div className="font-mono text-lg tabular-nums">
              {formatSeconds(task.actual_seconds, timeUnit)}
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
            <div className="grid grid-cols-2 gap-2">
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
        <div className="grid grid-cols-2 gap-2">
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
