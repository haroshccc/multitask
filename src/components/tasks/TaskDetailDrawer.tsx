import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon,
  Check,
  Circle,
  Clock,
  Flame,
  ListTree,
  Loader2,
  MapPin,
  Plus,
  Save,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import type { Task, TaskUpdate } from "@/lib/types/domain";
import {
  useCreateTask,
  useDeleteTask,
  useSubtasks,
  useUpdateTask,
  useUpdateTaskStatus,
} from "@/lib/queries/tasks";
import { useAuth } from "@/lib/auth/AuthContext";
import { TaskTimerButton } from "./TaskTimerButton";
import { cn } from "@/lib/utils/cn";

interface Props {
  task: Task | null;
  onClose: () => void;
}

// Converts an ISO timestamp to the yyyy-MM-ddTHH:mm format expected by
// <input type="datetime-local">, in the browser's local timezone.
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}

export function TaskDetailDrawer({ task, onClose }: Props) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState(3);
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<string>("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setUrgency(task.urgency);
    setScheduledLocal(toLocalInputValue(task.scheduled_at));
    setDurationMinutes(
      task.duration_minutes != null ? String(task.duration_minutes) : ""
    );
    setLocation(task.location ?? "");
    setNotes(task.notes ?? "");
    setDirty(false);
    setError(null);
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      setError("כותרת לא יכולה להיות ריקה");
      return;
    }
    setError(null);
    const patch: TaskUpdate = {
      title: title.trim(),
      description: description.trim() || null,
      urgency,
      scheduled_at: fromLocalInputValue(scheduledLocal),
      duration_minutes:
        durationMinutes.trim() === "" ? null : Number(durationMinutes),
      location: location.trim() || null,
      notes: notes.trim() || null,
    };
    try {
      await updateTask.mutateAsync({ id: task.id, patch });
      setDirty(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async () => {
    if (!confirm("למחוק את המשימה לצמיתות?")) return;
    await deleteTask.mutateAsync(task.id);
    onClose();
  };

  const markDirty = () => setDirty(true);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-sm flex items-stretch justify-start"
      >
        <motion.aside
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ type: "spring", stiffness: 400, damping: 36 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white w-full max-w-md h-full flex flex-col shadow-lift"
        >
          <header className="flex items-center justify-between px-5 py-3 border-b border-ink-200 shrink-0">
            <h3 className="font-semibold text-ink-900 text-sm">עריכת משימה</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-ink-100"
              aria-label="סגירה"
            >
              <X className="w-4 h-4 text-ink-600" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
            <Field label="כותרת">
              <input
                className="field"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  markDirty();
                }}
                autoFocus
              />
            </Field>

            <Field label="תיאור">
              <textarea
                className="field min-h-[80px] resize-y"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  markDirty();
                }}
                placeholder="פרטים נוספים (אופציונלי)"
              />
            </Field>

            <Field label="דחיפות">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => {
                      setUrgency(level);
                      markDirty();
                    }}
                    className={cn(
                      "flex-1 h-10 rounded-xl border flex items-center justify-center gap-1 text-sm font-medium transition-colors",
                      urgency === level
                        ? level >= 4
                          ? "bg-danger-500 border-danger-500 text-white"
                          : "bg-ink-900 border-ink-900 text-white"
                        : "bg-white border-ink-300 text-ink-600 hover:border-ink-400"
                    )}
                  >
                    {level >= 4 && urgency === level && <Flame className="w-3.5 h-3.5" />}
                    {level}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="מועד" icon={CalendarIcon}>
                <input
                  type="datetime-local"
                  className="field"
                  value={scheduledLocal}
                  onChange={(e) => {
                    setScheduledLocal(e.target.value);
                    markDirty();
                  }}
                />
              </Field>
              <Field label="משך (דקות)" icon={Clock}>
                <input
                  type="number"
                  min="0"
                  step="5"
                  className="field"
                  value={durationMinutes}
                  onChange={(e) => {
                    setDurationMinutes(e.target.value);
                    markDirty();
                  }}
                  placeholder="—"
                />
              </Field>
            </div>

            <Field label="מיקום" icon={MapPin}>
              <input
                className="field"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  markDirty();
                }}
                placeholder="כתובת / קישור למפה"
              />
            </Field>

            <Field label="הערות" icon={StickyNote}>
              <textarea
                className="field min-h-[60px] resize-y"
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  markDirty();
                }}
              />
            </Field>

            <div className="pt-2 border-t border-ink-200">
              <div className="text-xs text-ink-500 mb-2">זמן בוצע</div>
              <TaskTimerButton task={task} />
              {task.actual_seconds > 0 && (
                <div className="text-xs text-ink-600 mt-2">
                  סך הכל: {formatSeconds(task.actual_seconds)}
                </div>
              )}
            </div>

            <SubtasksSection parentId={task.id} orgId={task.organization_id} />

            {error && (
              <div className="text-xs text-danger-600 bg-danger-500/10 border border-danger-500/20 rounded-xl px-3 py-2">
                {error}
              </div>
            )}
          </div>

          <footer className="flex items-center justify-between gap-2 px-5 py-3 border-t border-ink-200 shrink-0">
            <button
              onClick={handleDelete}
              className="btn-ghost text-danger-600 hover:bg-danger-500/10"
              disabled={deleteTask.isPending}
            >
              <Trash2 className="w-4 h-4" />
              מחק
            </button>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-ghost">
                ביטול
              </button>
              <button
                onClick={handleSave}
                disabled={!dirty || updateTask.isPending}
                className="btn-accent"
              >
                {updateTask.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                שמרי
              </button>
            </div>
          </footer>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: typeof CalendarIcon;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-sm font-medium text-ink-800 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-ink-500" />}
        {label}
      </span>
      {children}
    </label>
  );
}

function SubtasksSection({ parentId, orgId }: { parentId: string; orgId: string }) {
  const { user } = useAuth();
  const subtasks = useSubtasks(parentId);
  const createTask = useCreateTask();
  const updateStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteTask();
  const [draft, setDraft] = useState("");

  const handleAdd = async () => {
    const title = draft.trim();
    if (!title || !user) return;
    await createTask.mutateAsync({
      orgId,
      ownerId: user.id,
      title,
      parentTaskId: parentId,
    });
    setDraft("");
  };

  const items = subtasks.data ?? [];
  const doneCount = items.filter((t) => t.status === "done").length;

  return (
    <div className="pt-3 border-t border-ink-200">
      <div className="flex items-center gap-2 mb-2">
        <ListTree className="w-3.5 h-3.5 text-ink-500" />
        <div className="text-xs text-ink-500">תת-משימות</div>
        {items.length > 0 && (
          <span className="chip">
            {doneCount}/{items.length}
          </span>
        )}
      </div>

      {items.length > 0 && (
        <ul className="space-y-1 mb-2">
          {items.map((sub) => {
            const done = sub.status === "done";
            return (
              <li
                key={sub.id}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-lg group hover:bg-ink-50",
                  done && "opacity-60"
                )}
              >
                <button
                  onClick={() =>
                    updateStatus.mutate({
                      id: sub.id,
                      status: done ? "todo" : "done",
                    })
                  }
                  className={cn(
                    "w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
                    done
                      ? "bg-success-500 border-success-500 text-white"
                      : "border-ink-300 hover:border-primary-500"
                  )}
                  aria-label={done ? "בטל" : "סמן"}
                >
                  {done ? <Check className="w-2.5 h-2.5" /> : <Circle className="w-0 h-0" />}
                </button>
                <span
                  className={cn(
                    "flex-1 min-w-0 text-sm break-words",
                    done && "line-through text-ink-500"
                  )}
                >
                  {sub.title}
                </span>
                <button
                  onClick={() => {
                    if (confirm("למחוק תת-משימה?")) deleteTask.mutate(sub.id);
                  }}
                  className="p-1 rounded text-ink-400 hover:text-danger-600 hover:bg-danger-500/10 opacity-0 group-hover:opacity-100"
                  aria-label="מחק"
                >
                  <X className="w-3 h-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center gap-1">
        <input
          className="field text-sm flex-1"
          placeholder="תת-משימה חדשה — Enter"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          disabled={createTask.isPending}
        />
        <button
          onClick={handleAdd}
          disabled={!draft.trim() || createTask.isPending}
          className="btn-accent shrink-0 py-2 px-2.5"
          aria-label="הוסיפי"
        >
          {createTask.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}ש ${m}ד ${sec}ש`;
  if (m > 0) return `${m}ד ${sec}ש`;
  return `${sec}ש`;
}
