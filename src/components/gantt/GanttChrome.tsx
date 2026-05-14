import { useState } from "react";
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
  FileDown,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ListIcon } from "@/components/tasks/list-icons";
import { ToggleButton, PopoverButton } from "@/components/layout/ChromeControls";
import { addDays, startOfDay, type GanttLayer, type GanttZoom } from "./gantt-utils";

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
  /** The visible window — the user picks the exact from/to dates. */
  rangeStart: Date;
  rangeEnd: Date;
  onRangeChange: (start: Date, end: Date) => void;

  /** Continuous zoom multiplier (0.5 .. 2.5) for column density. */
  zoomScale: number;
  onZoomScaleChange: (n: number) => void;

  /** Open the Excel-export modal. */
  onExport: () => void;

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
  /** Create a new (empty) list and select it as the source. */
  onCreateNewList?: () => void;
  /** Create a new project + initial list, and select it. */
  onCreateNewProject?: () => void;
  /** Promote the selected list into a project. */
  onConvertListToProject?: () => void;
  /** Demote the selected project to a list. */
  onConvertProjectToList?: () => void;

  // Filter panel toggle
  filtersActiveCount: number;
  filtersOpen: boolean;
  onToggleFilters: () => void;

  // Critical-path-only filter
  showCriticalOnly: boolean;
  onToggleCriticalOnly: () => void;
  /** Auto-computed critical path on/off. When off, only manually-flagged
   *  (is_critical) tasks are treated as critical. */
  autoCriticalPath: boolean;
  onToggleAutoCriticalPath: () => void;

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

export function GanttChrome({
  zoom,
  onZoomChange,
  rangeStart,
  rangeEnd,
  onRangeChange,
  zoomScale,
  onZoomScaleChange,
  onExport,
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
  onConvertProjectToList,
  filtersActiveCount,
  filtersOpen,
  onToggleFilters,
  showCriticalOnly,
  onToggleCriticalOnly,
  autoCriticalPath,
  onToggleAutoCriticalPath,
  sidebarCollapsed,
  onToggleSidebar,
  tableLayout,
  onTableLayoutChange,
  className,
}: GanttChromeProps) {
  // Prev/next shift the whole window by its own width; "today" re-anchors
  // the window to start a week before today, preserving its width.
  const step = (n: 1 | -1) => {
    const width = rangeEnd.getTime() - rangeStart.getTime();
    onRangeChange(
      new Date(rangeStart.getTime() + n * width),
      new Date(rangeEnd.getTime() + n * width)
    );
  };
  const goToday = () => {
    const width = rangeEnd.getTime() - rangeStart.getTime();
    const start = startOfDay(addDays(new Date(), -7));
    onRangeChange(start, new Date(start.getTime() + width));
  };

  const visibleListCount = lists.length - hiddenListIds.size;

  const sourceLabel =
    source.kind === "all"
      ? "כל המשימות"
      : source.kind === "list"
      ? lists.find((l) => l.id === source.id)?.name ?? "רשימה"
      : projects.find((p) => p.id === source.id)?.name ?? "פרוייקט";

  return (
    <div
      className={cn(
        "card overflow-visible px-2 py-1.5 flex items-center gap-1.5 flex-wrap",
        className
      )}
    >
      <SourcePicker
        source={source}
        sourceLabel={sourceLabel}
        lists={lists}
        projects={projects}
        onSourceChange={onSourceChange}
        onCreateNewList={onCreateNewList}
        onCreateNewProject={onCreateNewProject}
        onConvertListToProject={onConvertListToProject}
        onConvertProjectToList={onConvertProjectToList}
      />

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
          onClick={goToday}
          className="text-xs px-2 py-1 rounded-md hover:bg-ink-100 text-ink-700 font-medium"
          type="button"
          title="הצג מהיום"
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

      {/* Explicit from/to window — the user picks exactly what date span
          the Gantt shows. */}
      <RangePicker start={rangeStart} end={rangeEnd} onChange={onRangeChange} />

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

      {/* Continuous zoom slider — fine-tune column density. */}
      <ZoomSlider value={zoomScale} onChange={onZoomScaleChange} />

      <div className="ms-auto inline-flex items-center gap-1 flex-wrap">
        <ToggleButton
          active={false}
          onClick={onExport}
          icon={<FileDown className="w-3.5 h-3.5" />}
          label="ייצוא Excel"
        />

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
                        style={hidden ? undefined : { backgroundColor: l.color ?? "#6b6b80" }}
                      >
                        {!hidden && <Check className="w-2.5 h-2.5 text-white" />}
                      </span>
                      {l.emoji && <ListIcon emoji={l.emoji} className="w-3.5 h-3.5" />}
                      <span className={cn("truncate flex-1", hidden ? "text-ink-500" : "text-ink-900")}>
                        {l.name}
                      </span>
                      {hidden ? <EyeOff className="w-3 h-3 text-ink-400" /> : <Eye className="w-3 h-3 text-ink-400" />}
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

        <PopoverButton
          icon={<Flame className="w-3.5 h-3.5" />}
          label="נתיב קריטי"
          title="נתיב קריטי"
          badge={showCriticalOnly ? "on" : !autoCriticalPath ? "ידני" : undefined}
        >
          {() => (
            <div className="py-1">
              <button
                type="button"
                onClick={onToggleAutoCriticalPath}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start hover:bg-ink-50"
              >
                <span
                  className={cn(
                    "w-3 h-3 rounded-sm border flex items-center justify-center shrink-0",
                    autoCriticalPath ? "bg-primary-500 border-primary-500" : "border-ink-300 bg-white"
                  )}
                >
                  {autoCriticalPath && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                <span className="flex-1">חישוב אוטומטי</span>
              </button>
              <button
                type="button"
                onClick={onToggleCriticalOnly}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start hover:bg-ink-50"
              >
                <span
                  className={cn(
                    "w-3 h-3 rounded-sm border flex items-center justify-center shrink-0",
                    showCriticalOnly ? "bg-primary-500 border-primary-500" : "border-ink-300 bg-white"
                  )}
                >
                  {showCriticalOnly && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                <span className="flex-1">הצג רק קריטי</span>
              </button>
              <p className="text-[10px] text-ink-400 px-3 py-1.5 border-t border-ink-100 mt-1 leading-relaxed">
                כשחישוב אוטומטי כבוי — רק משימות שסומנו ידנית נחשבות קריטיות.
              </p>
            </div>
          )}
        </PopoverButton>

        <ToggleButton
          active={sidebarCollapsed}
          onClick={onToggleSidebar}
          icon={
            sidebarCollapsed ? <PanelRightOpen className="w-3.5 h-3.5" /> : <PanelRightClose className="w-3.5 h-3.5" />
          }
          label={sidebarCollapsed ? "הצג שמות" : "מזער שמות"}
        />

        <div className="inline-flex rounded-md border border-ink-200 p-0.5 bg-ink-50">
          <button
            onClick={() => onTableLayoutChange("side")}
            className={cn(
              "p-1 rounded-sm transition-colors",
              tableLayout === "side" ? "bg-white text-ink-900 shadow-soft" : "text-ink-600 hover:text-ink-900"
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
              tableLayout === "stacked" ? "bg-white text-ink-900 shadow-soft" : "text-ink-600 hover:text-ink-900"
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

function SourcePicker({
  source,
  sourceLabel,
  lists,
  projects,
  onSourceChange,
  onCreateNewList,
  onCreateNewProject,
  onConvertListToProject,
  onConvertProjectToList,
}: {
  source: GanttSource;
  sourceLabel: string;
  lists: UnifiedList[];
  projects: UnifiedProject[];
  onSourceChange: (s: GanttSource) => void;
  onCreateNewList?: () => void;
  onCreateNewProject?: () => void;
  onConvertListToProject?: () => void;
  onConvertProjectToList?: () => void;
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
              onClick={() => { onSourceChange({ kind: "all" }); setOpen(false); }}
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
                <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-3 py-1 mt-1 border-t border-ink-100">רשימות</div>
                {lists.map((l) => {
                  const selected = source.kind === "list" && source.id === l.id;
                  return (
                    <button
                      key={l.id}
                      onClick={() => { onSourceChange({ kind: "list", id: l.id }); setOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start hover:bg-ink-50",
                        selected && "bg-primary-50 text-primary-700 font-medium"
                      )}
                      type="button"
                    >
                      <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: l.color ?? "#6b6b80" }} />
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
                <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider px-3 py-1 mt-1 border-t border-ink-100">פרוייקטים</div>
                {projects.map((p) => {
                  const selected = source.kind === "project" && source.id === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { onSourceChange({ kind: "project", id: p.id }); setOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start hover:bg-ink-50",
                        selected && "bg-primary-50 text-primary-700 font-medium"
                      )}
                      type="button"
                    >
                      <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: p.color ?? "#6b6b80" }} />
                      {p.emoji && <span className="text-sm">{p.emoji}</span>}
                      <span className="truncate flex-1">{p.name}</span>
                      {selected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </>
            )}

            {lists.length === 0 && projects.length === 0 && (
              <div className="px-3 py-3 text-xs text-ink-500 text-center">עדיין אין רשימות או פרוייקטים.</div>
            )}

            {(onCreateNewList || onCreateNewProject || onConvertListToProject) && (
              <div className="border-t border-ink-100 mt-1 pt-1">
                {onCreateNewList && (
                  <button type="button" onClick={() => { onCreateNewList(); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start text-primary-600 hover:bg-ink-50">
                    <Plus className="w-3.5 h-3.5" />רשימה חדשה (ריקה)
                  </button>
                )}
                {onCreateNewProject && (
                  <button type="button" onClick={() => { onCreateNewProject(); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start text-primary-600 hover:bg-ink-50">
                    <Plus className="w-3.5 h-3.5" />פרוייקט חדש (ריק)
                  </button>
                )}
                {source.kind === "list" && onConvertListToProject && (
                  <button type="button" onClick={() => { onConvertListToProject(); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start text-ink-700 hover:bg-ink-50 border-t border-ink-100 mt-1 pt-2">
                    <FolderKanban className="w-3.5 h-3.5" />הפוך את "{sourceLabel}" לפרוייקט
                  </button>
                )}
                {source.kind === "project" && onConvertProjectToList && (
                  <button type="button" onClick={() => { onConvertProjectToList(); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start text-ink-700 hover:bg-ink-50 border-t border-ink-100 mt-1 pt-2">
                    <ListIcon2 className="w-3.5 h-3.5" />הפוך את "{sourceLabel}" לרשימה
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
 * RangePicker — two native date inputs that drive the Gantt's visible
 * window directly. The user picks exactly which from/to dates to see;
 * `min`/`max` keep the two inputs from crossing over.
 */
function RangePicker({
  start,
  end,
  onChange,
}: {
  start: Date;
  end: Date;
  onChange: (start: Date, end: Date) => void;
}) {
  const toIso = (d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const parse = (v: string): Date | null => {
    if (!v) return null;
    const [y, m, d] = v.split("-").map(Number);
    return y && m && d ? new Date(y, m - 1, d) : null;
  };
  const inputCls =
    "text-[11px] px-1.5 py-1 rounded-md border border-ink-200 hover:bg-ink-50 text-ink-700 font-medium tabular-nums";
  return (
    <div className="inline-flex items-center gap-1" title="טווח התאריכים בתצוגה">
      <span className="text-[10px] text-ink-400">מ־</span>
      <input
        type="date"
        value={toIso(start)}
        max={toIso(end)}
        onChange={(e) => {
          const d = parse(e.target.value);
          if (d) onChange(d, end);
        }}
        className={inputCls}
      />
      <span className="text-[10px] text-ink-400">עד</span>
      <input
        type="date"
        value={toIso(end)}
        min={toIso(start)}
        onChange={(e) => {
          const d = parse(e.target.value);
          if (d) onChange(start, d);
        }}
        className={inputCls}
      />
    </div>
  );
}

/**
 * ZoomSlider — continuous column-density control. Range 0.5..2.5.
 */
function ZoomSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const MIN = 0.5;
  const MAX = 2.5;
  const STEP = 0.1;
  return (
    <div className="inline-flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(MIN, +(value - 0.25).toFixed(2)))}
        className="p-1 rounded-md hover:bg-ink-100 text-ink-600"
        title="הקטן עמודות"
        aria-label="הקטן עמודות"
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>
      <input
        type="range"
        min={MIN}
        max={MAX}
        step={STEP}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 accent-primary-500"
        title={`זום ${Math.round(value * 100)}%`}
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(MAX, +(value + 0.25).toFixed(2)))}
        className="p-1 rounded-md hover:bg-ink-100 text-ink-600"
        title="הגדל עמודות"
        aria-label="הגדל עמודות"
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
