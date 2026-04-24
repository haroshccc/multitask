import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, ChevronDown, Eye, EyeOff, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useListVisibility, useSetListVisibility } from "@/lib/hooks/useListVisibility";
import { useTaskLists } from "@/lib/hooks/useTaskLists";
import { useThoughtLists } from "@/lib/hooks/useThoughtLists";
import { useCreateTaskList } from "@/lib/hooks/useTaskLists";
import { useCreateThoughtList } from "@/lib/hooks/useThoughtLists";
import { ListIcon } from "@/components/tasks/list-icons";
import type { DashboardScreen, TaskList, ThoughtList } from "@/lib/types/domain";

export type ListKind = "task" | "thought";

interface ListsBannerProps {
  screenKey: DashboardScreen;
  kind: ListKind;
  className?: string;
  /** Extra toggles rendered on the right (e.g. "tasks/events/both" for calendar) */
  extra?: React.ReactNode;
}

interface UnifiedList {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
}

/**
 * Compact lists banner — horizontal row of list names with a colored underline
 * when active (tab-like). Clicking a name toggles its visibility for the
 * current screen. Hidden lists live behind a "⋯ N מוסתרות" button that opens
 * an attached popover (not a detached thought-bubble) anchored to the button.
 */
export function ListsBanner({ screenKey, kind, className, extra }: ListsBannerProps) {
  const taskListsQuery = useTaskLists();
  const thoughtListsQuery = useThoughtLists();
  const { data: visibility } = useListVisibility(screenKey);
  const setVisibility = useSetListVisibility();
  const createTaskList = useCreateTaskList();
  const createThoughtList = useCreateThoughtList();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const hiddenRef = useRef<HTMLDivElement>(null);

  // Close hidden popover on outside click.
  useEffect(() => {
    if (!hiddenOpen) return;
    const onDown = (e: MouseEvent) => {
      if (hiddenRef.current && !hiddenRef.current.contains(e.target as Node)) {
        setHiddenOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [hiddenOpen]);

  const lists: UnifiedList[] = useMemo(() => {
    if (kind === "task") {
      return (taskListsQuery.data ?? []).map((l: TaskList) => ({
        id: l.id,
        name: l.name,
        emoji: l.emoji,
        color: l.color,
      }));
    }
    return (thoughtListsQuery.data ?? []).map((l: ThoughtList) => ({
      id: l.id,
      name: l.name,
      emoji: l.emoji,
      color: l.color,
    }));
  }, [kind, taskListsQuery.data, thoughtListsQuery.data]);

  const hiddenIds = visibility?.hidden_list_ids ?? [];
  const hiddenSet = new Set(hiddenIds);
  const visibleLists = lists.filter((l) => !hiddenSet.has(l.id));
  const hiddenLists = lists.filter((l) => hiddenSet.has(l.id));

  const toggle = (listId: string) => {
    const isHidden = hiddenSet.has(listId);
    const next = isHidden
      ? hiddenIds.filter((id) => id !== listId)
      : [...hiddenIds, listId];
    setVisibility.mutate({ screenKey, hiddenListIds: next });
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    if (kind === "task") {
      await createTaskList.mutateAsync({ name: newName.trim(), kind: "custom" });
    } else {
      await createThoughtList.mutateAsync({ name: newName.trim() });
    }
    setNewName("");
    setCreating(false);
  };

  return (
    <div
      className={cn(
        "card px-3 py-1.5 flex items-center gap-1 flex-wrap overflow-visible",
        className
      )}
    >
      <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider ps-1 pe-2 shrink-0">
        רשימות
      </span>

      {/* Visible lists — tab-style with colored underline */}
      <div className="flex items-center gap-0.5 flex-wrap min-w-0">
        {visibleLists.map((l) => (
          <ListItem key={l.id} list={l} onClick={() => toggle(l.id)} />
        ))}

        {creating ? (
          <div className="flex items-center gap-1 px-1.5">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  setNewName("");
                  setCreating(false);
                }
              }}
              placeholder="שם רשימה..."
              className="field text-xs w-32 py-0.5"
            />
            <button onClick={handleCreate} className="btn-accent text-[10px] py-0.5 px-1.5" type="button">
              שמור
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="p-1 rounded-sm text-ink-400 hover:text-primary-600 hover:bg-ink-100"
            title="רשימה חדשה"
            type="button"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="ms-auto flex items-center gap-1 shrink-0">
        {/* Hidden lists popover */}
        {hiddenLists.length > 0 && (
          <div className="relative" ref={hiddenRef}>
            <button
              onClick={() => setHiddenOpen((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-[11px] text-ink-500 hover:bg-ink-100",
                hiddenOpen && "bg-ink-100 text-ink-700"
              )}
              type="button"
              title="רשימות מוסתרות"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
              <span>
                {hiddenLists.length} מוסתרות
              </span>
              <ChevronDown
                className={cn("w-3 h-3 transition-transform", hiddenOpen && "rotate-180")}
              />
            </button>
            {hiddenOpen && (
              <div className="absolute top-full end-0 mt-1 z-30 bg-white border border-ink-200 rounded-lg shadow-lift min-w-[200px] py-1">
                <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-3 py-1 border-b border-ink-100">
                  לחץ להצגה
                </div>
                {hiddenLists.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => toggle(l.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start hover:bg-ink-50"
                    type="button"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: l.color ?? "#a8a8bc" }}
                    />
                    {l.emoji && (
                      <ListIcon emoji={l.emoji} className="w-3.5 h-3.5" />
                    )}
                    <span className="truncate flex-1 text-ink-700">{l.name}</span>
                    <EyeOff className="w-3 h-3 text-ink-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {extra && <div className="flex items-center gap-2">{extra}</div>}
      </div>
    </div>
  );
}

function ListItem({ list, onClick }: { list: UnifiedList; onClick: () => void }) {
  const color = list.color ?? "#6b6b80";
  return (
    <button
      onClick={onClick}
      className="group relative inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-ink-900 hover:bg-ink-50 rounded-sm transition-colors"
      title={`הסתר "${list.name}"`}
      type="button"
    >
      {list.emoji && (
        <ListIcon emoji={list.emoji} className="w-3.5 h-3.5" />
      )}
      <span className="leading-none">{list.name}</span>
      {/* Colored underline — the "active" indicator. */}
      <span
        className="absolute start-1 end-1 -bottom-0.5 h-[2px] rounded-full"
        style={{ backgroundColor: color }}
      />
      <Eye className="w-2.5 h-2.5 text-ink-400 opacity-0 group-hover:opacity-70 transition-opacity" />
    </button>
  );
}
