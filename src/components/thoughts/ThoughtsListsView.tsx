import { useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  pointerWithin,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Inbox, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Thought, ThoughtList } from "@/lib/types/domain";
import {
  useAssignThoughtToList,
} from "@/lib/hooks";
import { ListIcon } from "@/components/tasks/list-icons";
import { ThoughtCard } from "./ThoughtCard";

interface ThoughtsListsViewProps {
  thoughts: Thought[];
  lists: ThoughtList[];
  hiddenLists: Set<string>;
  /** Map: thought.id → ThoughtList[] (assignments). */
  assignmentsByThought: Map<string, ThoughtList[]>;
  compact?: boolean;
  onOpenThought: (id: string) => void;
  onOpenTask: (id: string) => void;
  onOpenEvent: (id: string) => void;
  onCreateList: () => void;
}

/**
 * Kanban-style layout: a sticky "לא משויכות" column on the leading edge
 * plus one column per visible thought-list. Drag a card from "לא משויכות"
 * (or any list) onto a list column to add an assignment. Removal is via
 * the chip × on the card itself — drag is **additive**, never moves /
 * deletes assignments (thoughts are M:N).
 */
export function ThoughtsListsView({
  thoughts,
  lists,
  hiddenLists,
  assignmentsByThought,
  compact,
  onOpenThought,
  onOpenTask,
  onOpenEvent,
  onCreateList,
}: ThoughtsListsViewProps) {
  const visibleLists = useMemo(
    () => lists.filter((l) => !hiddenLists.has(l.id)),
    [lists, hiddenLists]
  );

  const unassigned = useMemo(
    () =>
      thoughts.filter((t) => (assignmentsByThought.get(t.id)?.length ?? 0) === 0),
    [thoughts, assignmentsByThought]
  );

  const byList = useMemo(() => {
    const m = new Map<string, Thought[]>();
    for (const l of visibleLists) m.set(l.id, []);
    for (const t of thoughts) {
      const assigned = assignmentsByThought.get(t.id) ?? [];
      for (const a of assigned) {
        if (m.has(a.id)) m.get(a.id)!.push(t);
      }
    }
    return m;
  }, [thoughts, visibleLists, assignmentsByThought]);

  const assignToList = useAssignThoughtToList();

  // 4-px activation distance — same as Tasks: a click never starts a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const thoughtId = (active.data.current as { thoughtId?: string })?.thoughtId;
    const targetListId = (over.data.current as { listId?: string })?.listId;
    if (!thoughtId || !targetListId) return;
    if (targetListId === "__unassigned__") return; // additive only — no auto-detach
    // No-op if already assigned.
    const assigned = assignmentsByThought.get(thoughtId) ?? [];
    if (assigned.some((l) => l.id === targetListId)) return;
    assignToList.mutate({ thoughtId, listId: targetListId });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col md:flex-row items-stretch gap-3 min-h-[calc(100vh-340px)]">
        {/* Unassigned column — fixed-width, sticky-leading on desktop */}
        <UnassignedColumn
          thoughts={unassigned}
          assignmentsByThought={assignmentsByThought}
          allLists={lists}
          compact={compact}
          onOpenThought={onOpenThought}
          onOpenTask={onOpenTask}
          onOpenEvent={onOpenEvent}
        />

        {/* Visible list columns */}
        <div className="flex-1 min-w-0 overflow-x-auto scrollbar-thin">
          <div className="flex items-stretch gap-3 pb-2">
            {visibleLists.map((l) => (
              <ListColumn
                key={l.id}
                list={l}
                thoughts={byList.get(l.id) ?? []}
                assignmentsByThought={assignmentsByThought}
                allLists={lists}
                compact={compact}
                onOpenThought={onOpenThought}
                onOpenTask={onOpenTask}
                onOpenEvent={onOpenEvent}
              />
            ))}
            {visibleLists.length === 0 && (
              <EmptyHint onCreateList={onCreateList} />
            )}
          </div>
        </div>
      </div>
    </DndContext>
  );
}

// -----------------------------------------------------------------------------

function UnassignedColumn({
  thoughts,
  assignmentsByThought,
  allLists,
  compact,
  onOpenThought,
  onOpenTask,
  onOpenEvent,
}: {
  thoughts: Thought[];
  assignmentsByThought: Map<string, ThoughtList[]>;
  allLists: ThoughtList[];
  compact?: boolean;
  onOpenThought: (id: string) => void;
  onOpenTask: (id: string) => void;
  onOpenEvent: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "list:unassigned",
    data: { listId: "__unassigned__" },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "bg-ink-50/60 border border-ink-200 rounded-xl shadow-soft transition-colors",
        "w-full md:w-72 md:flex-shrink-0 md:sticky md:start-0 md:top-2 md:self-start",
        "md:max-h-[calc(100vh-180px)] md:overflow-y-auto",
        isOver && "ring-2 ring-primary-400 border-primary-300"
      )}
    >
      <div className="px-3 py-2 border-b border-ink-200 flex items-center gap-2 bg-white rounded-t-xl">
        <Inbox className="w-4 h-4 text-ink-600" />
        <span className="text-sm font-semibold text-ink-900">לא משויכות</span>
        <span className="text-xs text-ink-500 tabular-nums ms-auto">
          ({thoughts.length})
        </span>
      </div>
      <div className="p-2 space-y-2">
        {thoughts.length === 0 ? (
          <p className="text-[11px] text-ink-400 text-center py-4">
            כל המחשבות משויכות לרשימות.
          </p>
        ) : (
          thoughts.map((t) => (
            <DraggableThoughtCard
              key={t.id}
              thought={t}
              assignedLists={assignmentsByThought.get(t.id) ?? []}
              allLists={allLists}
              compact={compact}
              onOpen={() => onOpenThought(t.id)}
              onOpenTask={onOpenTask}
              onOpenEvent={onOpenEvent}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ListColumn({
  list,
  thoughts,
  assignmentsByThought,
  allLists,
  compact,
  onOpenThought,
  onOpenTask,
  onOpenEvent,
}: {
  list: ThoughtList;
  thoughts: Thought[];
  assignmentsByThought: Map<string, ThoughtList[]>;
  allLists: ThoughtList[];
  compact?: boolean;
  onOpenThought: (id: string) => void;
  onOpenTask: (id: string) => void;
  onOpenEvent: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `list:${list.id}`,
    data: { listId: list.id },
  });

  const accent = list.color ?? "#6b6b80";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "bg-white border border-ink-200 rounded-xl shadow-soft w-72 md:w-80 shrink-0 transition-colors",
        isOver && "ring-2 ring-primary-400 border-primary-300"
      )}
    >
      <div
        className="px-3 py-2 border-b border-ink-200 flex items-center gap-2 rounded-t-xl"
        style={{ backgroundColor: hexToRgba(accent, 0.08) }}
      >
        <span
          className="w-2.5 h-2.5 rounded-sm shrink-0"
          style={{ backgroundColor: accent }}
        />
        {list.emoji && <ListIcon emoji={list.emoji} className="w-3.5 h-3.5" />}
        <span className="text-sm font-semibold text-ink-900 truncate">
          {list.name}
        </span>
        <span className="text-xs text-ink-500 tabular-nums ms-auto">
          ({thoughts.length})
        </span>
      </div>
      <div className="p-2 space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto">
        {thoughts.length === 0 ? (
          <p className="text-[11px] text-ink-400 text-center py-4">
            גרור מחשבה לכאן כדי לשייך.
          </p>
        ) : (
          thoughts.map((t) => (
            <DraggableThoughtCard
              key={t.id}
              thought={t}
              assignedLists={assignmentsByThought.get(t.id) ?? []}
              allLists={allLists}
              compact={compact}
              onOpen={() => onOpenThought(t.id)}
              onOpenTask={onOpenTask}
              onOpenEvent={onOpenEvent}
            />
          ))
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------

function DraggableThoughtCard(props: {
  thought: Thought;
  assignedLists: ThoughtList[];
  allLists: ThoughtList[];
  compact?: boolean;
  onOpen: () => void;
  onOpenTask: (id: string) => void;
  onOpenEvent: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `thought:${props.thought.id}`,
    data: { thoughtId: props.thought.id },
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "transition-opacity",
        isDragging && "opacity-40 scale-[0.98]"
      )}
    >
      <ThoughtCard
        thought={props.thought}
        assignedLists={props.assignedLists}
        allLists={props.allLists}
        compact={props.compact}
        onOpen={props.onOpen}
        onOpenTask={props.onOpenTask}
        onOpenEvent={props.onOpenEvent}
      />
    </div>
  );
}

function EmptyHint({ onCreateList }: { onCreateList: () => void }) {
  return (
    <div className="flex-1 min-h-[200px] flex flex-col items-center justify-center gap-2 text-center px-4 py-6 border-2 border-dashed border-ink-200 rounded-xl bg-white">
      <p className="text-sm text-ink-500">
        אין רשימות מחשבות פעילות בתצוגה.
      </p>
      <button
        onClick={onCreateList}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
        type="button"
      >
        <Plus className="w-3 h-3" />
        רשימה חדשה
      </button>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return "rgba(100,100,100,0.08)";
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
