import { useMemo, useState, type ReactNode, type ComponentType } from "react";
import { Responsive, WidthProvider, type Layout, type Layouts } from "react-grid-layout";
import { ChevronDown, ChevronUp, X, Plus, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useDashboardLayout, useDebouncedLayoutSave } from "@/lib/hooks/useDashboardLayout";
import type {
  DashboardScreen,
  WidgetLayout,
  WidgetState,
} from "@/lib/types/domain";

const ResponsiveGridLayout = WidthProvider(Responsive);

export interface WidgetDefinition {
  key: string;
  title: string;
  component: ComponentType<{ scopeId?: string | null }>;
  defaultDesktop: { x: number; y: number; w: number; h: number; minW?: number; minH?: number };
  defaultTablet?: { x: number; y: number; w: number; h: number };
  defaultMobile?: { x: number; y: number; w: number; h: number };
}

interface DashboardGridProps {
  screenKey: DashboardScreen;
  scopeId?: string | null;
  widgets: WidgetDefinition[];
  className?: string;
}

const BREAKPOINTS = { lg: 1200, md: 768, sm: 0 };
const COLS = { lg: 12, md: 8, sm: 4 };
const ROW_HEIGHT = 80;
const MARGIN: [number, number] = [16, 16];

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
    return {
      lg: layouts.lg.filter((l) => visibleKeys.has(l.i)),
      md: layouts.md.filter((l) => visibleKeys.has(l.i)),
      sm: layouts.sm.filter((l) => visibleKeys.has(l.i)),
    };
  }, [layouts, visibleWidgets]);

  const handleLayoutChange = (_current: Layout[], all: Layouts) => {
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
    <div className={cn("relative", className)}>
      {hiddenWidgets.length > 0 && (
        <AddHiddenWidget
          hiddenWidgets={hiddenWidgets}
          onShow={showWidget}
        />
      )}
      <ResponsiveGridLayout
        className="layout"
        layouts={filteredLayouts}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        rowHeight={ROW_HEIGHT}
        margin={MARGIN}
        draggableHandle=".widget-drag-handle"
        compactType="vertical"
        onLayoutChange={handleLayoutChange}
      >
        {visibleWidgets.map((w) => {
          const Component = w.component;
          const collapsed = widgetState[w.key]?.collapsed ?? false;
          return (
            <div key={w.key}>
              <WidgetChrome
                title={w.title}
                collapsed={collapsed}
                onToggleCollapse={() => toggleCollapsed(w.key)}
                onHide={() => hideWidget(w.key)}
              >
                {!collapsed && <Component scopeId={scopeId} />}
              </WidgetChrome>
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

function AddHiddenWidget({
  hiddenWidgets,
  onShow,
}: {
  hiddenWidgets: WidgetDefinition[];
  onShow: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute -top-12 end-0 z-10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-outline text-xs"
      >
        <Plus className="w-4 h-4" />
        הוסף ווידג'ט ({hiddenWidgets.length})
      </button>
      {open && (
        <div className="absolute end-0 top-full mt-1 bg-white border border-ink-200 rounded-xl shadow-lift w-56 py-1 max-h-64 overflow-auto">
          {hiddenWidgets.map((w) => (
            <button
              key={w.key}
              onClick={() => {
                onShow(w.key);
                setOpen(false);
              }}
              className="w-full text-start px-3 py-2 text-sm hover:bg-ink-50 text-ink-900"
            >
              {w.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
