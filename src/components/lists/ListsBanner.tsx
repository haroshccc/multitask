import { useState, useMemo } from "react";
import { Plus, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
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

export function ListsBanner({ screenKey, kind, className, extra }: ListsBannerProps) {
  const taskListsQuery = useTaskLists();
  const thoughtListsQuery = useThoughtLists();
  const { data: visibility } = useListVisibility(screenKey);
  const setVisibility = useSetListVisibility();
  const createTaskList = useCreateTaskList();
  const createThoughtList = useCreateThoughtList();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showHidden, setShowHidden] = useState(false);

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
      await createTaskList.mutateAsync({
        name: newName.trim(),
        kind: "custom",
      });
    } else {
      await createThoughtList.mutateAsync({ name: newName.trim() });
    }
    setNewName("");
    setCreating(false);
  };

  return (
    <div className={cn("card p-3 space-y-2", className)}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-ink-500 ps-1">רשימות:</span>
        {visibleLists.map((l) => (
          <ListChip
            key={l.id}
            list={l}
            visible
            onToggle={() => toggle(l.id)}
          />
        ))}
        {creating ? (
          <div className="flex items-center gap-1 ps-2">
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
              className="field text-xs w-40 py-1"
            />
            <button onClick={handleCreate} className="btn-accent text-xs py-1 px-2">
              שמור
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="btn-ghost text-xs py-1 px-2"
            title="רשימה חדשה"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}

        {extra && <div className="ms-auto flex items-center gap-2">{extra}</div>}
      </div>

      {hiddenLists.length > 0 && (
        <div>
          <button
            onClick={() => setShowHidden((v) => !v)}
            className="text-xs text-ink-500 hover:text-ink-700 flex items-center gap-1"
          >
            {showHidden ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            רשימות מוסתרות ({hiddenLists.length})
          </button>
          {showHidden && (
            <div className="flex items-center gap-2 flex-wrap mt-1">
              {hiddenLists.map((l) => (
                <ListChip
                  key={l.id}
                  list={l}
                  visible={false}
                  onToggle={() => toggle(l.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ListChip({
  list,
  visible,
  onToggle,
}: {
  list: UnifiedList;
  visible: boolean;
  onToggle: () => void;
}) {
  // Lists always render with a colour now; fall back to a neutral gray for
  // legacy rows that never picked one.
  const bg = list.color ?? "#a8a8bc";
  return (
    <button
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-all",
        visible
          ? "border-ink-200 bg-white text-ink-900 hover:-translate-y-0.5"
          : "border-ink-200 bg-ink-50 text-ink-500 hover:bg-ink-100"
      )}
      style={visible ? { borderColor: bg, color: bg } : undefined}
      title={visible ? "הסתר רשימה" : "הצג רשימה"}
    >
      {list.emoji && (
        <span className="inline-flex items-center">
          <ListIcon emoji={list.emoji} className="w-3.5 h-3.5" />
        </span>
      )}
      <span>{list.name}</span>
      {visible ? (
        <Eye className="w-3 h-3 opacity-60" />
      ) : (
        <EyeOff className="w-3 h-3 opacity-60" />
      )}
    </button>
  );
}
