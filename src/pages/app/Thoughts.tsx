import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import {
  FilterBar,
  useFiltersFromUrl,
  type FilterField,
} from "@/components/filters/FilterBar";
import {
  useThoughts,
  useThoughtLists,
  useCreateThought,
  useCreateThoughtList,
  useBulkThoughtAssignments,
  useListVisibility,
  useSetListVisibility,
} from "@/lib/hooks";
import type { FilterConfig, Thought, ThoughtList } from "@/lib/types/domain";
import {
  ThoughtsChrome,
  type ThoughtsDensity,
  type ThoughtsSortMode,
  type ThoughtsViewMode,
} from "@/components/thoughts/ThoughtsChrome";
import { ThoughtComposer } from "@/components/thoughts/ThoughtComposer";
import { ThoughtCard } from "@/components/thoughts/ThoughtCard";
import { ThoughtEditModal } from "@/components/thoughts/ThoughtEditModal";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import { EventEditModal } from "@/components/calendar/EventEditModal";
import { mockProvider } from "@/lib/ai/thought-suggestions";

const VIEW_KEY = "multitask:thoughts:view";
const SORT_KEY = "multitask:thoughts:sort";
const DENSITY_KEY = "multitask:thoughts:density";

function readLS<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const v = window.localStorage.getItem(key);
  return (v as T) || fallback;
}
function writeLS(key: string, value: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(key, value);
}

export function Thoughts() {
  const [filters, setFilters] = useFiltersFromUrl();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const [viewMode, setViewModeState] = useState<ThoughtsViewMode>(() =>
    readLS<ThoughtsViewMode>(VIEW_KEY, "all")
  );
  const [sortMode, setSortModeState] = useState<ThoughtsSortMode>(() =>
    readLS<ThoughtsSortMode>(SORT_KEY, "newest")
  );
  const [density, setDensityState] = useState<ThoughtsDensity>(() =>
    readLS<ThoughtsDensity>(DENSITY_KEY, "regular")
  );
  const setViewMode = (m: ThoughtsViewMode) => {
    setViewModeState(m);
    writeLS(VIEW_KEY, m);
  };
  const setSortMode = (m: ThoughtsSortMode) => {
    setSortModeState(m);
    writeLS(SORT_KEY, m);
  };
  const setDensity = (d: ThoughtsDensity) => {
    setDensityState(d);
    writeLS(DENSITY_KEY, d);
  };

  const { data: thoughts = [] } = useThoughts({ includeArchived: archiveOpen });
  const { data: lists = [] } = useThoughtLists();
  const { data: visibility } = useListVisibility("thoughts");
  const setListVisibility = useSetListVisibility();
  const createThought = useCreateThought();
  const createThoughtList = useCreateThoughtList();

  const thoughtIds = useMemo(() => thoughts.map((t) => t.id), [thoughts]);
  const { data: assignments = [] } = useBulkThoughtAssignments(thoughtIds);

  const hiddenLists = useMemo(
    () => new Set(visibility?.hidden_list_ids ?? []),
    [visibility]
  );

  const assignmentsByThought = useMemo(() => {
    const map = new Map<string, ThoughtList[]>();
    const listById = new Map(lists.map((l) => [l.id, l] as const));
    for (const a of assignments) {
      const l = listById.get(a.list_id);
      if (!l) continue;
      const arr = map.get(a.thought_id) ?? [];
      arr.push(l);
      map.set(a.thought_id, arr);
    }
    return map;
  }, [assignments, lists]);

  const displayed = useMemo(() => {
    let items: Thought[] = thoughts.slice();

    // Archive toggle — the hook already filters to non-archived when
    // `includeArchived=false`; when true, narrow to archive-only.
    if (archiveOpen) {
      items = items.filter((t) => t.status === "archived");
    }

    if (viewMode === "unprocessed") {
      items = items.filter((t) => !t.processed_at);
    } else if (viewMode === "unassigned") {
      items = items.filter(
        (t) => (assignmentsByThought.get(t.id)?.length ?? 0) === 0
      );
    }

    if (hiddenLists.size > 0) {
      items = items.filter((t) => {
        const assigned = assignmentsByThought.get(t.id) ?? [];
        if (assigned.length === 0) return true;
        return assigned.some((l) => !hiddenLists.has(l.id));
      });
    }

    const f = filters as FilterConfig;
    if (f.tags && f.tags.length > 0) {
      items = items.filter((t) => t.tags.some((x) => f.tags!.includes(x)));
    }
    if (f.sources && f.sources.length > 0) {
      items = items.filter((t) => f.sources!.includes(t.source));
    }

    if (sortMode === "newest") {
      items.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else if (sortMode === "oldest") {
      items.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    } else if (sortMode === "unprocessed_first") {
      items.sort((a, b) => {
        const ap = a.processed_at ? 1 : 0;
        const bp = b.processed_at ? 1 : 0;
        if (ap !== bp) return ap - bp;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
    }

    return items;
  }, [
    thoughts,
    archiveOpen,
    viewMode,
    hiddenLists,
    assignmentsByThought,
    filters,
    sortMode,
  ]);

  const fields: FilterField[] = useMemo(
    () => [
      {
        key: "sources",
        type: "multi-enum",
        label: "מקור",
        options: [
          { value: "app_text", label: "אפליקציה · טקסט" },
          { value: "app_audio", label: "אפליקציה · הקלטה" },
          { value: "whatsapp_text", label: "WhatsApp · טקסט" },
          { value: "whatsapp_audio", label: "WhatsApp · הקלטה" },
          { value: "whatsapp_image", label: "WhatsApp · תמונה" },
        ],
      },
      { key: "tags", type: "multi-text", label: "תגים" },
    ],
    []
  );

  const filtersActiveCount = useMemo(() => {
    let n = 0;
    Object.values(filters).forEach((v) => {
      if (Array.isArray(v)) n += v.length;
      else if (v !== undefined && v !== null && v !== "" && v !== false) n += 1;
    });
    return n;
  }, [filters]);

  const toggleListVisibility = (listId: string) => {
    const current = visibility?.hidden_list_ids ?? [];
    const next = current.includes(listId)
      ? current.filter((id) => id !== listId)
      : [...current, listId];
    setListVisibility.mutate({ screenKey: "thoughts", hiddenListIds: next });
  };

  const handleCreateList = async () => {
    const name = window.prompt("שם הרשימה החדשה:");
    if (!name?.trim()) return;
    await createThoughtList.mutateAsync({ name: name.trim() });
  };

  const unifiedLists = useMemo(
    () =>
      lists.map((l) => ({
        id: l.id,
        name: l.name,
        emoji: l.emoji,
        color: l.color,
      })),
    [lists]
  );

  const handleCompose = async (text: string) => {
    // Create first (fast path for Enter-to-save), then kick off the AI
    // title in the background so the card refreshes once it returns.
    await createThought.mutateAsync({
      source: "app_text",
      text_content: text,
      tags: [],
    });
    // Reserved for the real provider hookup (see `src/lib/ai/thought-suggestions.ts`).
    void mockProvider;
  };

  const [editingThoughtId, setEditingThoughtId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Deep-link support: global search routes to `/app/thoughts?thought=<id>`.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const id = searchParams.get("thought");
    if (id) {
      setEditingThoughtId(id);
      // Remove the param so closing the modal doesn't re-open it.
      const next = new URLSearchParams(searchParams);
      next.delete("thought");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const stats = useMemo(() => {
    const total = thoughts.length;
    const processed = thoughts.filter((t) => t.processed_at).length;
    const fromWhatsapp = thoughts.filter((t) =>
      t.source.startsWith("whatsapp")
    ).length;
    const audio = thoughts.filter((t) => t.source.endsWith("audio")).length;
    return { total, processed, fromWhatsapp, audio };
  }, [thoughts]);

  return (
    <ScreenScaffold title="מחשבות" subtitle="">
      <div className="space-y-2">
        <ThoughtsChrome
          lists={unifiedLists}
          hiddenListIds={hiddenLists}
          onToggleListVisibility={toggleListVisibility}
          onCreateList={handleCreateList}
          filtersActiveCount={filtersActiveCount}
          filtersOpen={filtersOpen}
          onToggleFilters={() => setFiltersOpen((v) => !v)}
          statsOpen={statsOpen}
          onToggleStats={() => setStatsOpen((v) => !v)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          density={density}
          onDensityChange={setDensity}
          archiveOpen={archiveOpen}
          onToggleArchive={() => setArchiveOpen((v) => !v)}
        />

        {filtersOpen && (
          <FilterBar
            screenKey="thoughts"
            filters={filters}
            onChange={setFilters}
            fields={fields}
            alwaysExpanded
          />
        )}

        {statsOpen && (
          <div className="card px-3 py-2 flex flex-wrap gap-4 text-xs">
            <Stat label="סה״כ" value={stats.total} />
            <Stat
              label="מעובדות"
              value={`${stats.processed} / ${stats.total}`}
            />
            <Stat label="מוואטסאפ" value={stats.fromWhatsapp} />
            <Stat label="אודיו" value={stats.audio} />
          </div>
        )}

        <ThoughtComposer onSubmit={handleCompose} />

        {displayed.length === 0 ? (
          <div className="card px-4 py-10 text-center text-sm text-ink-500">
            {archiveOpen
              ? "אין מחשבות בארכיון."
              : "אין עדיין מחשבות. כתוב משהו למעלה ולחץ Enter."}
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map((t) => (
              <ThoughtCard
                key={t.id}
                thought={t}
                allLists={lists}
                assignedLists={assignmentsByThought.get(t.id) ?? []}
                compact={density === "compact"}
                onOpen={() => setEditingThoughtId(t.id)}
                onOpenTask={setEditingTaskId}
                onOpenEvent={setEditingEventId}
              />
            ))}
          </div>
        )}
      </div>

      <ThoughtEditModal
        thoughtId={editingThoughtId}
        onClose={() => setEditingThoughtId(null)}
        onOpenTask={(id) => {
          setEditingThoughtId(null);
          setEditingTaskId(id);
        }}
        onOpenEvent={(id) => {
          setEditingThoughtId(null);
          setEditingEventId(id);
        }}
      />
      <TaskEditModal
        taskId={editingTaskId}
        onClose={() => setEditingTaskId(null)}
      />
      <EventEditModal
        open={!!editingEventId}
        eventId={editingEventId}
        onClose={() => setEditingEventId(null)}
      />
    </ScreenScaffold>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">
        {label}
      </span>
      <span className="text-lg font-bold text-ink-900 tabular-nums">
        {value}
      </span>
    </div>
  );
}
