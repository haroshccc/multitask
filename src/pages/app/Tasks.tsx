import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow, isPast } from "date-fns";
import { he } from "date-fns/locale";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar as CalendarIcon,
  Check,
  Circle,
  Clock,
  Flame,
  GripVertical,
  Inbox,
  Layers,
  List as ListIcon,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { TaskDetailDrawer } from "@/components/tasks/TaskDetailDrawer";
import { TaskTimerButton } from "@/components/tasks/TaskTimerButton";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  useCreateTask,
  useDeleteTask,
  useReorderTask,
  useTasks,
  useTasksByList,
  useUpdateTaskStatus,
} from "@/lib/queries/tasks";
import {
  useCreateTaskList,
  useDeleteTaskList,
  useTaskLists,
} from "@/lib/queries/taskLists";
import type { Task, TaskList, TaskStatus } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

type Selection =
  | { kind: "scope"; scope: "today" | "open" }
  | { kind: "inbox" }
  | { kind: "list"; listId: string };

const SCOPE_TABS = [
  { key: "today", label: "היום", icon: CalendarIcon },
  { key: "open", label: "כל הפתוחות", icon: Layers },
] as const;

export function Tasks() {
  const { user, activeOrganizationId } = useAuth();
  const [selection, setSelection] = useState<Selection>({ kind: "scope", scope: "open" });
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [draft, setDraft] = useState("");

  const lists = useTaskLists(activeOrganizationId);
  const createList = useCreateTaskList();
  const deleteList = useDeleteTaskList();
  const createTask = useCreateTask();

  // Bound queries: pick whichever fits the selection
  const scopeTasks = useTasks(activeOrganizationId, {
    scope: selection.kind === "scope" ? selection.scope : "open",
  });
  const listTasks = useTasksByList(
    activeOrganizationId,
    selection.kind === "list" ? selection.listId : selection.kind === "inbox" ? null : null
  );

  const data =
    selection.kind === "scope" ? scopeTasks.data : listTasks.data;
  const isLoading =
    selection.kind === "scope" ? scopeTasks.isLoading : listTasks.isLoading;

  const canWrite = Boolean(user && activeOrganizationId);
  const isReorderable = selection.kind === "list" || selection.kind === "inbox";

  const handleCreate = async () => {
    const title = draft.trim();
    if (!title || !user || !activeOrganizationId) return;
    const taskListId = selection.kind === "list" ? selection.listId : null;
    await createTask.mutateAsync({
      orgId: activeOrganizationId,
      ownerId: user.id,
      title,
      taskListId,
    });
    setDraft("");
  };

  const subtitle = useMemo(() => {
    if (selection.kind === "scope") {
      return selection.scope === "today"
        ? "משימות עם מועד להיום"
        : "כל המשימות הפתוחות";
    }
    if (selection.kind === "inbox") return "משימות בלי רשימה";
    const list = lists.data?.find((l) => l.id === selection.listId);
    return list?.name ?? "רשימה";
  }, [selection, lists.data]);

  return (
    <ScreenScaffold title="משימות" subtitle={subtitle}>
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
        <ListsSidebar
          lists={lists.data ?? []}
          loading={lists.isLoading}
          selection={selection}
          onSelect={setSelection}
          onCreate={async (name) => {
            if (!user || !activeOrganizationId) return;
            const created = await createList.mutateAsync({
              orgId: activeOrganizationId,
              ownerId: user.id,
              name,
            });
            setSelection({ kind: "list", listId: created.id });
          }}
          onDelete={async (id) => {
            if (
              !confirm(
                "למחוק את הרשימה? המשימות שלה ייהפכו ל-unassigned (תיבת נכנסים)."
              )
            )
              return;
            await deleteList.mutateAsync(id);
            if (selection.kind === "list" && selection.listId === id) {
              setSelection({ kind: "scope", scope: "open" });
            }
          }}
        />

        <div>
          {canWrite && (
            <div className="card p-3 mb-3 flex items-center gap-2">
              <input
                className="field flex-1"
                placeholder={
                  selection.kind === "list"
                    ? "משימה חדשה ברשימה הזו"
                    : "משימה חדשה"
                }
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

          {isLoading ? (
            <div className="card p-8 flex items-center justify-center text-ink-500">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : !data || data.length === 0 ? (
            <EmptyState selection={selection} />
          ) : (
            <TaskListView
              tasks={data}
              reorderable={isReorderable}
              listId={selection.kind === "list" ? selection.listId : null}
              onOpen={setOpenTask}
            />
          )}
        </div>
      </div>

      {openTask && (
        <TaskDetailDrawer task={openTask} onClose={() => setOpenTask(null)} />
      )}
    </ScreenScaffold>
  );
}

interface ListsSidebarProps {
  lists: TaskList[];
  loading: boolean;
  selection: Selection;
  onSelect: (s: Selection) => void;
  onCreate: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function ListsSidebar({
  lists,
  loading,
  selection,
  onSelect,
  onCreate,
  onDelete,
}: ListsSidebarProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const customLists = lists.filter((l) => l.kind === "custom");
  const projectLists = lists.filter((l) => l.kind === "project");

  return (
    <aside className="card p-3 lg:sticky lg:top-20 h-fit">
      <div className="space-y-1 mb-3">
        {SCOPE_TABS.map((tab) => {
          const isActive =
            selection.kind === "scope" && selection.scope === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onSelect({ kind: "scope", scope: tab.key })}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-sm transition-colors",
                isActive
                  ? "bg-ink-900 text-white"
                  : "text-ink-700 hover:bg-ink-100"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
        <button
          onClick={() => onSelect({ kind: "inbox" })}
          className={cn(
            "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-sm transition-colors",
            selection.kind === "inbox"
              ? "bg-ink-900 text-white"
              : "text-ink-700 hover:bg-ink-100"
          )}
        >
          <Inbox className="w-4 h-4" />
          תיבת נכנסים
        </button>
      </div>

      <div className="border-t border-ink-200 pt-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-semibold text-ink-500 uppercase tracking-wide">
            הרשימות שלי
          </span>
          <button
            onClick={() => setCreating((v) => !v)}
            className="p-1 rounded-lg hover:bg-ink-100 text-ink-500 hover:text-ink-900"
            aria-label="רשימה חדשה"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {creating && (
          <div className="mb-2">
            <input
              className="field text-sm"
              placeholder="שם הרשימה — Enter"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={async (e) => {
                if (e.key === "Enter" && name.trim()) {
                  e.preventDefault();
                  const v = name.trim();
                  setName("");
                  setCreating(false);
                  await onCreate(v);
                }
                if (e.key === "Escape") {
                  setCreating(false);
                  setName("");
                }
              }}
            />
          </div>
        )}

        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-ink-400 mx-auto" />
        ) : customLists.length === 0 ? (
          <p className="text-xs text-ink-500 px-1">
            אין עדיין רשימות. לחצי + כדי ליצור.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {customLists.map((list) => {
              const isActive =
                selection.kind === "list" && selection.listId === list.id;
              return (
                <li key={list.id} className="group">
                  <button
                    onClick={() => onSelect({ kind: "list", listId: list.id })}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-sm text-start",
                      isActive
                        ? "bg-ink-900 text-white"
                        : "text-ink-700 hover:bg-ink-100"
                    )}
                  >
                    <span className="text-base shrink-0">{list.emoji ?? "📋"}</span>
                    <span className="flex-1 min-w-0 truncate">{list.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(list.id);
                      }}
                      className={cn(
                        "p-1 rounded-lg opacity-0 group-hover:opacity-100",
                        isActive ? "hover:bg-white/20 text-white" : "hover:bg-ink-200 text-ink-500"
                      )}
                      aria-label="מחיקת רשימה"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {projectLists.length > 0 && (
          <>
            <div className="text-xs font-semibold text-ink-500 uppercase tracking-wide mt-4 mb-2 px-1">
              פרויקטים
            </div>
            <ul className="space-y-0.5">
              {projectLists.map((list) => {
                const isActive =
                  selection.kind === "list" && selection.listId === list.id;
                return (
                  <li key={list.id}>
                    <button
                      onClick={() => onSelect({ kind: "list", listId: list.id })}
                      className={cn(
                        "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-sm text-start",
                        isActive
                          ? "bg-ink-900 text-white"
                          : "text-ink-700 hover:bg-ink-100"
                      )}
                    >
                      <ListIcon className="w-3.5 h-3.5 shrink-0 text-ink-400" />
                      <span className="flex-1 min-w-0 truncate">{list.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}

interface TaskListViewProps {
  tasks: Task[];
  reorderable: boolean;
  listId: string | null;
  onOpen: (task: Task) => void;
}

function TaskListView({ tasks, reorderable, listId, onOpen }: TaskListViewProps) {
  const updateStatus = useUpdateTaskStatus();
  const deleteTask = useDeleteTask();
  const reorderTask = useReorderTask();

  // Local order so drag feels instantaneous; resync when server pushes.
  const [order, setOrder] = useState<string[]>(() => tasks.map((t) => t.id));
  useEffect(() => {
    setOrder(tasks.map((t) => t.id));
  }, [tasks]);

  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const ordered = order.map((id) => byId.get(id)).filter(Boolean) as Task[];

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    if (!reorderable) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);

    // Compute a new sort_order between neighbors. Tasks use double precision
    // so we can keep splitting indefinitely without renumbering.
    const prevTask = newIndex > 0 ? byId.get(next[newIndex - 1]!) : null;
    const nextTask =
      newIndex < next.length - 1 ? byId.get(next[newIndex + 1]!) : null;
    let newSort: number;
    if (prevTask && nextTask) {
      newSort = (prevTask.sort_order + nextTask.sort_order) / 2;
    } else if (prevTask) {
      newSort = prevTask.sort_order + 1;
    } else if (nextTask) {
      newSort = nextTask.sort_order - 1;
    } else {
      newSort = 0;
    }
    reorderTask.mutate({ id: String(active.id), sortOrder: newSort });
    void listId;
  };

  if (!reorderable) {
    return (
      <ul className="space-y-1.5">
        {ordered.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            draggable={false}
            onToggle={() =>
              updateStatus.mutate({
                id: task.id,
                status: task.status === "done" ? "todo" : "done",
              })
            }
            onDelete={() => {
              if (confirm("למחוק את המשימה?")) deleteTask.mutate(task.id);
            }}
            onOpen={() => onOpen(task)}
          />
        ))}
      </ul>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ul className="space-y-1.5">
          {ordered.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              draggable
              onToggle={() =>
                updateStatus.mutate({
                  id: task.id,
                  status: task.status === "done" ? "todo" : "done",
                })
              }
              onDelete={() => {
                if (confirm("למחוק את המשימה?")) deleteTask.mutate(task.id);
              }}
              onOpen={() => onOpen(task)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

interface TaskRowProps {
  task: Task;
  draggable: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onOpen: () => void;
}

function TaskRow({ task, draggable, onToggle, onDelete, onOpen }: TaskRowProps) {
  const sortable = useSortable({ id: task.id, disabled: !draggable });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
  };

  const done = task.status === "done";
  const scheduled = task.scheduled_at ? new Date(task.scheduled_at) : null;
  const overdue = scheduled && isPast(scheduled) && !done;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "card-lift p-3 flex items-center gap-2 group",
        done && "opacity-60",
        isDragging && "ring-2 ring-primary-500"
      )}
    >
      {draggable && (
        <button
          {...attributes}
          {...listeners}
          className="p-1 -ms-1 text-ink-300 hover:text-ink-700 cursor-grab active:cursor-grabbing touch-none"
          aria-label="גרור"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}

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

      <div
        onClick={onOpen}
        className="flex-1 min-w-0 cursor-pointer"
      >
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

function EmptyState({ selection }: { selection: Selection }) {
  let title = "אין משימות";
  let body = "הוסיפי משימה חדשה למעלה.";
  if (selection.kind === "scope" && selection.scope === "today") {
    title = "אין משימות להיום";
  } else if (selection.kind === "inbox") {
    title = "תיבת הנכנסים ריקה";
    body = "משימות ללא רשימה יופיעו כאן.";
  } else if (selection.kind === "list") {
    title = "הרשימה ריקה";
    body = "הוסיפי משימה ראשונה לרשימה למעלה.";
  }
  return (
    <div className="card p-8 md:p-12 text-center">
      <div className="text-4xl mb-3">✅</div>
      <h2 className="text-lg font-semibold text-ink-900 mb-1">{title}</h2>
      <p className="text-sm text-ink-600">{body}</p>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}ש ${m}ד`;
  return `${m}ד`;
}
