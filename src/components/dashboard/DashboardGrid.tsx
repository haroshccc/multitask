import {
  useMemo,
  useState,
  type ReactNode,
  type ComponentType,
} from "react";
import { Responsive, WidthProvider, type Layout, type Layouts } from "react-grid-layout";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { DashboardScreen } from "@/lib/types/domain";

const ResponsiveGridLayout = WidthProvider(Responsive);

// Layouts are fully locked and driven by the per-widget defaults defined in
// each screen's WidgetDefinition[]. We deliberately ignore any saved
// `user_dashboard_layouts` rows: there's no UI to edit the layout, no
// hide / show, no drag, no resize — so anything in storage is necessarily
// stale state from before the editing UI was removed (and was the cause of
// at least one widget vanishing for users with old `widget_state.hidden`
// flags). The DB columns stay for now in case we ever bring editing back.

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
  scopeId = null,
  widgets,
  className,
}: DashboardGridProps) {
  // The visual layout is the code defaults flipped from intent (x=0 = visual
  // right, RTL) to RGL's frame (x=0 = visual left). No persistence, no merge,
  // no per-user customization.
  const layouts = useMemo<Layouts>(
    () => flipLayouts(defaultLayouts(widgets)),
    [widgets]
  );

  // Local-only collapse state. Resets on reload — that's intentional, since
  // the chrome's collapse button is just a quick toggle and persisting it
  // caused the same kind of drift we saw with widget_state.hidden.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleCollapsed = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className={cn("relative grid-locked", className)}>
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        margin={MARGIN}
        containerPadding={CONTAINER_PADDING}
        compactType="vertical"
        isDraggable={false}
        isResizable={false}
      >
        {widgets.map((w) => {
          const Component = w.component;
          const isCollapsed = !!collapsed[w.key];
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
                collapsed={isCollapsed}
                onToggleCollapse={() => toggleCollapsed(w.key)}
              >
                {!isCollapsed && <Component scopeId={scopeId} />}
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
