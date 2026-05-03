import { useRef, useState } from "react";
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
  Columns2,
  Rows2,
  FolderKanban,
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
  /** Project this list belongs to (if any). Used by the Source picker
   *  to group lists under their parent project. */
  project_id?: string | null;
}

interface UnifiedProject {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
}

/** What the Gantt is "scoped to". Single selection — not multi-toggle —
 *  because working on multiple lists/projects at once on a Gantt is rarely
 *  what the user actually wants and tends to produce confusing schedules. */
export type GanttSource =
  | { kind: "all" }
  | { kind: "list"; id: string }
  | { kind: "project"; id: string };

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

  // Projects (for the Source picker — Gantt scope)
  projects: UnifiedProject[];
  source: GanttSource;
  onSourceChange: (s: GanttSource) => void;
  /** Create a new (empty) list and select it as the source. The Gantt
   *  refreshes to show the empty table; the user adds tasks from there. */
  onCreateNewList?: () => void;
  /** Same for a new project. The project will get its own initial task
   *  list created behind the scenes; new tasks land in that list. */
  onCreateNewProject?: () => void;
  /** Convert the currently-selected list into a project (creates a new
   *  project + sets list.project_id). Only meaningful when
   *  source.kind === "list". */
  onConvertListToProject?: () => void;

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

  // Table-vs-Gantt layout. "side" = table 1/3 right + Gantt 2/3 left.
  // "stacked" = table full width on top, Gantt full width below.
  tableLayout: "side" | "stacked";
  onTableLayoutChange: (l: "side" | "stacked") => void;

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
  projects,
  source,
  onSourceChange,
  onCreateNewList,
  onCreateNewProject,
  onConvertListToProject,
  filtersActiveCount,
  filtersOpen,
  onToggleFilters,
  showCriticalOnly,
  onToggleCriticalOnly,
  sidebarCollapsed,
  onToggleSidebar,
  tableLayout,
  onTableLayoutChange,
  className,
}: GanttChromeProps) {
  const step = (n: 1 | -1) => {
    const days = zoom === "day" ? 7 : zoom === "week" ? 28 : zoom === "month" ? 90 : 180;
    onAnchorChange(addDays(anchor, n * days));
  };

  const visibleListCount = lists.length - hiddenListIds.size;

  const sourceLabel =
    source.kind === "all"
      ? "כל המשימות"
      : source.kind === "list"
      ? lists.find((l) => l.id === source.id)?.name ?? "רשימה"
      : projects.find((p) => p.id === source.id)?.name ?? "פרויקט";

  return (
    <div
      className={cn(
        "card overflow-visible px-2 py-1.5 flex items-center gap-1.5 flex-wrap",
        className
      )}
    >
      {/* Source picker — pinned to the leading edge of the chrome so it's
          the first thing the user picks. Single selection: "all" / one list
          / one project. Outline-style button with the FolderKanban icon and
          the active label inline so it reads as a "scope" indicator and
          doesn't get lost among the toggles. */}
      <SourcePicker
        source={source}
        sourceLabel={sourceLabel}
        lists={lists}
        projects={projects}
        onSourceChange={onSourceChange}
        onCreateNewList={onCreateNewList}
        onCreateNewProject={onCreateNewProject}
        onConvertListToProject={onConvertListToProject}
      />

      {/* Date nav. The "היום" button snaps to today; the dated label
          opens a native date input so the user can jump to any anchor
          (e.g. "show me Q3" without paginating week-by-week). */}
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
          title="חזרה להיום"
        >
          היום
        </button>
        <AnchorDatePicker anchor={anchor} onChange={onAnchorChange} />
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

        {/* Table-vs-Gantt layout toggle. Two icons: side (Columns2) puts the
            table next to the Gantt at 1/3 width; stacked (Rows2) gives both
            full width with the table on top. Persisted in localStorage by
            Gantt.tsx so the user's choice sticks across sessions. */}
        <div className="inline-flex rounded-md border border-ink-200 p-0.5 bg-ink-50">
          <button
            onClick={() => onTableLayoutChange("side")}
            className={cn(
              "p-1 rounded-sm transition-colors",
              tableLayout === "side"
                ? "bg-white text-ink-900 shadow-soft"
                : "text-ink-600 hover:text-ink-900"
            )}
            title="טבלה לצד הגאנט"
            aria-label="טבלה לצד הגאנט"
            type="button"
          >
            <Columns2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onTableLayoutChange("stacked")}
            className={cn(
              "p-1 rounded-sm transition-colors",
              tableLayout === "stacked"
                ? "bg-white text-ink-900 shadow-soft"
                : "text-ink-600 hover:text-ink-900"
            )}
            title="טבלה מעל הגאנט"
            aria-label="טבלה מעל הגאנט"
            type="button"
          >
            <Rows2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}


/**
 * SourcePicker — single-selection chooser for Gantt scope.
 * Renders as a prominent outlined pill at the leading edge of the chrome
 * with the active source name visible at all times. Opens a dropdown with
 * three groups: "all", lists (radio), projects (radio).
 */
function SourcePicker({
  source,
  sourceLabel,
  lists,
  projects,
  onSourceChange,
  onCreateNewList,
  onCreateNewProject,
  onConvertListToProject,
}: {
  source: GanttSource;
  sourceLabel: string;
  lists: UnifiedList[];
  projects: UnifiedProject[];
  onSourceChange: (s: GanttSource) => void;
  onCreateNewList?: () => void;
  onCreateNewProject?: () => void;
  onConvertListToProject?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
          source.kind === "all"
            ? "border-ink-300 bg-white text-ink-700 hover:bg-ink-50"
            : "border-primary-300 bg-primary-50 text-primary-700 hover:bg-primary-100"
        )}
        title="היקף הגאנט"
      >
        <FolderKanban className="w-3.5 h-3.5" />
        <span className="max-w-[160px] truncate">{sourceLabel}</span>
        <ChevronLeft className={cn("w-3 h-3 transition-transform", open && "-rotate-90")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full start-0 mt-1 z-40 w-64 bg-white border border-ink-200 rounded-xl shadow-lift py-1 max-h-80 overflow-y-auto">
            <button
              onClick={() => {
                onSourceChange({ kind: "all" });
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start hover:bg-ink-50",
                source.kind === "all" && "bg-primary-50 text-primary-700 font-medium"
              )}
              type="button"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="flex-1">כל המשימות</span>
              {source.kind === "all" && <Check className="w-3.5 h-3.5" />}
            </button>

            {lists.length > 0 && (
              <>
                <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-3 py-1 mt-1 border-t border-ink-100">
                  רשימות
                </div>
                {lists.map((l) => {
                  const selected = source.kind === "list" && source.id === l.id;
                  return (
                    <button
                      key={l.id}
                      onClick={() => {
                        onSourceChange({ kind: "list", id: l.id });
                        setOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start hover:bg-ink-50",
                        selected && "bg-primary-50 text-primary-700 font-medium"
                      )}
                      type="button"
                    >
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: l.color ?? "#6b6b80" }}
                      />
                      {l.emoji && <ListIcon emoji={l.emoji} className="w-3.5 h-3.5" />}
                      <span className="truncate flex-1">{l.name}</span>
                      {selected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </>
            )}

            {projects.length > 0 && (
              <>
                <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-3 py-1 mt-1 border-t border-ink-100">
                  פרויקטים
                </div>
                {projects.map((p) => {
                  const selected = source.kind === "project" && source.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSourceChange({ kind: "project", id: p.id });
                        setOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start hover:bg-ink-50",
                        selected && "bg-primary-50 text-primary-700 font-medium"
                      )}
                      type="button"
                    >
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: p.color ?? "#6b6b80" }}
                      />
                      {p.emoji && <span className="text-sm">{p.emoji}</span>}
                      <span className="truncate flex-1">{p.name}</span>
                      {selected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </>
            )}

            {lists.length === 0 && projects.length === 0 && (
              <div className="px-3 py-3 text-xs text-ink-500 text-center">
                עדיין אין רשימות או פרויקטים.
              </div>
            )}

            {/* Create-new actions — sit at the bottom of the dropdown so the
                primary "switch context" affordance is on top, and the rarer
                "scaffold a new container" lives below. */}
            {(onCreateNewList || onCreateNewProject || onConvertListToProject) && (
              <div className="border-t border-ink-100 mt-1 pt-1">
                {onCreateNewList && (
                  <button
                    type="button"
                    onClick={() => {
                      onCreateNewList();
                      setOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start text-primary-600 hover:bg-ink-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    רשימה חדשה (ריקה)
                  </button>
                )}
                {onCreateNewProject && (
                  <button
                    type="button"
                    onClick={() => {
                      onCreateNewProject();
                      setOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start text-primary-600 hover:bg-ink-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    פרויקט חדש (ריק)
                  </button>
                )}
                {/* Promote the selected list to a project. Only meaningful
                    when a single list is selected; hidden otherwise. */}
                {source.kind === "list" && onConvertListToProject && (
                  <button
                    type="button"
                    onClick={() => {
                      onConvertListToProject();
                      setOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start text-ink-700 hover:bg-ink-50 border-t border-ink-100 mt-1 pt-2"
                  >
                    <FolderKanban className="w-3.5 h-3.5" />
                    הפוך את "{sourceLabel}" לפרויקט
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Anchor date picker — a button that shows the current anchor date in
 * Hebrew locale and opens a native date input on click. Handles the ISO
 * <-> Date conversion locally so the chrome's `onAnchorChange` keeps its
 * `Date` API. The native input avoids pulling in another date-picker lib
 * for what's essentially a "jump to any day" affordance.
 */
function AnchorDatePicker({
  anchor,
  onChange,
}: {
  anchor: Date;
  onChange: (d: Date) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const toIsoDate = (d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const label = anchor.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => {
          // Native pickers — try showPicker() (Chrome/Safari recent), fall
          // back to focus + click to coax the popup open.
          const el = inputRef.current;
          if (!el) return;
          const anyEl = el as HTMLInputElement & { showPicker?: () => void };
          if (typeof anyEl.showPicker === "function") {
            anyEl.showPicker();
          } else {
            el.focus();
            el.click();
          }
        }}
        className="text-xs px-2 py-1 rounded-md border border-ink-200 hover:bg-ink-50 text-ink-700 font-medium tabular-nums"
        title="קפצי לתאריך"
      >
        {label}
      </button>
      <input
        ref={inputRef}
        type="date"
        value={toIsoDate(anchor)}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          const [y, m, d] = v.split("-").map(Number);
          if (!y || !m || !d) return;
          onChange(new Date(y, m - 1, d));
        }}
        // Hide the input itself; we drive it from the visible button so we
        // get our own styling but the browser still owns the calendar UI.
        className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
        tabIndex={-1}
      />
    </div>
  );
}
