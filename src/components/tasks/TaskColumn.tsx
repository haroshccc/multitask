import { useEffect, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Archive, Pin, Plus, MoreHorizontal, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCreateTask } from "@/lib/hooks/useTasks";
import {
  useArchiveTaskList,
  useUpdateTaskList,
} from "@/lib/hooks/useTaskLists";
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

const EMOJI_PRESETS = [
  "📋", "🎨", "🎯", "📦", "🚀", "💡", "💼", "📌",
  "🔖", "✨", "🔥", "⚡", "📝", "🗂️", "🏁", "📥",
];

const COLOR_PRESETS = [
  "#ef4444", // list-red
  "#f59e0b", // primary
  "#10b981", // list-green
  "#14b8a6", // list-teal
  "#06b6d4", // list-cyan
  "#0ea5e9", // list-sky
  "#3b82f6", // list-blue
  "#6366f1", // list-indigo
  "#8b5cf6", // list-violet
  "#ec4899", // pink
];

export function TaskColumn({
  list,
  roots,
  totalCount,
  pinned,
  onOpenEdit,
}: TaskColumnProps) {
  const createTask = useCreateTask();
  const archiveList = useArchiveTaskList();
  const updateList = useUpdateTaskList();
  const [newTitle, setNewTitle] = useState("");
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);

  const listId = list?.id ?? null;
  const { setNodeRef, isOver } = useDroppable({
    id: `list:${listId ?? "unassigned"}`,
    data: { type: "list", listId },
  });

  const [confirmArchive, setConfirmArchive] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(list?.name ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);

  useEffect(() => {
    setNameDraft(list?.name ?? "");
  }, [list?.name]);

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

  const commitName = () => {
    if (!list) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === list.name) {
      setNameDraft(list.name);
      setEditingName(false);
      return;
    }
    updateList.mutate({ listId: list.id, patch: { name: trimmed } });
    setEditingName(false);
  };

  const setEmoji = (emoji: string | null) => {
    if (!list) return;
    updateList.mutate({ listId: list.id, patch: { emoji } });
    setEmojiOpen(false);
  };

  const setColor = (color: string | null) => {
    if (!list) return;
    updateList.mutate({ listId: list.id, patch: { color } });
    setColorOpen(false);
  };

  const headerColor = list?.color ?? null;
  const displayEmoji = list?.emoji ?? (listId === null ? "📥" : "📋");
  const displayName = list?.name ?? "לא משויכות";
  const canEdit = !!list;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "shrink-0 w-[320px] max-h-full flex flex-col bg-white border border-ink-200 rounded-xl shadow-soft transition-colors",
        pinned && "sticky start-0 z-10 bg-ink-50/95 backdrop-blur-sm",
        isOver && "ring-2 ring-primary-400 border-primary-300"
      )}
    >
      {/* Header */}
      <div
        className="px-3 py-2 border-b border-ink-200 flex items-center gap-2 relative"
        style={
          headerColor ? { borderTopColor: headerColor, borderTopWidth: 3 } : undefined
        }
      >
        {/* Emoji button */}
        <button
          type="button"
          onClick={() => canEdit && setEmojiOpen((v) => !v)}
          disabled={!canEdit}
          className={cn(
            "text-base rounded-md leading-none h-6 w-6 flex items-center justify-center",
            canEdit && "hover:bg-ink-100"
          )}
          title={canEdit ? "שנה אימוג'י" : undefined}
        >
          {displayEmoji}
        </button>

        {emojiOpen && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setEmojiOpen(false)}
            />
            <div className="absolute top-full start-2 mt-1 z-30 bg-white border border-ink-200 rounded-xl shadow-lift p-2 grid grid-cols-8 gap-1">
              {EMOJI_PRESETS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className="w-7 h-7 rounded-md hover:bg-ink-100 flex items-center justify-center text-base"
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Name — click to rename */}
        {editingName && canEdit ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName();
              if (e.key === "Escape") {
                setNameDraft(list?.name ?? "");
                setEditingName(false);
              }
            }}
            className="flex-1 min-w-0 bg-transparent border-b border-primary-500 text-sm font-semibold text-ink-900 outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => canEdit && setEditingName(true)}
            className={cn(
              "flex-1 min-w-0 text-start font-semibold text-ink-900 text-sm truncate rounded-md px-1 -mx-1",
              canEdit && "hover:bg-ink-100"
            )}
            title={canEdit ? "לחצי לשינוי שם" : undefined}
            disabled={!canEdit}
          >
            {displayName}
          </button>
        )}

        <span className="text-xs text-ink-500 shrink-0 tabular-nums">{totalCount}</span>

        {pinned && (
          <span className="text-ink-400" title="רשימה מקובעת">
            <Pin className="w-3.5 h-3.5" />
          </span>
        )}

        {canEdit && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100"
              title="תפריט רשימה"
              type="button"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute end-0 mt-1 w-44 bg-white border border-ink-200 rounded-xl shadow-lift z-30 py-1 text-sm">
                  <MenuItem
                    onClick={() => {
                      setEditingName(true);
                      setMenuOpen(false);
                    }}
                  >
                    שנה שם
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setEmojiOpen(true);
                      setMenuOpen(false);
                    }}
                  >
                    שנה אימוג'י
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setColorOpen(true);
                      setMenuOpen(false);
                    }}
                  >
                    שנה צבע
                  </MenuItem>
                  <div className="h-px bg-ink-200 my-1" />
                  <MenuItem
                    danger
                    onClick={() => {
                      setConfirmArchive(true);
                      setMenuOpen(false);
                    }}
                    icon={<Archive className="w-3.5 h-3.5" />}
                  >
                    ארכב רשימה
                  </MenuItem>
                </div>
              </>
            )}
          </div>
        )}

        {colorOpen && canEdit && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setColorOpen(false)}
            />
            <div className="absolute top-full end-2 mt-1 z-30 bg-white border border-ink-200 rounded-xl shadow-lift p-2 flex gap-1.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-6 h-6 rounded-full border border-ink-200 hover:scale-110 transition-transform flex items-center justify-center"
                  style={{ backgroundColor: c }}
                  title={c}
                >
                  {list?.color === c && (
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                  )}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setColor(null)}
                className="w-6 h-6 rounded-full border border-dashed border-ink-300 hover:bg-ink-100 text-ink-400 text-xs"
                title="ללא צבע"
              >
                ×
              </button>
            </div>
          </>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-1 min-h-[120px]">
        {roots.length === 0 ? (
          <button
            onClick={handleEmptyCreate}
            className="w-full text-center text-xs text-ink-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl py-6 transition-colors"
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

function MenuItem({
  onClick,
  children,
  icon,
  danger,
}: {
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        "w-full flex items-center gap-2 px-3 py-1.5 text-start",
        danger
          ? "text-danger-600 hover:bg-danger/10"
          : "text-ink-700 hover:bg-ink-100"
      )}
    >
      {icon}
      {children}
    </button>
  );
}
