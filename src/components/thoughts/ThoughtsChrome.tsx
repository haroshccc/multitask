import {
  SlidersHorizontal,
  BarChart3,
  Brain,
  LayoutList,
  Archive,
  Eye,
  EyeOff,
  Check,
  Plus,
  Rows3,
  Columns3,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ListIcon } from "@/components/tasks/list-icons";
import { ToggleButton, PopoverButton } from "@/components/layout/ChromeControls";

export type ThoughtsViewMode = "all" | "unprocessed" | "unassigned";
export type ThoughtsSortMode = "newest" | "oldest" | "unprocessed_first";
export type ThoughtsDensity = "regular" | "compact";
export type ThoughtsLayout = "feed" | "lists";

interface UnifiedList {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
}

interface ThoughtsChromeProps {
  // Lists
  lists: UnifiedList[];
  hiddenListIds: Set<string>;
  onToggleListVisibility: (listId: string) => void;
  onCreateList: () => void;

  // Filter / stats
  filtersActiveCount: number;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  statsOpen: boolean;
  onToggleStats: () => void;

  // View & sort
  viewMode: ThoughtsViewMode;
  onViewModeChange: (m: ThoughtsViewMode) => void;
  sortMode: ThoughtsSortMode;
  onSortModeChange: (m: ThoughtsSortMode) => void;
  density: ThoughtsDensity;
  onDensityChange: (d: ThoughtsDensity) => void;

  // Archive
  archiveOpen: boolean;
  onToggleArchive: () => void;

  // Layout (feed vs. lists/kanban)
  layout: ThoughtsLayout;
  onLayoutChange: (l: ThoughtsLayout) => void;

  className?: string;
}

/**
 * Compact top chrome for the Thoughts screen. Mirrors `TasksChrome` /
 * `CalendarChrome` per SPEC §12.8. Five icon-only (mobile) / icon-and-label
 * (desktop) controls:
 *
 *   🧠  רשימות   — popover, checkbox per list + "+ רשימה חדשה"
 *   Σ   סטטיסטיקות — toggle, open stats strip below
 *   ⚑   סינון    — toggle, open FilterBar below
 *   ≣   תצוגה   — popover, view-mode + sort + density
 *   🗄  ארכיון  — toggle, show archived thoughts in list
 *
 * All closed by default; state is lifted to the Thoughts page and persisted
 * there so the defaults stay on refresh.
 */
export function ThoughtsChrome({
  lists,
  hiddenListIds,
  onToggleListVisibility,
  onCreateList,
  filtersActiveCount,
  filtersOpen,
  onToggleFilters,
  statsOpen,
  onToggleStats,
  viewMode,
  onViewModeChange,
  sortMode,
  onSortModeChange,
  density,
  onDensityChange,
  archiveOpen,
  onToggleArchive,
  layout,
  onLayoutChange,
  className,
}: ThoughtsChromeProps) {
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
        icon={<Brain className="w-3.5 h-3.5" />}
        label={`רשימות (${visibleListCount}/${lists.length})`}
        title="בחירת רשימות מחשבות בתצוגה"
        badge={hiddenListIds.size > 0 ? `−${hiddenListIds.size}` : undefined}
        wide
      >
        {() => (
          <div className="py-1 max-h-72 overflow-y-auto">
            <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-3 py-1 border-b border-ink-100">
              רשימות מחשבות
            </div>
            {lists.length === 0 ? (
              <p className="px-3 py-2 text-xs text-ink-500">עוד אין רשימות.</p>
            ) : (
              lists.map((l) => {
                const hidden = hiddenListIds.has(l.id);
                return (
                  <button
                    key={l.id}
                    onClick={() => onToggleListVisibility(l.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start hover:bg-ink-50"
                    type="button"
                  >
                    <span
                      className={cn(
                        "w-3 h-3 rounded-sm border flex items-center justify-center shrink-0",
                        hidden ? "border-ink-300 bg-white" : "border-transparent"
                      )}
                      style={
                        hidden ? undefined : { backgroundColor: l.color ?? "#6b6b80" }
                      }
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
        )}
      </PopoverButton>

      <ToggleButton
        active={statsOpen}
        onClick={onToggleStats}
        icon={<BarChart3 className="w-3.5 h-3.5" />}
        label="סטטיסטיקות"
      />

      <ToggleButton
        active={filtersOpen}
        onClick={onToggleFilters}
        icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
        label="סינון"
        badge={filtersActiveCount > 0 ? String(filtersActiveCount) : undefined}
      />

      {/* View popover — split / sort / density */}
      <PopoverButton
        icon={<LayoutList className="w-3.5 h-3.5" />}
        label="תצוגה"
        title="סינון לפי סטטוס + מיון + צפיפות"
      >
        {() => (
          <div className="py-2">
            <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-3 pb-1">
              חלוקה
            </div>
            <ViewOption
              active={viewMode === "all"}
              onClick={() => onViewModeChange("all")}
            >
              כל המחשבות
            </ViewOption>
            <ViewOption
              active={viewMode === "unprocessed"}
              onClick={() => onViewModeChange("unprocessed")}
            >
              לא מעובדות בלבד
            </ViewOption>
            <ViewOption
              active={viewMode === "unassigned"}
              onClick={() => onViewModeChange("unassigned")}
            >
              לא משויכות בלבד
            </ViewOption>

            <div className="border-t border-ink-100 mt-1 pt-1">
              <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-3 pb-1">
                מיון
              </div>
              <ViewOption
                active={sortMode === "newest"}
                onClick={() => onSortModeChange("newest")}
              >
                חדשות למעלה
              </ViewOption>
              <ViewOption
                active={sortMode === "oldest"}
                onClick={() => onSortModeChange("oldest")}
              >
                ישנות למעלה
              </ViewOption>
              <ViewOption
                active={sortMode === "unprocessed_first"}
                onClick={() => onSortModeChange("unprocessed_first")}
              >
                לא מעובדות קודם
              </ViewOption>
            </div>

            <div className="border-t border-ink-100 mt-1 pt-1">
              <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-3 pb-1">
                צפיפות
              </div>
              <ViewOption
                active={density === "regular"}
                onClick={() => onDensityChange("regular")}
              >
                רגיל
              </ViewOption>
              <ViewOption
                active={density === "compact"}
                onClick={() => onDensityChange("compact")}
              >
                קומפקטי
              </ViewOption>
            </div>
          </div>
        )}
      </PopoverButton>

      <ToggleButton
        active={archiveOpen}
        onClick={onToggleArchive}
        icon={<Archive className="w-3.5 h-3.5" />}
        label="ארכיון"
      />

      {/* Layout toggle: feed (single column) vs. lists (kanban). */}
      <div className="ms-auto inline-flex rounded-md border border-ink-200 overflow-hidden">
        <LayoutTab
          active={layout === "feed"}
          onClick={() => onLayoutChange("feed")}
          icon={<Rows3 className="w-3 h-3" />}
          label="פיד"
        />
        <LayoutTab
          active={layout === "lists"}
          onClick={() => onLayoutChange("lists")}
          icon={<Columns3 className="w-3 h-3" />}
          label="רשימות"
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

function ViewOption({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start hover:bg-ink-50",
        active ? "text-ink-900 font-medium" : "text-ink-700"
      )}
      type="button"
    >
      <span
        className={cn(
          "w-2 h-2 rounded-full shrink-0",
          active ? "bg-primary-500" : "bg-transparent border border-ink-300"
        )}
      />
      {children}
    </button>
  );
}
