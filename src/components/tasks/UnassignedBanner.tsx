import { useDroppable } from "@dnd-kit/core";
import { Inbox, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useCreateTask } from "@/lib/hooks/useTasks";
import type { RowDisplayPrefs } from "@/lib/hooks/useRowDisplayPrefs";
import { TaskRow, type TaskTreeNode } from "./TaskRow";

interface UnassignedBannerProps {
  open: boolean;
  onToggle: () => void;
  roots: TaskTreeNode[];
  totalCount: number;
  display: RowDisplayPrefs;
  onOpenEdit: (taskId: string) => void;
}

/**
 * The "לא משויכות" banner lives on the leading (right in RTL) edge. When
 * collapsed it becomes a narrow vertical strip (just an icon + count) so the
 * main column area can use the reclaimed width. Drag-drop target stays live
 * in both states so a task can be dropped to detach it.
 */
export function UnassignedBanner({
  open,
  onToggle,
  roots,
  totalCount,
  display,
  onOpenEdit,
}: UnassignedBannerProps) {
  const createTask = useCreateTask();
  const [newTitle, setNewTitle] = useState("");
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);

  const { setNodeRef, isOver } = useDroppable({
    id: "list:unassigned",
    data: { type: "list", listId: null },
  });

  const incompleteRoots = roots.filter((n) => !n.task.completed_at);
  const completedRoots = roots.filter((n) => !!n.task.completed_at);

  const handleCreate = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const t = await createTask.mutateAsync({
      title: trimmed,
      task_list_id: null,
      parent_task_id: null,
      status: "todo",
      urgency: 3,
    });
    setNewTitle("");
    setFocusTaskId(t.id);
  };

  // Collapsed: narrow vertical strip — icon + count + expand button.
  if (!open) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "flex-shrink-0 bg-white border border-ink-200 rounded-xl shadow-soft flex flex-col items-center py-3 px-1 w-10 transition-colors",
          isOver && "ring-2 ring-primary-400 border-primary-300"
        )}
      >
        <button
          onClick={onToggle}
          type="button"
          className="p-1 rounded-md hover:bg-ink-100 text-ink-600"
          title="פתח לא משויכות"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <Inbox className="w-5 h-5 text-ink-500" />
          <div
            className="text-xs font-semibold text-ink-700 tabular-nums px-1 py-0.5 rounded bg-ink-100"
            style={{ writingMode: "vertical-rl" }}
          >
            {totalCount} לא משויכות
          </div>
        </div>
      </div>
    );
  }

  // Open: full banner with rows, collapse button on trailing edge.
  // On mobile, span full width; on md+, clamp to a sensible side-banner size.
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "self-start flex flex-col bg-ink-50/95 border border-ink-200 rounded-xl shadow-soft transition-colors",
        // Mobile: full width stacks below the main area.
        // md+: equivalent to clamp(260px, 22vw, 320px) via min/w/max.
        "w-full md:flex-shrink-0 md:w-[22vw] md:min-w-[260px] md:max-w-[320px]",
        isOver && "ring-2 ring-primary-400 border-primary-300"
      )}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-ink-200 flex items-center gap-2">
        <Inbox className="w-4 h-4 text-ink-600 shrink-0" />
        <h3 className="font-semibold text-ink-900 text-sm truncate flex-1">
          לא משויכות
        </h3>
        <span className="text-xs text-ink-500 shrink-0 tabular-nums">
          {totalCount}
        </span>
        <button
          onClick={onToggle}
          type="button"
          className="p-1 rounded-md text-ink-500 hover:text-ink-900 hover:bg-ink-100"
          title="סגור לא משויכות"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-1 max-h-[calc(100vh-340px)] overflow-y-auto scrollbar-thin">
        {roots.length === 0 ? (
          <div className="text-center text-xs text-ink-400 py-6">
            אין משימות לא משויכות
          </div>
        ) : (
          <>
            {incompleteRoots.map((node, idx) => (
              <TaskRow
                key={node.task.id}
                node={node}
                prevSiblingId={
                  idx > 0 ? incompleteRoots[idx - 1]!.task.id : null
                }
                parentTaskId={null}
                grandparentTaskId={null}
                listId={null}
                onRequestFocus={setFocusTaskId}
                focusTaskId={focusTaskId}
                onOpenEdit={onOpenEdit}
                display={display}
              />
            ))}

            {/* Inline new-task row */}
            <div className="flex items-start gap-1.5 rounded-md px-1.5 py-1">
              <span className="w-3.5 shrink-0" />
              <span className="w-3.5 shrink-0" />
              <Plus className="w-4 h-4 mt-0.5 text-ink-400 shrink-0" />
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
                className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm py-0.5 placeholder:text-ink-400"
              />
            </div>

            {completedRoots.length > 0 && (
              <details className="mt-1">
                <summary className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400 cursor-pointer hover:text-ink-600">
                  הושלמו ({completedRoots.length})
                </summary>
                {completedRoots.map((node) => (
                  <TaskRow
                    key={node.task.id}
                    node={node}
                    prevSiblingId={null}
                    parentTaskId={null}
                    grandparentTaskId={null}
                    listId={null}
                    onRequestFocus={setFocusTaskId}
                    focusTaskId={focusTaskId}
                    onOpenEdit={onOpenEdit}
                    display={display}
                  />
                ))}
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
