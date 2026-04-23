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
  Link as LinkIcon,
  History,
  Trash2,
  Plus,
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
import { useTaskLists } from "@/lib/hooks/useTaskLists";
import type { TaskStatus, TimeEntry } from "@/lib/types/domain";

interface TaskEditModalProps {
  taskId: string | null;
  onClose: () => void;
}

type Tab = "overview" | "schedule" | "history" | "attachments";

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "לעשות" },
  { value: "in_progress", label: "בעבודה" },
  { value: "pending_approval", label: "ממתין לאישור" },
  { value: "done", label: "בוצע" },
  { value: "cancelled", label: "בוטל" },
];

export function TaskEditModal({ taskId, onClose }: TaskEditModalProps) {
  const open = !!taskId;
  const { data: task } = useTask(taskId);
  const { data: lists = [] } = useTaskLists();
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();

  const [tab, setTab] = useState<Tab>("overview");

  // Local draft state — committed to DB on blur / explicit save.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [urgency, setUrgency] = useState<number>(3);
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [listId, setListId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [estimatedHours, setEstimatedHours] = useState<string>("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<string>("");

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
    setEstimatedHours(task.estimated_hours?.toString() ?? "");
    setScheduledAt(task.scheduled_at ? task.scheduled_at.slice(0, 16) : "");
    setDurationMinutes(task.duration_minutes?.toString() ?? "");
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
        estimated_hours: estimatedHours ? Number(estimatedHours) : null,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        duration_minutes: durationMinutes ? Number(durationMinutes) : null,
      },
    });
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
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as TaskStatus)}
                        onBlur={handleBlurSave}
                        className="field"
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
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
                      <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        onBlur={handleBlurSave}
                        className="field"
                      />
                    </Field>
                    <Field label="משך (דקות)">
                      <input
                        type="number"
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(e.target.value)}
                        onBlur={handleBlurSave}
                        className="field"
                        min={0}
                      />
                    </Field>
                  </div>
                  <Field label="הערכת שעות">
                    <input
                      type="number"
                      step="0.25"
                      value={estimatedHours}
                      onChange={(e) => setEstimatedHours(e.target.value)}
                      onBlur={handleBlurSave}
                      className="field"
                      min={0}
                    />
                  </Field>
                  <p className="text-xs text-ink-500">
                    חזרה, תלויות ומשימת-אם — בקרוב.
                  </p>
                </div>
              )}

              {tab === "history" && task && <TimeEntriesTab task={task} />}

              {tab === "attachments" && (
                <div className="space-y-3">
                  <p className="text-sm text-ink-500">
                    קבצים, הקלטות, מחשבות וקישורים יופיעו כאן. הוספה בקרוב.
                  </p>
                </div>
              )}
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
            <div className="text-xs text-ink-500">סה"כ עד כה</div>
            <div className="font-mono text-lg tabular-nums">
              {formatDuration(task.actual_seconds)}
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
