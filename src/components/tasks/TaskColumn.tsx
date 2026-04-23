import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Archive, Pin, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCreateTask } from "@/lib/hooks/useTasks";
import { useArchiveTaskList } from "@/lib/hooks/useTaskLists";
import type { TaskList } from "@/lib/types/domain";
import { TaskRow, type TaskTreeNode } from "./TaskRow";

interface TaskColumnProps {
  /** null = the "unassigned" pinned column */
  list: TaskList | null;
  /** Root tasks for this column (already tree-built) */
  roots: TaskTreeNode[];
  /** Total task count across all depths, for header */
  totalCount: number;
  pinned?: boolean;
  onOpenEdit: (taskId: string) => void;
}

export function TaskColumn({
  list,
  roots,
  totalCount,
  pinned,
  onOpenEdit,
}: TaskColumnProps) {
  const createTask = useCreateTask();
  const archiveList = useArchiveTaskList();
  const [newTitle, setNewTitle] = useState("");
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);

  const listId = list?.id ?? null;
  const { setNodeRef, isOver } = useDroppable({
    id: `list:${listId ?? "unassigned"}`,
    data: { type: "list", listId },
  });

  const [confirmArchive, setConfirmArchive] = useState(false);

  // Split into incomplete + completed. Completed sinks to bottom of the list.
  const incompleteRoots = roots.filter((n) => !n.task.completed_at);
  const completedRoots = roots.filter((n) => !!n.task.completed_at);

  const handleCreate = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const t = await createTask.mutateAsync({
      title: trimmed,
      task_list_id: listId,
      parent_task_id: null,
      status: "todo",
      urgency: 3,
    });
    setNewTitle("");
    setFocusTaskId(t.id);
  };

  const handleEmptyCreate = async () => {
    const t = await createTask.mutateAsync({
      title: "",
      task_list_id: listId,
      parent_task_id: null,
      status: "todo",
      urgency: 3,
    });
    setFocusTaskId(t.id);
  };

  const handleArchive = () => {
    if (!list) return;
    archiveList.mutate(list.id);
    setConfirmArchive(false);
  };

  const headerColor = list?.color ?? null;
  const emoji = list?.emoji ?? (listId === null ? "📥" : "📋");
  const name = list?.name ?? "לא משויכות";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "shrink-0 w-[320px] max-h-full flex flex-col bg-white border border-ink-200 rounded-lg shadow-soft transition-colors",
        pinned && "sticky start-0 z-10 bg-ink-50/95 backdrop-blur-sm",
        isOver && "ring-2 ring-primary-400 border-primary-300"
      )}
    >
      {/* Header */}
      <div
        className="px-3 py-2 border-b border-ink-200 flex items-center gap-2"
        style={headerColor ? { borderTopColor: headerColor, borderTopWidth: 3 } : undefined}
      >
        <span className="text-base">{emoji}</span>
        <h3 className="font-semibold text-ink-900 text-sm truncate flex-1">
          {name}
        </h3>
        <span className="text-xs text-ink-500 shrink-0">{totalCount}</span>
        {pinned && (
          <span className="text-ink-400" title="רשימה מקובעת">
            <Pin className="w-3.5 h-3.5" />
          </span>
        )}
        {list && list.kind === "custom" && (
          <button
            onClick={() => setConfirmArchive(true)}
            className="p-1 rounded-md text-ink-400 hover:text-danger-500 hover:bg-ink-100"
            title="ארכב רשימה"
            type="button"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-1 min-h-[120px]">
        {roots.length === 0 ? (
          <button
            onClick={handleEmptyCreate}
            className="w-full text-center text-xs text-ink-400 hover:text-primary-600 hover:bg-primary-50 rounded-md py-6 transition-colors"
            type="button"
          >
            + הוסף משימה ראשונה
          </button>
        ) : (
          <>
            {incompleteRoots.map((node, idx) => (
              <TaskRow
                key={node.task.id}
                node={node}
                prevSiblingId={idx > 0 ? incompleteRoots[idx - 1]!.task.id : null}
                parentTaskId={null}
                grandparentTaskId={null}
                listId={listId}
                onRequestFocus={setFocusTaskId}
                focusTaskId={focusTaskId}
                onOpenEdit={onOpenEdit}
              />
            ))}

            {completedRoots.length > 0 && (
              <div className="mt-2 pt-2 border-t border-ink-150">
                <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1">
                  הושלמו ({completedRoots.length})
                </div>
                {completedRoots.map((node) => (
                  <TaskRow
                    key={node.task.id}
                    node={node}
                    prevSiblingId={null}
                    parentTaskId={null}
                    grandparentTaskId={null}
                    listId={listId}
                    onRequestFocus={setFocusTaskId}
                    focusTaskId={focusTaskId}
                    onOpenEdit={onOpenEdit}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* New task footer */}
      <div className="p-2 border-t border-ink-200">
        <div className="flex items-center gap-1">
          <Plus className="w-3.5 h-3.5 text-ink-400 shrink-0" />
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
              if (e.key === "Escape") setNewTitle("");
            }}
            onBlur={handleCreate}
            placeholder="משימה חדשה..."
            className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm py-1"
          />
        </div>
      </div>

      {confirmArchive && list && (
        <div
          className="fixed inset-0 z-50 bg-ink-900/40 flex items-center justify-center p-4"
          onClick={() => setConfirmArchive(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-lift w-full max-w-sm p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-ink-900">ארכוב רשימה</h3>
            <p className="text-sm text-ink-600">
              הרשימה "{list.name}" וכל המשימות שבה יעברו לארכיון ויוסתרו מברירת המחדל.
              ניתן לשחזר תוך 60 יום.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmArchive(false)}
                className="btn-ghost text-xs"
                type="button"
              >
                בטל
              </button>
              <button
                onClick={handleArchive}
                className="btn-accent text-xs"
                type="button"
              >
                ארכב
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
