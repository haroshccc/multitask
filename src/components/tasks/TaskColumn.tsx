import { useEffect, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  Archive,
  Plus,
  MoreHorizontal,
  Check,
  Pin,
  Share2,
  Palette,
  Smile,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCreateTask } from "@/lib/hooks/useTasks";
import {
  useArchiveTaskList,
  useUpdateTaskList,
} from "@/lib/hooks/useTaskLists";
import type { TaskList } from "@/lib/types/domain";
import type { RowDisplayPrefs } from "@/lib/hooks/useRowDisplayPrefs";
import { pushUndo } from "@/lib/undo/store";
import { TaskRow, type TaskTreeNode } from "./TaskRow";
import { ShareListModal } from "./ShareListModal";
import { LIST_ICON_PRESETS, ListIcon } from "./list-icons";

interface TaskColumnProps {
  /** null = the "unassigned" pinned column */
  list: TaskList | null;
  /** Root tasks for this column (already tree-built) */
  roots: TaskTreeNode[];
  /** Total task count across all depths, for header */
  totalCount: number;
  /** True if this column is rendered as the sticky-pinned "unassigned" column */
  pinned?: boolean;
  /** How many columns are sharing the main area right now (= min(count, max)).
      Each column takes 1/divisor of the parent width. */
  divisor?: number;
  /** Per-user pref of which inline badges to render on each task row */
  display: RowDisplayPrefs;
  onOpenEdit: (taskId: string) => void;
}

const COLOR_PRESETS = [
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
];

export function TaskColumn({
  list,
  roots,
  totalCount,
  pinned,
  divisor = 1,
  display,
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
  const [shareOpen, setShareOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

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
    const prev = list.name;
    const listId = list.id;
    updateList.mutate({ listId, patch: { name: trimmed } });
    pushUndo({
      description: "שינוי שם רשימה",
      undo: () => updateList.mutate({ listId, patch: { name: prev } }),
      redo: () => updateList.mutate({ listId, patch: { name: trimmed } }),
    });
    setEditingName(false);
  };

  const setEmoji = (emoji: string | null) => {
    if (!list) return;
    const prev = list.emoji ?? null;
    const listId = list.id;
    updateList.mutate({ listId, patch: { emoji } });
    pushUndo({
      description: "שינוי אימוג'י",
      undo: () => updateList.mutate({ listId, patch: { emoji: prev } }),
      redo: () => updateList.mutate({ listId, patch: { emoji } }),
    });
    setEmojiOpen(false);
  };

  const setColor = (color: string | null) => {
    if (!list) return;
    const prev = list.color ?? null;
    const listId = list.id;
    updateList.mutate({ listId, patch: { color } });
    pushUndo({
      description: "שינוי צבע רשימה",
      undo: () => updateList.mutate({ listId, patch: { color: prev } }),
      redo: () => updateList.mutate({ listId, patch: { color } }),
    });
    setColorOpen(false);
  };

  const togglePin = () => {
    if (!list) return;
    const prev = !!list.is_pinned;
    const next = !prev;
    const listId = list.id;
    updateList.mutate({ listId, patch: { is_pinned: next } });
    pushUndo({
      description: next ? "נעיצת רשימה" : "הסרת נעיצה",
      undo: () => updateList.mutate({ listId, patch: { is_pinned: prev } }),
      redo: () => updateList.mutate({ listId, patch: { is_pinned: next } }),
    });
    setMenuOpen(false);
  };

  const listColor = list?.color ?? null;
  const displayEmoji = list?.emoji ?? null;
  const displayName = list?.name ?? "לא משויכות";
  const canEdit = !!list;
  const isPinnedByFlag = !!list?.is_pinned;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "shrink-0 self-start flex flex-col bg-white border border-ink-200 rounded-xl shadow-soft transition-colors",
        // Pinned (= "Unassigned") column has its own banner on the trailing
        // edge of the page; size it independently of the main grid.
        pinned && "bg-ink-50/95",
        isOver && "ring-2 ring-primary-400 border-primary-300"
      )}
      // Width: each column takes 1/divisor of its parent container width
      // (in px), minus the shared 12px gap. When the count > maxVisible, the
      // parent's overflow-x:auto handles horizontal scroll.
      style={{
        flex: "0 0 auto",
        width: `calc((100% - ${(divisor - 1) * 12}px) / ${divisor})`,
        ...(listColor
          ? { ["--list-color" as string]: listColor }
          : {}),
      } as React.CSSProperties}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-ink-200 flex items-center gap-2 relative">
        {/* Short color strip on the leading edge instead of a full top border */}
        {listColor && (
          <span
            aria-hidden
            className="absolute top-0 bottom-0 start-0 w-1"
            style={{ backgroundColor: listColor }}
          />
        )}

        {/* Icon slot (click to change) */}
        <button
          type="button"
          onClick={() => canEdit && setEmojiOpen((v) => !v)}
          disabled={!canEdit}
          className={cn(
            "rounded-md h-6 w-6 flex items-center justify-center shrink-0 text-ink-900",
            canEdit && "hover:bg-ink-100",
            !displayEmoji && canEdit && "text-ink-300 border border-dashed border-ink-300"
          )}
          title={canEdit ? "אייקון" : undefined}
        >
          <ListIcon emoji={displayEmoji} className="w-4 h-4" />
          {!displayEmoji && !canEdit && (
            <span className="text-ink-300">·</span>
          )}
        </button>

        {emojiOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setEmojiOpen(false)} />
            <div className="absolute top-full start-2 mt-1 z-30 bg-white border border-ink-200 rounded-xl shadow-lift p-2">
              <div className="grid grid-cols-5 gap-1">
                {LIST_ICON_PRESETS.map((preset) => {
                  const PresetIcon = preset.icon;
                  const stored = `icon:${preset.key}`;
                  const selected = list?.emoji === stored;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => setEmoji(stored)}
                      title={preset.label}
                      className={cn(
                        "w-8 h-8 rounded-md flex items-center justify-center text-ink-900 hover:bg-ink-100",
                        selected && "bg-ink-100 ring-1 ring-ink-300"
                      )}
                    >
                      <PresetIcon className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setEmoji(null)}
                className="mt-1 w-full text-xs text-ink-500 hover:text-danger-500 rounded-md py-1 border-t border-ink-100"
              >
                הסר אייקון
              </button>
            </div>
          </>
        )}

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
            disabled={!canEdit}
          >
            {displayName}
          </button>
        )}

        <span className="text-xs text-ink-500 shrink-0 tabular-nums">{totalCount}</span>

        {(pinned || isPinnedByFlag) && (
          <span className="text-ink-400" title="רשימה מקובעת">
            <Pin className="w-3.5 h-3.5" />
          </span>
        )}

        {canEdit && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1 rounded-md text-ink-500 hover:text-ink-900 hover:bg-ink-100"
              title="תפריט רשימה"
              type="button"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                <div className="absolute end-0 mt-1 w-52 bg-white border border-ink-200 rounded-xl shadow-lift z-30 py-1 text-sm">
                  <MenuItem
                    icon={<Palette className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setColorOpen(true);
                      setMenuOpen(false);
                    }}
                  >
                    שנה צבע כותרת
                  </MenuItem>
                  <MenuItem
                    icon={<Pin className="w-3.5 h-3.5" />}
                    onClick={togglePin}
                  >
                    {isPinnedByFlag ? "הסר נעיצה" : "נעץ רשימה"}
                  </MenuItem>
                  <MenuItem
                    icon={<Type className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setEditingName(true);
                      setMenuOpen(false);
                    }}
                  >
                    שנה שם רשימה
                  </MenuItem>
                  <MenuItem
                    icon={<Smile className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setEmojiOpen(true);
                      setMenuOpen(false);
                    }}
                  >
                    שנה אייקון
                  </MenuItem>
                  <MenuItem
                    icon={<Share2 className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setShareOpen(true);
                      setMenuOpen(false);
                    }}
                  >
                    שיתוף וסנכרון
                  </MenuItem>
                  <div className="h-px bg-ink-200 my-1" />
                  <MenuItem
                    danger
                    icon={<Archive className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setConfirmArchive(true);
                      setMenuOpen(false);
                    }}
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
            <div className="fixed inset-0 z-20" onClick={() => setColorOpen(false)} />
            <div className="absolute top-full end-2 mt-1 z-30 bg-white border border-ink-200 rounded-xl shadow-lift p-2 flex gap-1.5 flex-wrap w-[220px]">
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

      {/* Body — auto-sizes to content, caps at viewport height for scroll */}
      <div className="p-1 max-h-[calc(100vh-300px)] overflow-y-auto scrollbar-thin">
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
                prevSiblingId={
                  idx > 0 ? incompleteRoots[idx - 1]!.task.id : null
                }
                parentTaskId={null}
                grandparentTaskId={null}
                listId={listId}
                onRequestFocus={setFocusTaskId}
                focusTaskId={focusTaskId}
                onOpenEdit={onOpenEdit}
                display={display}
              />
            ))}

            {/* Inline new-task row: one line under the last existing task */}
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

            {/* Collapsible root-level "הושלמו" */}
            {completedRoots.length > 0 && (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setShowCompleted((v) => !v)}
                  className="w-full flex items-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400 hover:text-ink-600"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={cn(
                      "w-3 h-3 transition-transform",
                      showCompleted ? "rotate-90" : "rotate-0"
                    )}
                  >
                    <path d="M5 7l5 6 5-6H5z" />
                  </svg>
                  הושלמו ({completedRoots.length})
                </button>
                {showCompleted &&
                  completedRoots.map((node) => (
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
                      display={display}
                    />
                  ))}
              </div>
            )}
          </>
        )}
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
              הרשימה "{list.name}" וכל המשימות שבה יעברו לארכיון ויוסתרו מהתצוגה.
              ניתן לשחזר תוך 60 יום מהגדרות הדף.
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
                className="text-xs inline-flex items-center justify-center gap-1.5 rounded-sm px-4 py-2.5 font-medium bg-danger-500 text-white hover:bg-danger-600 transition-colors"
                type="button"
              >
                <Archive className="w-3.5 h-3.5" />
                ארכב
              </button>
            </div>
          </div>
        </div>
      )}

      {shareOpen && list && (
        <ShareListModal list={list} onClose={() => setShareOpen(false)} />
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
