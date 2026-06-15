import { useState } from "react";
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
import { ToggleButton, PopoverButton } from "@/components/layout/ChromeControls";
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
import { useCalendarPrefs } from "@/lib/hooks/useCalendarPrefs";

interface UnifiedList {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
}

/** Optional grouping for the lists picker. Each section gets an optional
 *  header; when `listSections` is supplied the picker renders these instead of
 *  the flat `lists` array (used by the project calendar to separate the
 *  project / other projects / personal / shared). */
export interface ListSection {
  key: string;
  label: string | null;
  lists: UnifiedList[];
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
  /** Optional grouped sections — when set, the picker renders these (with
   *  headers) instead of the flat `lists`. `lists` is still used for the
   *  visible-count label. */
  listSections?: ListSection[];
  hiddenListIds: Set<string>;
  onToggleListVisibility: (listId: string) => void;
  /** Optional — when omitted, the "new list" action is hidden (e.g. inside a
   *  project calendar, where lists aren't created from the picker). */
  onCreateList?: () => void;

  // Event calendars (sit next to lists in the same popover; visibility
  // shares the `hiddenListIds` set since UUIDs don't collide).
  eventCalendars?: UnifiedList[];
  onToggleCalendarVisibility?: (calendarId: string) => void;
  onCreateCalendar?: () => void;
  onEditCalendar?: (calendarId: string) => void;

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
    listSections,
    hiddenListIds,
    onToggleListVisibility,
    onCreateList,
    eventCalendars = [],
    onToggleCalendarVisibility,
    onCreateCalendar,
    onEditCalendar,
    filtersActiveCount,
    filtersOpen,
    onToggleFilters,
    statsOpen,
    onToggleStats,
    onCreateEvent,
    onCreateTask,
  } = props;

  // Mobile only: secondary controls (layer / lists / filter / stats / create)
  // are collapsed behind one button so the grid gets the screen. Desktop keeps
  // everything inline as before.
  const [expanded, setExpanded] = useState(false);

  const step = (n: 1 | -1) => {
    if (view === "day") onAnchorChange(addDays(anchor, n));
    else if (view === "week" || view === "agenda")
      onAnchorChange(addDays(anchor, n * 7));
    else onAnchorChange(addMonths(anchor, n));
  };

  const { prefs } = useCalendarPrefs();
  const tz = prefs.timezone;
  const dateLabel =
    view === "day"
      ? formatDayLong(anchor, tz)
      : view === "week" || view === "agenda"
      ? formatWeekRange(anchor, tz)
      : formatMonthYear(anchor, tz);

  // Count only lists that aren't hidden. `hiddenListIds` can also hold event
  // calendar ids (they share the set), so subtracting its raw size would
  // undercount — go negative once calendars are hidden.
  const visibleListCount = lists.filter((l) => !hiddenListIds.has(l.id)).length;

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

        {/* Mobile-only: one button collapses all secondary controls below. */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          title="אפשרויות"
          className="md:hidden ms-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-ink-700 hover:bg-ink-100 relative"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {(filtersActiveCount > 0 || hiddenListIds.size > 0) && (
            <span className="absolute -top-0.5 -end-0.5 w-2 h-2 rounded-full bg-primary-500" />
          )}
          <ChevronDown
            className={cn("w-3.5 h-3.5 transition-transform", expanded && "rotate-180")}
          />
        </button>

        <div
          className={cn(
            "items-center gap-1 flex-wrap md:ms-auto",
            expanded ? "flex w-full md:w-auto" : "hidden md:flex"
          )}
        >
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
            {() => {
              const renderRow = (l: UnifiedList) => {
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
              };
              return (
              <div className="py-1 max-h-[70vh] overflow-y-auto">
                {listSections ? (
                  listSections.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-ink-500">
                      עוד אין רשימות.
                    </p>
                  ) : (
                    listSections.map((sec) => (
                      <div
                        key={sec.key}
                        className="border-b border-ink-100 last:border-b-0 pb-1 mb-1"
                      >
                        {sec.label && (
                          <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-3 py-1">
                            {sec.label}
                          </div>
                        )}
                        {sec.lists.map(renderRow)}
                      </div>
                    ))
                  )
                ) : (
                  <>
                    <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-3 py-1 border-b border-ink-100">
                      רשימות פעילות בתצוגה
                    </div>
                    {lists.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-ink-500">
                        עוד אין רשימות.
                      </p>
                    ) : (
                      lists.map(renderRow)
                    )}
                  </>
                )}
                {onCreateList && (
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
                )}

                {/* Event calendars — separate concept from task lists, but
                    share the same hidden-IDs set on the calendar screen. */}
                <div className="border-t border-ink-100 mt-1 pt-1">
                  <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-3 py-1">
                    יומני אירועים
                  </div>
                  {eventCalendars.length === 0 ? (
                    <p className="px-3 py-1.5 text-xs text-ink-500">
                      עוד אין יומנים. צרי אחד למטה.
                    </p>
                  ) : (
                    eventCalendars.map((c) => {
                      const hidden = hiddenListIds.has(c.id);
                      return (
                        <div
                          key={c.id}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-ink-50"
                        >
                          <button
                            onClick={() => onToggleCalendarVisibility?.(c.id)}
                            className="flex items-center gap-2 flex-1 min-w-0 text-start"
                            type="button"
                          >
                            <span
                              className={cn(
                                "w-3 h-3 rounded-sm border flex items-center justify-center shrink-0",
                                hidden
                                  ? "border-ink-300 bg-white"
                                  : "border-transparent"
                              )}
                              style={
                                hidden
                                  ? undefined
                                  : { backgroundColor: c.color ?? "#f59e0b" }
                              }
                            >
                              {!hidden && (
                                <Check className="w-2.5 h-2.5 text-white" />
                              )}
                            </span>
                            {c.emoji && (
                              <ListIcon
                                emoji={c.emoji}
                                className="w-3.5 h-3.5"
                              />
                            )}
                            <span
                              className={cn(
                                "truncate flex-1",
                                hidden ? "text-ink-500" : "text-ink-900"
                              )}
                            >
                              {c.name}
                            </span>
                          </button>
                          {onEditCalendar && (
                            <button
                              onClick={() => onEditCalendar(c.id)}
                              className="text-ink-400 hover:text-ink-700 text-[10px] underline"
                              type="button"
                            >
                              עריכה
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                  {onCreateCalendar && (
                    <button
                      onClick={onCreateCalendar}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start text-primary-600 hover:bg-ink-50"
                      type="button"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      יומן אירועים חדש
                    </button>
                  )}
                </div>
              </div>
              );
            }}
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
