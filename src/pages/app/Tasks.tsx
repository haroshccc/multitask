import { useState } from "react";
import { formatDistanceToNow, isPast } from "date-fns";
import { he } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  Check,
  Circle,
  Clock,
  Flame,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { TaskDetailDrawer } from "@/components/tasks/TaskDetailDrawer";
import { TaskTimerButton } from "@/components/tasks/TaskTimerButton";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  useCreateTask,
  useDeleteTask,
  useTasks,
  useUpdateTaskStatus,
} from "@/lib/queries/tasks";
import type { Task, TaskStatus } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

type ScopeKey = "today" | "inbox" | "open";

const SCOPES: { key: ScopeKey; label: string; description: string }[] = [
  { key: "today", label: "היום", description: "משימות עם מועד להיום" },
  { key: "inbox", label: "תיבת נכנסים", description: "משימות בלי רשימה" },
  { key: "open", label: "כל הפתוחות", description: "כל המשימות שלא הושלמו" },
];

export function Tasks() {
  const { user, activeOrganizationId } = useAuth();
  const [scope, setScope] = useState<ScopeKey>("open");
  const { data, isLoading } = useTasks(activeOrganizationId, { scope });
  const createTask = useCreateTask();
  const updateStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteTask();

  const [draft, setDraft] = useState("");
  const [openTask, setOpenTask] = useState<Task | null>(null);

  const canWrite = Boolean(user && activeOrganizationId);

  const handleCreate = async () => {
    const title = draft.trim();
    if (!title || !user || !activeOrganizationId) return;
    await createTask.mutateAsync({
      orgId: activeOrganizationId,
      ownerId: user.id,
      title,
    });
    setDraft("");
  };

  return (
    <ScreenScaffold
      title="משימות"
      subtitle="הוסיפי משימה, סמני כבוצעה, עקבי אחרי הדחופות"
    >
      {canWrite && (
        <div className="card p-3 mb-4 flex items-center gap-2">
          <input
            className="field flex-1"
            placeholder="משימה חדשה — Enter לשמירה"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
            disabled={createTask.isPending}
          />
          <button
            onClick={handleCreate}
            disabled={!draft.trim() || createTask.isPending}
            className="btn-accent shrink-0"
          >
            {createTask.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>הוסיפי</span>
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 p-1 bg-ink-100 rounded-2xl mb-4 w-fit">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            onClick={() => setScope(s.key)}
            title={s.description}
            className={cn(
              "px-3 py-1.5 rounded-xl text-sm font-medium transition-all",
              scope === s.key ? "bg-white shadow-soft text-ink-900" : "text-ink-600 hover:text-ink-900"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="card p-8 flex items-center justify-center text-ink-500">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState scope={scope} />
      ) : (
        <ul className="space-y-1.5">
          {data.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={() =>
                updateStatus.mutate({
                  id: task.id,
                  status: task.status === "done" ? "todo" : "done",
                })
              }
              onDelete={() => {
                if (confirm("למחוק את המשימה הזו?")) {
                  deleteTask.mutate(task.id);
                }
              }}
              onOpen={() => setOpenTask(task)}
            />
          ))}
        </ul>
      )}

      {openTask && (
        <TaskDetailDrawer task={openTask} onClose={() => setOpenTask(null)} />
      )}
    </ScreenScaffold>
  );
}

interface TaskRowProps {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onOpen: () => void;
}

function TaskRow({ task, onToggle, onDelete, onOpen }: TaskRowProps) {
  const done = task.status === "done";
  const scheduled = task.scheduled_at ? new Date(task.scheduled_at) : null;
  const overdue = scheduled && isPast(scheduled) && !done;

  return (
    <li
      className={cn(
        "card-lift p-3 flex items-center gap-3 group cursor-pointer",
        done && "opacity-60"
      )}
      onClick={onOpen}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={cn(
          "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
          done
            ? "bg-success-500 border-success-500 text-white"
            : "border-ink-300 hover:border-primary-500"
        )}
        aria-label={done ? "בטל השלמה" : "סמן כבוצעה"}
      >
        {done ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-0 h-0" />}
      </button>

      <div className="flex-1 min-w-0">
        <div
          className={cn(
            "text-sm text-ink-900 break-words",
            done && "line-through text-ink-500"
          )}
        >
          {task.title}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {task.source_thought_id && (
            <span className="chip-accent">
              <Sparkles className="w-3 h-3" />
              ממחשבה
            </span>
          )}
          <StatusChip status={task.status} />
          {task.urgency >= 4 && (
            <span
              className={cn(
                "chip",
                task.urgency >= 5 && "bg-danger-500/10 text-danger-600"
              )}
            >
              <Flame className="w-3 h-3" />
              דחיפות {task.urgency}
            </span>
          )}
          {scheduled && (
            <span
              className={cn(
                "chip",
                overdue && "bg-danger-500/10 text-danger-600"
              )}
            >
              <CalendarIcon className="w-3 h-3" />
              {formatDistanceToNow(scheduled, { addSuffix: true, locale: he })}
            </span>
          )}
          {task.actual_seconds > 0 && (
            <span className="chip">
              <Clock className="w-3 h-3" />
              {formatDuration(task.actual_seconds)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        {!done && <TaskTimerButton task={task} variant="compact" />}
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-ink-400 hover:text-danger-600 hover:bg-danger-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="מחק"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
}

function StatusChip({ status }: { status: TaskStatus }) {
  if (status === "todo") return null;
  const map: Record<TaskStatus, { label: string; className: string } | null> = {
    todo: null,
    in_progress: { label: "בעבודה", className: "bg-primary-500/10 text-primary-700" },
    pending_approval: { label: "ממתינה לאישור", className: "bg-accent-purple/10 text-accent-purple" },
    done: { label: "הושלמה", className: "bg-success-500/10 text-success-600" },
    cancelled: { label: "בוטלה", className: "bg-ink-200 text-ink-500" },
  };
  const entry = map[status];
  if (!entry) return null;
  return <span className={cn("chip", entry.className)}>{entry.label}</span>;
}

function EmptyState({ scope }: { scope: ScopeKey }) {
  const copy = {
    today: { title: "אין משימות להיום", body: "אפשר להוסיף משימה חדשה למעלה." },
    inbox: { title: "תיבת הנכנסים ריקה", body: "משימות ללא רשימה יופיעו כאן." },
    open: {
      title: "אין משימות פתוחות",
      body: "הוסיפי משימה חדשה או המרי מחשבה ממסך המחשבות.",
    },
  }[scope];
  return (
    <div className="card p-8 md:p-12 text-center">
      <div className="text-4xl mb-3">✅</div>
      <h2 className="text-lg font-semibold text-ink-900 mb-1">{copy.title}</h2>
      <p className="text-sm text-ink-600">{copy.body}</p>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}ש ${m}ד`;
  return `${m}ד`;
}
