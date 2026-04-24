import {
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  List as ListIcon2,
  Plus,
  Eye,
  EyeOff,
  Check,
  Flame,
  Layers,
  CheckSquare,
  Calendar as CalendarIcon,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ListIcon } from "@/components/tasks/list-icons";
import { ToggleButton, PopoverButton } from "@/components/layout/ChromeControls";
import { addDays, type GanttLayer, type GanttZoom } from "./gantt-utils";

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

  // Layer (tasks / events / both)
  layer: GanttLayer;
  onLayerChange: (l: GanttLayer) => void;

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

  // Sidebar (task-name column) collapse
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;

  className?: string;
}

const ZOOM_LABELS: Record<GanttZoom, string> = {
  day: "יום",
  week: "שבוע",
  month: "חודש",
  quarter: "רבעון",
};

// Day zoom is too dense for a multi-row Gantt — dropped per user feedback.
const AVAILABLE_ZOOMS: GanttZoom[] = ["week", "month", "quarter"];

const LAYER_LABELS: Record<GanttLayer, string> = {
  both: "שניהם",
  tasks: "משימות",
  events: "אירועים",
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
  layer,
  onLayerChange,
  lists,
  hiddenListIds,
  onToggleListVisibility,
  onCreateList,
  filtersActiveCount,
  filtersOpen,
  onToggleFilters,
  showCriticalOnly,
  onToggleCriticalOnly,
  sidebarCollapsed,
  onToggleSidebar,
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

      {/* Zoom tabs — week / month / quarter. Day was dropped (too dense). */}
      <div className="inline-flex rounded-md border border-ink-200 p-0.5 bg-ink-50 text-[11px]">
        {AVAILABLE_ZOOMS.map((z) => (
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
        {/* Layer popover (tasks / events / both) */}
        <PopoverButton
          icon={<Layers className="w-3.5 h-3.5" />}
          label={LAYER_LABELS[layer]}
          title="סוג רשומות"
        >
          {(close) => (
            <div className="py-1">
              {(["both", "tasks", "events"] as GanttLayer[]).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    onLayerChange(m);
                    close();
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start hover:bg-ink-50",
                    layer === m && "bg-primary-50 text-primary-700 font-medium"
                  )}
                  type="button"
                >
                  {m === "both" && <Layers className="w-3.5 h-3.5" />}
                  {m === "tasks" && <CheckSquare className="w-3.5 h-3.5" />}
                  {m === "events" && <CalendarIcon className="w-3.5 h-3.5" />}
                  {LAYER_LABELS[m]}
                  {layer === m && <Check className="w-3.5 h-3.5 ms-auto" />}
                </button>
              ))}
            </div>
          )}
        </PopoverButton>

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
          icon={<Flame className="w-3.5 h-3.5" />}
          label="נתיב קריטי"
          badge={showCriticalOnly ? "on" : undefined}
        />

        <ToggleButton
          active={sidebarCollapsed}
          onClick={onToggleSidebar}
          icon={
            sidebarCollapsed ? (
              <PanelRightOpen className="w-3.5 h-3.5" />
            ) : (
              <PanelRightClose className="w-3.5 h-3.5" />
            )
          }
          label={sidebarCollapsed ? "הצג שמות" : "מזער שמות"}
        />
      </div>
    </div>
  );
}
