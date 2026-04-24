import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  SlidersHorizontal,
  BarChart3,
  Layers,
  Plus,
  Eye,
  EyeOff,
  Check,
  CheckSquare,
  Calendar as CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ListIcon } from "@/components/tasks/list-icons";
import {
  addDays,
  addMonths,
  formatDayLong,
  formatMonthYear,
  formatWeekRange,
} from "./calendar-utils";
import type { CalendarView } from "./CalendarToolbar";
import type { LayerMode } from "./calendar-utils";
import { HourRangeSettings } from "./HourRangeSettings";

interface UnifiedList {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
}

interface CalendarChromeProps {
  view: CalendarView;
  onViewChange: (v: CalendarView) => void;
  anchor: Date;
  onAnchorChange: (d: Date) => void;
  availableViews: CalendarView[];

  // Layer (tasks/events/both)
  layer: LayerMode;
  onLayerChange: (l: LayerMode) => void;

  // Lists
  lists: UnifiedList[];
  hiddenListIds: Set<string>;
  onToggleListVisibility: (listId: string) => void;
  onCreateList: () => void;

  // Filter / stats panel toggles
  filtersActiveCount: number;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  statsOpen: boolean;
  onToggleStats: () => void;

  // Create actions
  onCreateEvent: () => void;
  onCreateTask: () => void;
}

/**
 * Single compact top banner for the Calendar screen.
 *
 * Houses ALL controls so the calendar grid gets maximum vertical space:
 *   - View toggle (day/week/month/agenda)
 *   - Date nav (← today →) with the date label
 *   - Layer toggle (tasks/events/both) as a popover
 *   - Lists picker as a popover (hidden lists are right there too)
 *   - Filter toggle button — opens a panel BELOW the chrome
 *   - Stats toggle button — opens a panel BELOW the chrome
 *   - "+" buttons for new event / new task
 *
 * Filter & stats panels are rendered by the parent based on the open flags.
 * Everything else opens as an attached popover; nothing is permanently
 * expanded by default.
 *
 * Mobile: icon-only buttons; date label drops to a second row.
 * Desktop (md+): icons + labels.
 */
export function CalendarChrome(props: CalendarChromeProps) {
  const {
    view,
    onViewChange,
    anchor,
    onAnchorChange,
    availableViews,
    layer,
    onLayerChange,
    lists,
    hiddenListIds,
    onToggleListVisibility,
    onCreateList,
    filtersActiveCount,
    filtersOpen,
    onToggleFilters,
    statsOpen,
    onToggleStats,
    onCreateEvent,
    onCreateTask,
  } = props;

  const step = (n: 1 | -1) => {
    if (view === "day") onAnchorChange(addDays(anchor, n));
    else if (view === "week" || view === "agenda")
      onAnchorChange(addDays(anchor, n * 7));
    else onAnchorChange(addMonths(anchor, n));
  };

  const dateLabel =
    view === "day"
      ? formatDayLong(anchor)
      : view === "week" || view === "agenda"
      ? formatWeekRange(anchor)
      : formatMonthYear(anchor);

  const visibleListCount = lists.length - hiddenListIds.size;

  return (
    <div className="card overflow-visible">
      {/* Row 1: nav + view + create buttons */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 flex-wrap">
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

        {/* View toggle */}
        <div className="inline-flex rounded-md border border-ink-200 p-0.5 bg-ink-50 text-[11px]">
          {availableViews.map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={cn(
                "px-2 py-0.5 rounded-sm font-medium transition-colors",
                view === v
                  ? "bg-white text-ink-900 shadow-soft"
                  : "text-ink-600 hover:text-ink-900"
              )}
              type="button"
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        {/* Date label — visible on desktop, drops below on mobile */}
        <span className="hidden md:inline-block text-sm font-semibold text-ink-900 truncate flex-1 min-w-0 px-1">
          {dateLabel}
        </span>

        <div className="ms-auto inline-flex items-center gap-1 flex-wrap">
          {/* Layer toggle popover */}
          <PopoverButton
            icon={<Layers className="w-3.5 h-3.5" />}
            label={LAYER_LABELS[layer]}
            title="סוג רשומות"
          >
            {(close) => (
              <div className="py-1">
                {(["both", "tasks", "events"] as LayerMode[]).map((m) => (
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
            icon={<EyeOff className="w-3.5 h-3.5" />}
            label={`רשימות (${visibleListCount}/${lists.length})`}
            title="בחירת רשימות"
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

          {/* Filter toggle */}
          <ToggleButton
            active={filtersOpen}
            onClick={onToggleFilters}
            icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
            label="סינון"
            badge={filtersActiveCount > 0 ? String(filtersActiveCount) : undefined}
          />

          {/* Stats toggle */}
          <ToggleButton
            active={statsOpen}
            onClick={onToggleStats}
            icon={<BarChart3 className="w-3.5 h-3.5" />}
            label="סטטיסטיקות"
          />

          {/* Hour range — only meaningful for day/week */}
          {(view === "day" || view === "week") && <HourRangeSettings />}

          {/* Create buttons */}
          <button
            onClick={onCreateTask}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium bg-white border-[1.5px] border-ink-500 text-ink-700 hover:bg-ink-50"
            type="button"
            title="משימה חדשה"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">משימה</span>
          </button>
          <button
            onClick={onCreateEvent}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium bg-primary-500 text-white hover:bg-primary-600 shadow-accent"
            type="button"
            title="אירוע חדש"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">אירוע</span>
          </button>
        </div>
      </div>

      {/* Row 2 (mobile only): date label */}
      <div className="md:hidden border-t border-ink-150 px-3 py-1.5 text-xs font-semibold text-ink-900 truncate">
        {dateLabel}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Building blocks

function ToggleButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium border transition-colors",
        active
          ? "bg-ink-900 border-ink-900 text-white"
          : "bg-white border-ink-200 text-ink-700 hover:bg-ink-50"
      )}
      type="button"
      title={label}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
      {badge && (
        <span
          className={cn(
            "inline-flex items-center justify-center min-w-[16px] h-[16px] rounded-full text-[9px] font-semibold px-1",
            active ? "bg-white text-ink-900" : "bg-primary-500 text-white"
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function PopoverButton({
  icon,
  label,
  title,
  badge,
  wide,
  children,
}: {
  icon: ReactNode;
  label: string;
  title?: string;
  badge?: string;
  wide?: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium border transition-colors",
          open
            ? "bg-ink-100 border-ink-300 text-ink-900"
            : "bg-white border-ink-200 text-ink-700 hover:bg-ink-50"
        )}
        type="button"
        title={title}
      >
        {icon}
        <span className="hidden md:inline">{label}</span>
        {badge && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] rounded-full text-[9px] font-semibold px-1 bg-primary-500 text-white">
            {badge}
          </span>
        )}
        <ChevronDown
          className={cn("w-3 h-3 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div
          className={cn(
            // start-0 in RTL = right:0 → popover's right (start) edge anchors
            // to the trigger's right edge and the popover grows leftward
            // (toward end), keeping it on-screen even when the trigger sits
            // near the visual-right side of the chrome.
            "absolute top-full start-0 mt-1 z-30 bg-white border border-ink-200 rounded-lg shadow-lift max-w-[calc(100vw-1rem)]",
            wide ? "min-w-[260px]" : "min-w-[180px]"
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

const VIEW_LABELS: Record<CalendarView, string> = {
  day: "יום",
  week: "שבוע",
  month: "חודש",
  agenda: "אג׳נדה",
};

const LAYER_LABELS: Record<LayerMode, string> = {
  both: "שניהם",
  tasks: "משימות",
  events: "אירועים",
};
