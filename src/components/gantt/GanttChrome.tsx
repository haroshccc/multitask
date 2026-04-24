import {
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  List as ListIcon2,
  Plus,
  Eye,
  EyeOff,
  Check,
  Target,
  ZoomIn,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ListIcon } from "@/components/tasks/list-icons";
import { ToggleButton, PopoverButton } from "@/components/layout/ChromeControls";
import { addDays, type GanttZoom } from "./gantt-utils";

interface UnifiedList {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
}

interface GanttChromeProps {
  zoom: GanttZoom;
  onZoomChange: (z: GanttZoom) => void;
  anchor: Date;
  onAnchorChange: (d: Date) => void;

  // Lists
  lists: UnifiedList[];
  hiddenListIds: Set<string>;
  onToggleListVisibility: (listId: string) => void;
  onCreateList: () => void;

  // Filter panel toggle
  filtersActiveCount: number;
  filtersOpen: boolean;
  onToggleFilters: () => void;

  // Critical-path-only filter
  showCriticalOnly: boolean;
  onToggleCriticalOnly: () => void;

  className?: string;
}

const ZOOM_LABELS: Record<GanttZoom, string> = {
  day: "יום",
  week: "שבוע",
  month: "חודש",
  quarter: "רבעון",
};

/**
 * Compact top chrome for the Gantt screen. Mirrors `CalendarChrome` +
 * `TasksChrome`. Uses the shared `ToggleButton` / `PopoverButton` from
 * `layout/ChromeControls`.
 *
 * Controls:
 *   - Date nav (← היום →)
 *   - Zoom level popover (day / week / month / quarter)
 *   - Lists popover
 *   - Filter toggle
 *   - Critical-path-only toggle
 */
export function GanttChrome({
  zoom,
  onZoomChange,
  anchor,
  onAnchorChange,
  lists,
  hiddenListIds,
  onToggleListVisibility,
  onCreateList,
  filtersActiveCount,
  filtersOpen,
  onToggleFilters,
  showCriticalOnly,
  onToggleCriticalOnly,
  className,
}: GanttChromeProps) {
  const step = (n: 1 | -1) => {
    const days = zoom === "day" ? 7 : zoom === "week" ? 28 : zoom === "month" ? 90 : 180;
    onAnchorChange(addDays(anchor, n * days));
  };

  const visibleListCount = lists.length - hiddenListIds.size;

  return (
    <div
      className={cn(
        "card overflow-visible px-2 py-1.5 flex items-center gap-1.5 flex-wrap",
        className
      )}
    >
      {/* Date nav */}
      <div className="inline-flex items-center gap-0.5">
        <button
          onClick={() => step(-1)}
          className="p-1.5 rounded-md hover:bg-ink-100 text-ink-700"
          aria-label="הקודם"
          type="button"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => onAnchorChange(new Date())}
          className="text-xs px-2 py-1 rounded-md hover:bg-ink-100 text-ink-700 font-medium"
          type="button"
        >
          היום
        </button>
        <button
          onClick={() => step(1)}
          className="p-1.5 rounded-md hover:bg-ink-100 text-ink-700"
          aria-label="הבא"
          type="button"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Zoom — inline tabs on md+, popover on mobile would add complexity;
          keeping tabs but icon-style for density. */}
      <div className="inline-flex rounded-md border border-ink-200 p-0.5 bg-ink-50 text-[11px]">
        {(["day", "week", "month", "quarter"] as GanttZoom[]).map((z) => (
          <button
            key={z}
            onClick={() => onZoomChange(z)}
            className={cn(
              "px-2 py-0.5 rounded-sm font-medium transition-colors",
              zoom === z
                ? "bg-white text-ink-900 shadow-soft"
                : "text-ink-600 hover:text-ink-900"
            )}
            type="button"
          >
            {ZOOM_LABELS[z]}
          </button>
        ))}
      </div>

      <div className="ms-auto inline-flex items-center gap-1 flex-wrap">
        {/* Lists popover */}
        <PopoverButton
          icon={<ListIcon2 className="w-3.5 h-3.5" />}
          label={`רשימות (${visibleListCount}/${lists.length})`}
          title="בחירת רשימות בתצוגה"
          badge={hiddenListIds.size > 0 ? `−${hiddenListIds.size}` : undefined}
          wide
        >
          {() => (
            <div className="py-1 max-h-72 overflow-y-auto">
              <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-3 py-1 border-b border-ink-100">
                רשימות פעילות בתצוגה
              </div>
              {lists.length === 0 ? (
                <p className="px-3 py-2 text-xs text-ink-500">
                  עוד אין רשימות.
                </p>
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
          active={filtersOpen}
          onClick={onToggleFilters}
          icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
          label="סינון"
          badge={filtersActiveCount > 0 ? String(filtersActiveCount) : undefined}
        />

        <ToggleButton
          active={showCriticalOnly}
          onClick={onToggleCriticalOnly}
          icon={<Target className="w-3.5 h-3.5" />}
          label="Critical בלבד"
        />

        {/* Keep a little zoom icon label for visual consistency with other
            chromes — no-op click (zoom tabs already live in the chrome). */}
        <span
          className="hidden md:inline-flex items-center gap-1 text-[10px] text-ink-400 px-1"
          title="זום"
        >
          <ZoomIn className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}
