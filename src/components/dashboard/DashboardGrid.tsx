import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type ComponentType,
} from "react";
import { Responsive, WidthProvider, type Layout, type Layouts } from "react-grid-layout";
import {
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  GripVertical,
  Lock,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useDashboardLayout, useDebouncedLayoutSave } from "@/lib/hooks/useDashboardLayout";
import type {
  DashboardScreen,
  WidgetLayout,
  WidgetState,
} from "@/lib/types/domain";

const ResponsiveGridLayout = WidthProvider(Responsive);

/**
 * Globally tracks "edit mode" — a single boolean shared across all grids on
 * the page. Default = false (locked, drag/resize disabled, drag handles
 * hidden). Toggling is per-screen so the user can, say, edit the project
 * page layout without touching the dashboard's saved arrangement.
 *
 * Persisted to localStorage so the choice survives reloads.
 */
function useEditMode(screenKey: DashboardScreen) {
  const storageKey = `multitask:editmode:${screenKey}`;
  const [editing, setEditing] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(storageKey) === "1";
  });
  useEffect(() => {
    localStorage.setItem(storageKey, editing ? "1" : "0");
  }, [editing, storageKey]);
  return [editing, setEditing] as const;
}

export interface WidgetDefinition {
  key: string;
  title: string;
  component: ComponentType<{ scopeId?: string | null }>;
  defaultDesktop: { x: number; y: number; w: number; h: number; minW?: number; minH?: number };
  defaultTablet?: { x: number; y: number; w: number; h: number };
  defaultMobile?: { x: number; y: number; w: number; h: number };
  /**
   * `framed` — wrap the widget body in a card with a visible header bar.
   *   Use for fresh blocks designed against this chrome (e.g. project page).
   * `bare`  — render only a small floating drag handle on top; widget keeps
   *   its own styling and outer borders. Use when wrapping existing screens
   *   so the original design is preserved exactly.
   */
  chromeStyle?: "framed" | "bare";
}

interface DashboardGridProps {
  screenKey: DashboardScreen;
  scopeId?: string | null;
  widgets: WidgetDefinition[];
  className?: string;
}

// `lg` raised from 1200 to 1400 so phones in "request desktop site" mode
// (typically reports ~1024-1080px) land in `md` (single-column) instead of
// the cramped 2-column desktop layout.
const BREAKPOINTS = { lg: 1400, md: 768, sm: 0 };
const COLS = { lg: 12, md: 8, sm: 4 };
const ROW_HEIGHT = 80;
const MARGIN: [number, number] = [16, 16];
// ScreenScaffold already applies p-4/sm:p-5/md:p-6 around the grid; keep the
// grid's own container padding at zero so widgets reach the screen edges
// on mobile (only the outer padding constrains them).
const CONTAINER_PADDING: [number, number] = [0, 0];

function defaultLayouts(widgets: WidgetDefinition[]): Layouts {
  const lg: Layout[] = [];
  const md: Layout[] = [];
  const sm: Layout[] = [];

  widgets.forEach((w, i) => {
    lg.push({ i: w.key, ...w.defaultDesktop });
    md.push({
      i: w.key,
      ...(w.defaultTablet ?? { x: (i * 4) % 8, y: Infinity, w: 4, h: w.defaultDesktop.h }),
    });
    sm.push({
      i: w.key,
      ...(w.defaultMobile ?? { x: 0, y: i, w: 4, h: w.defaultDesktop.h }),
    });
  });

  return { lg, md, sm };
}

export function DashboardGrid({
  screenKey,
  scopeId = null,
  widgets,
  className,
}: DashboardGridProps) {
  const { data: savedLayout } = useDashboardLayout(screenKey, scopeId);
  const { scheduleSave } = useDebouncedLayoutSave(screenKey, scopeId);
  const [isEditing, setIsEditing] = useEditMode(screenKey);

  const fallback = useMemo(() => defaultLayouts(widgets), [widgets]);

  const layouts = useMemo<Layouts>(() => {
    if (!savedLayout) return fallback;
    const saved = {
      lg: (savedLayout.layout_desktop as unknown as Layout[]) ?? [],
      md: (savedLayout.layout_tablet as unknown as Layout[]) ?? [],
      sm: (savedLayout.layout_mobile as unknown as Layout[]) ?? [],
    };
    // For any widget not present in the saved layout, fall back to its default.
    const merge = (savedArr: Layout[], defaultArr: Layout[]): Layout[] => {
      const present = new Set(savedArr.map((l) => l.i));
      return [...savedArr, ...defaultArr.filter((l) => !present.has(l.i))];
    };
    return {
      lg: merge(saved.lg, fallback.lg),
      md: merge(saved.md, fallback.md),
      sm: merge(saved.sm, fallback.sm),
    };
  }, [savedLayout, fallback]);

  const widgetState = useMemo<WidgetState>(
    () => ((savedLayout?.widget_state as unknown as WidgetState) ?? {}),
    [savedLayout]
  );

  // Visible = not explicitly hidden
  const visibleWidgets = widgets.filter((w) => !widgetState[w.key]?.hidden);

  const filteredLayouts = useMemo<Layouts>(() => {
    const visibleKeys = new Set(visibleWidgets.map((w) => w.key));
    return {
      lg: layouts.lg.filter((l) => visibleKeys.has(l.i)),
      md: layouts.md.filter((l) => visibleKeys.has(l.i)),
      sm: layouts.sm.filter((l) => visibleKeys.has(l.i)),
    };
  }, [layouts, visibleWidgets]);

  // react-grid-layout fires onLayoutChange immediately on mount with the
  // initial defaults. We skip the very first call so opening the page never
  // freezes the current defaults into the DB — a real user drag is what
  // should persist, not a synthetic "page just loaded" event.
  const isFirstLayoutChange = useRef(true);

  const handleLayoutChange = (_current: Layout[], all: Layouts) => {
    if (isFirstLayoutChange.current) {
      isFirstLayoutChange.current = false;
      return;
    }
    scheduleSave({
      layout_desktop: all.lg as unknown as WidgetLayout,
      layout_tablet: all.md as unknown as WidgetLayout,
      layout_mobile: all.sm as unknown as WidgetLayout,
      widget_state: widgetState,
    });
  };

  const toggleCollapsed = (key: string) => {
    const next: WidgetState = {
      ...widgetState,
      [key]: { ...widgetState[key], collapsed: !widgetState[key]?.collapsed },
    };
    scheduleSave({
      layout_desktop: layouts.lg as unknown as WidgetLayout,
      layout_tablet: layouts.md as unknown as WidgetLayout,
      layout_mobile: layouts.sm as unknown as WidgetLayout,
      widget_state: next,
    });
  };

  const hideWidget = (key: string) => {
    const next: WidgetState = {
      ...widgetState,
      [key]: { ...widgetState[key], hidden: true },
    };
    scheduleSave({
      layout_desktop: layouts.lg as unknown as WidgetLayout,
      layout_tablet: layouts.md as unknown as WidgetLayout,
      layout_mobile: layouts.sm as unknown as WidgetLayout,
      widget_state: next,
    });
  };

  const showWidget = (key: string) => {
    const next: WidgetState = {
      ...widgetState,
      [key]: { ...widgetState[key], hidden: false },
    };
    scheduleSave({
      layout_desktop: layouts.lg as unknown as WidgetLayout,
      layout_tablet: layouts.md as unknown as WidgetLayout,
      layout_mobile: layouts.sm as unknown as WidgetLayout,
      widget_state: next,
    });
  };

  const hiddenWidgets = widgets.filter((w) => widgetState[w.key]?.hidden);

  return (
    <div
      className={cn(
        "relative",
        // Class hook for the global CSS rule that hides drag handles when
        // not editing — keeps every chrome variant consistent without
        // threading isEditing into each chrome component.
        isEditing ? "grid-editing" : "grid-locked",
        className
      )}
    >
      <EditModeToggle
        editing={isEditing}
        onToggle={() => setIsEditing((v) => !v)}
        hasHiddenWidgets={hiddenWidgets.length > 0}
        hiddenWidgets={hiddenWidgets}
        onShow={showWidget}
      />
      <ResponsiveGridLayout
        className="layout"
        layouts={filteredLayouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        margin={MARGIN}
        containerPadding={CONTAINER_PADDING}
        draggableHandle=".widget-drag-handle"
        compactType="vertical"
        isDraggable={isEditing}
        isResizable={isEditing}
        onLayoutChange={handleLayoutChange}
      >
        {visibleWidgets.map((w) => {
          const Component = w.component;
          const collapsed = widgetState[w.key]?.collapsed ?? false;
          const Chrome = w.chromeStyle === "bare" ? BareChrome : WidgetChrome;
          return (
            <div key={w.key}>
              <Chrome
                title={w.title}
                collapsed={collapsed}
                onToggleCollapse={() => toggleCollapsed(w.key)}
                onHide={() => hideWidget(w.key)}
              >
                {!collapsed && <Component scopeId={scopeId} />}
              </Chrome>
            </div>
          );
        })}
      </ResponsiveGridLayout>
    </div>
  );
}

function WidgetChrome({
  title,
  collapsed,
  onToggleCollapse,
  onHide,
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onHide: () => void;
  children: ReactNode;
}) {
  return (
    <div className="card h-full flex flex-col overflow-hidden">
      <header className="widget-drag-handle flex items-center justify-between px-4 py-2.5 border-b border-ink-200 bg-ink-50/50 cursor-move select-none">
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="w-4 h-4 text-ink-400 shrink-0" />
          <h3 className="font-semibold text-sm text-ink-900 truncate">{title}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded hover:bg-ink-200 text-ink-600"
            title={collapsed ? "פתח" : "כווץ"}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            onClick={onHide}
            className="p-1 rounded hover:bg-ink-200 text-ink-600"
            title="הסתר"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>
      {!collapsed && (
        <div className="flex-1 overflow-auto p-4">{children}</div>
      )}
    </div>
  );
}

/**
 * Minimal chrome: renders the widget body unmodified and overlays a small,
 * subtle drag handle in the top-end corner. Lets existing screens preserve
 * their original visual design while still participating in the grid.
 */
function BareChrome({
  title,
  collapsed,
  onToggleCollapse,
  onHide,
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onHide: () => void;
  children: ReactNode;
}) {
  return (
    <div className="relative h-full group/widget">
      <div
        className={cn(
          "absolute top-1.5 end-1.5 z-10 flex items-center gap-0.5",
          "rounded-md bg-white/80 backdrop-blur shadow-soft px-1 py-0.5",
          // On mobile/touch (no hover), keep the handle visible at 50%; on
          // desktop fade it in on hover so it doesn't compete with content.
          "opacity-50 md:opacity-0 md:group-hover/widget:opacity-100",
          "transition-opacity duration-150"
        )}
      >
        <span
          className="widget-drag-handle p-1 cursor-move text-ink-500 hover:text-ink-900"
          title={`גררי: ${title}`}
          aria-label={`גרירת ${title}`}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </span>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 rounded hover:bg-ink-100 text-ink-500 hover:text-ink-900"
          title={collapsed ? "פתח" : "כווץ"}
          aria-label={collapsed ? "פתח" : "כווץ"}
        >
          {collapsed ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={onHide}
          className="p-1 rounded hover:bg-ink-100 text-ink-500 hover:text-ink-900"
          title="הסתר"
          aria-label="הסתר"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {collapsed ? (
        <div className="card h-full flex items-center justify-center text-xs text-ink-400">
          {title} — מכווץ
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/**
 * Single toolbar row above every grid: edit-mode toggle + (when editing) the
 * "show hidden widget" picker. Sits above the grid with negative top so it
 * doesn't push content down — there's already room above DashboardGrid in
 * every page where the ScreenScaffold header sits.
 */
function EditModeToggle({
  editing,
  onToggle,
  hasHiddenWidgets,
  hiddenWidgets,
  onShow,
}: {
  editing: boolean;
  onToggle: () => void;
  hasHiddenWidgets: boolean;
  hiddenWidgets: WidgetDefinition[];
  onShow: (key: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div className="absolute -top-11 end-0 z-10 flex items-center gap-1.5">
      {editing && hasHiddenWidgets && (
        <div className="relative">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className="btn-outline text-xs"
          >
            <Plus className="w-4 h-4" />
            הוסיפי באנר ({hiddenWidgets.length})
          </button>
          {pickerOpen && (
            <div className="absolute end-0 top-full mt-1 bg-white border border-ink-200 rounded-xl shadow-lift w-56 py-1 max-h-64 overflow-auto">
              {hiddenWidgets.map((w) => (
                <button
                  key={w.key}
                  onClick={() => {
                    onShow(w.key);
                    setPickerOpen(false);
                  }}
                  className="w-full text-start px-3 py-2 text-sm hover:bg-ink-50 text-ink-900"
                >
                  {w.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "text-xs flex items-center gap-1",
          editing ? "btn-accent" : "btn-outline"
        )}
        aria-pressed={editing}
        title={
          editing
            ? "סיימי עריכת באנרים — הגרירה תינעל"
            : "ערכי באנרים — הפעלת גרירה"
        }
      >
        {editing ? (
          <>
            <Pencil className="w-4 h-4" />
            במצב עריכה — סגרי
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            ערכי באנרים
          </>
        )}
      </button>
    </div>
  );
}
