import {
  SlidersHorizontal,
  BarChart3,
  Plus,
  Eye,
  EyeOff,
  Check,
  List as ListIcon2,
  Columns3,
  Rows3,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ListIcon } from "@/components/tasks/list-icons";
import { ToggleButton, PopoverButton } from "@/components/layout/ChromeControls";

export type TasksLayout = "columns" | "stack";

interface UnifiedList {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  is_pinned: boolean;
  sort_order: number;
}

interface TasksChromeProps {
  /** Reorder a list one slot up or down. -1 = move up, +1 = move down.
   *  No-op when the list is already at the boundary. */
  onMoveListInOrder?: (listId: string, direction: -1 | 1) => void;
  // Lists
  lists: UnifiedList[];
  hiddenListIds: Set<string>;
  onToggleListVisibility: (listId: string) => void;
  onCreateList: () => void;

  // Layout
  layout: TasksLayout;
  onLayoutChange: (l: TasksLayout) => void;

  // Filter / stats panel toggles
  filtersActiveCount: number;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  statsOpen: boolean;
  onToggleStats: () => void;

  className?: string;
}

/**
 * Compact top chrome for the Tasks screen. Mirrors `CalendarChrome` but
 * scoped to the controls Tasks needs: lists popover + filter toggle + stats
 * toggle. All three are closed by default so the columns get maximum
 * vertical space (particularly important on mobile).
 *
 * Page-level settings (columns-in-view stepper, archive, statuses editor)
 * continue to live in the ScreenScaffold `actions` gear — those are rarely-
 * touched preferences.
 */
export function TasksChrome({
  lists,
  hiddenListIds,
  onToggleListVisibility,
  onCreateList,
  onMoveListInOrder,
  layout,
  onLayoutChange,
  filtersActiveCount,
  filtersOpen,
  onToggleFilters,
  statsOpen,
  onToggleStats,
  className,
}: TasksChromeProps) {
  const visibleListCount = lists.length - hiddenListIds.size;

  return (
    <div
      className={cn(
        "card overflow-visible px-2 py-1.5 flex items-center gap-1.5 flex-wrap",
        className
      )}
    >
      <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider ps-1 pe-2 shrink-0 hidden sm:inline-block">
        סרגל
      </span>

      {/* Lists popover */}
      <PopoverButton
        icon={<ListIcon2 className="w-3.5 h-3.5" />}
        label={`רשימות (${visibleListCount}/${lists.length})`}
        title="בחירת רשימות בתצוגה"
        badge={hiddenListIds.size > 0 ? `−${hiddenListIds.size}` : undefined}
        wide
      >
        {() => {
          // Sort all lists into the same order the columns/stack shows them:
          // pinned first (by sort_order), then unpinned (by sort_order).
          const sortedLists = [...lists].sort((a, b) => {
            if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;
            return a.sort_order - b.sort_order;
          });
          // Build per-peer-group edge flags for VISIBLE lists only.
          const visiblePinned = sortedLists.filter(
            (l) => !hiddenListIds.has(l.id) && l.is_pinned
          );
          const visibleUnpinned = sortedLists.filter(
            (l) => !hiddenListIds.has(l.id) && !l.is_pinned
          );
          const edgeFlags = new Map<string, { isFirst: boolean; isLast: boolean }>();
          [visiblePinned, visibleUnpinned].forEach((group) => {
            group.forEach((l, i) => {
              edgeFlags.set(l.id, {
                isFirst: i === 0,
                isLast: i === group.length - 1,
              });
            });
          });
          return (
          <div className="py-1 max-h-72 overflow-y-auto">
            <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-3 py-1 border-b border-ink-100">
              רשימות פעילות בתצוגה
            </div>
            {sortedLists.length === 0 ? (
              <p className="px-3 py-2 text-xs text-ink-500">
                עוד אין רשימות.
              </p>
            ) : (
              sortedLists.map((l) => {
                const hidden = hiddenListIds.has(l.id);
                // Hidden lists can't be reordered (handleMoveListInOrder
                // no-ops for them since they're absent from visibleLists).
                const flags = edgeFlags.get(l.id);
                const isFirst = hidden || (flags?.isFirst ?? true);
                const isLast = hidden || (flags?.isLast ?? true);
                return (
                  <div
                    key={l.id}
                    className="flex items-center gap-1 px-2 py-0.5 hover:bg-ink-50 group"
                  >
                    <button
                      onClick={() => onToggleListVisibility(l.id)}
                      className="flex items-center gap-2 flex-1 min-w-0 py-1 text-sm text-start"
                      type="button"
                    >
                      <span
                        className={cn(
                          "w-3 h-3 rounded-sm border flex items-center justify-center shrink-0",
                          hidden ? "border-ink-300 bg-white" : "border-transparent"
                        )}
                        style={hidden ? undefined : { backgroundColor: l.color ?? "#6b6b80" }}
                      >
                        {!hidden && <Check className="w-2.5 h-2.5 text-white" />}
                      </span>
                      {l.emoji && <ListIcon emoji={l.emoji} className="w-3.5 h-3.5" />}
                      <span
                        className={cn(
                          "truncate flex-1",
                          hidden ? "text-ink-500" : "text-ink-900"
                        )}
                      >
                        {l.name}
                      </span>
                      {hidden ? (
                        <EyeOff className="w-3 h-3 text-ink-400" />
                      ) : (
                        <Eye className="w-3 h-3 text-ink-400" />
                      )}
                    </button>
                    {onMoveListInOrder && (
                      <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveListInOrder(l.id, -1);
                          }}
                          disabled={isFirst}
                          className="p-1 rounded text-ink-400 hover:text-ink-900 hover:bg-ink-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="העבר למעלה"
                          aria-label="העבר למעלה"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveListInOrder(l.id, 1);
                          }}
                          disabled={isLast}
                          className="p-1 rounded text-ink-400 hover:text-ink-900 hover:bg-ink-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="העבר למטה"
                          aria-label="העבר למטה"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div className="border-t border-ink-100 mt-1 pt-1">
              <button
                onClick={onCreateList}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start text-primary-600 hover:bg-ink-50"
                type="button"
              >
                <Plus className="w-3.5 h-3.5" />
                רשימה חדשה
              </button>
            </div>
          </div>
          );
        }}
      </PopoverButton>

      <ToggleButton
        active={filtersOpen}
        onClick={onToggleFilters}
        icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
        label="סינון"
        badge={filtersActiveCount > 0 ? String(filtersActiveCount) : undefined}
      />

      <ToggleButton
        active={statsOpen}
        onClick={onToggleStats}
        icon={<BarChart3 className="w-3.5 h-3.5" />}
        label="סטטיסטיקות"
      />

      {/* Layout toggle: kanban (columns) vs vertical-stack of lists. The
          per-list visibility filter (the lists popover above) still applies
          to both modes. */}
      <div className="ms-auto inline-flex rounded-md border border-ink-200 overflow-hidden">
        <LayoutTab
          active={layout === "columns"}
          onClick={() => onLayoutChange("columns")}
          icon={<Columns3 className="w-3 h-3" />}
          label="עמודות"
        />
        <LayoutTab
          active={layout === "stack"}
          onClick={() => onLayoutChange("stack")}
          icon={<Rows3 className="w-3 h-3" />}
          label="ערמה"
        />
      </div>
    </div>
  );
}

function LayoutTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium border-e border-ink-200 last:border-e-0 transition-colors",
        active
          ? "bg-ink-900 text-white"
          : "bg-white text-ink-700 hover:bg-ink-50"
      )}
      type="button"
      title={label}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

