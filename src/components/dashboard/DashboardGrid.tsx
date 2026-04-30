import {
  useMemo,
  useRef,
  type ReactNode,
  type ComponentType,
} from "react";
import { Responsive, WidthProvider, type Layout, type Layouts } from "react-grid-layout";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useDashboardLayout, useDebouncedLayoutSave } from "@/lib/hooks/useDashboardLayout";
import type {
  DashboardScreen,
  WidgetLayout,
  WidgetState,
} from "@/lib/types/domain";

const ResponsiveGridLayout = WidthProvider(Responsive);

// Layouts are always locked — drag/resize/hide of banners caused regressions
// per user feedback. Saved positions still load from the DB so every user
// keeps the layout the migrations seed for them, but interactive editing of
// banner positions has been removed everywhere.

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

/**
 * react-grid-layout positions items via `position: absolute` + pixel
 * `transform: translate(x, ...)`. With direction:rtl that math anchors items
 * on the wrong edge and they fall off-screen, so we force the grid container
 * to direction:ltr (see index.css).
 *
 * The cost: the grid renders LTR, so a widget at x=0 lands on the visual
 * LEFT — but the page is Hebrew RTL, where users expect the FIRST item (the
 * "x=0" item) to be on the visual RIGHT.
 *
 * Fix: store widget positions in the *intent* frame (x=0 = visual right) and
 * mirror to the *visual* frame (x=0 = visual left) only when handing off to
 * react-grid-layout. The user's saved layout, the widget defaults, and the
 * onLayoutChange callbacks all stay in the intent frame — the visual flip
 * is purely a render concern. Flipping is its own inverse.
 */
function flipX(
  layout: Layout[],
  cols: number
): Layout[] {
  return layout.map((l) => ({ ...l, x: Math.max(0, cols - l.x - l.w) }));
}

function flipLayouts(layouts: Layouts): Layouts {
  return {
    lg: flipX(layouts.lg ?? [], COLS.lg),
    md: flipX(layouts.md ?? [], COLS.md),
    sm: flipX(layouts.sm ?? [], COLS.sm),
  };
}

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
    const filtered: Layouts = {
      lg: layouts.lg.filter((l) => visibleKeys.has(l.i)),
      md: layouts.md.filter((l) => visibleKeys.has(l.i)),
      sm: layouts.sm.filter((l) => visibleKeys.has(l.i)),
    };
    // Mirror to visual frame for react-grid-layout (x=0 → visual LEFT).
    // We keep the intent frame (x=0 → visual RIGHT for RTL users) for
    // storage and widget defaults.
    return flipLayouts(filtered);
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
    // react-grid-layout reports positions in the visual frame; un-flip
    // back to the intent frame (x=0 = visual right) before persisting.
    const persisted = flipLayouts(all);
    scheduleSave({
      layout_desktop: persisted.lg as unknown as WidgetLayout,
      layout_tablet: persisted.md as unknown as WidgetLayout,
      layout_mobile: persisted.sm as unknown as WidgetLayout,
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

  return (
    <div className={cn("relative grid-locked", className)}>
      <ResponsiveGridLayout
        className="layout"
        layouts={filteredLayouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        margin={MARGIN}
        containerPadding={CONTAINER_PADDING}
        compactType="vertical"
        isDraggable={false}
        isResizable={false}
        onLayoutChange={handleLayoutChange}
      >
        {visibleWidgets.map((w) => {
          const Component = w.component;
          const collapsed = widgetState[w.key]?.collapsed ?? false;
          const Chrome = w.chromeStyle === "bare" ? BareChrome : WidgetChrome;
          return (
            // The grid container forces direction:ltr so RGL's pixel math
            // works in RTL pages — but that propagates to the widget content
            // unless we explicitly pin RTL again here. Setting `dir="rtl"`
            // on the per-item wrapper is the simplest, highest-specificity
            // fix (HTML attribute beats any inherited / CSS direction).
            <div key={w.key} dir="rtl">
              <Chrome
                title={w.title}
                collapsed={collapsed}
                onToggleCollapse={() => toggleCollapsed(w.key)}
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
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  children: ReactNode;
}) {
  return (
    <div className="card h-full flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-ink-200 bg-ink-50/50 select-none">
        <h3 className="font-semibold text-sm text-ink-900 truncate min-w-0">{title}</h3>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1 rounded hover:bg-ink-200 text-ink-600 shrink-0"
          title={collapsed ? "פתח" : "כווץ"}
          aria-label={collapsed ? "פתח" : "כווץ"}
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </header>
      {!collapsed && (
        <div className="flex-1 overflow-auto p-4">{children}</div>
      )}
    </div>
  );
}

/**
 * Minimal chrome: renders the widget body unmodified, no drag handle, no
 * collapse/hide overlay. Edit-mode controls were removed app-wide per user
 * feedback — banner positions are now fully locked.
 */
function BareChrome({
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  children: ReactNode;
}) {
  return <div className="h-full">{children}</div>;
}
