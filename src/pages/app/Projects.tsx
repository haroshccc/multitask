import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, LayoutGrid, List as ListIcon, FolderArchive } from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import {
  FilterBar,
  useFiltersFromUrl,
} from "@/components/filters/FilterBar";
import { useProjects } from "@/lib/hooks/useProjects";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectsTable } from "@/components/projects/ProjectsTable";
import { cn } from "@/lib/utils/cn";

const VIEW_STORAGE_KEY = "multitask.projects.view";
type ViewMode = "cards" | "table";

const STATUS_OPTIONS = [
  { value: "active", label: "פעיל" },
  { value: "on_hold", label: "מושהה" },
  { value: "completed", label: "הושלם" },
];

const PRICING_OPTIONS = [
  { value: "hourly", label: "שעתי" },
  { value: "fixed_price", label: "מחיר סופי" },
  { value: "quote", label: "הצעת מחיר" },
];

export function Projects() {
  const navigate = useNavigate();
  const [filters, setFilters] = useFiltersFromUrl();
  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "cards";
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    return stored === "table" ? "table" : "cards";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  const { data: projects = [], isLoading } = useProjects({}, true);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (showArchived) {
        if (!p.is_archived) return false;
      } else {
        if (p.is_archived) return false;
      }
      if (filters.statuses?.length && !filters.statuses.includes(p.status)) {
        return false;
      }
      if (
        filters.pricingModes?.length &&
        !filters.pricingModes.includes(p.pricing_mode)
      ) {
        return false;
      }
      if (filters.tags?.length) {
        const tagSet = new Set(p.tags ?? []);
        if (!filters.tags.some((t) => tagSet.has(t))) return false;
      }
      return true;
    });
  }, [projects, filters, showArchived]);

  const archivedCount = useMemo(
    () => projects.filter((p) => p.is_archived).length,
    [projects]
  );

  return (
    <ScreenScaffold
      title="פרויקטים ותמחור"
      subtitle="כל פרויקט = דשבורד עם טבלת משימות, מחשבון תמחור, הוצאות, שאלות וסטטיסטיקות."
      actions={
        <span className="inline-flex items-center gap-2">
          <ViewToggle view={view} onChange={setView} />
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="btn-accent text-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            פרויקט חדש
          </button>
        </span>
      }
    >
      <CreateProjectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => navigate(`/app/projects/${id}`)}
      />

      <div className="space-y-3">
        <FilterBar
          screenKey="projects"
          filters={filters}
          onChange={setFilters}
          fields={[
            {
              key: "statuses",
              type: "multi-enum",
              label: "סטטוס",
              options: STATUS_OPTIONS,
            },
            {
              key: "pricingModes",
              type: "multi-enum",
              label: "תמחור",
              options: PRICING_OPTIONS,
            },
            { key: "tags", type: "multi-text", label: "תגים" },
          ]}
        />

        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-ink-500">
            {isLoading
              ? "טוען..."
              : `${filtered.length} ${showArchived ? "בארכיון" : "פעילים"}`}
          </div>
          {archivedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border",
                showArchived
                  ? "bg-ink-900 text-white border-ink-900"
                  : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
              )}
            >
              <FolderArchive className="w-3.5 h-3.5" />
              ארכיון ({archivedCount})
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            archived={showArchived}
            onCreate={() => setCreateOpen(true)}
          />
        ) : view === "cards" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        ) : (
          <ProjectsTable projects={filtered} />
        )}
      </div>
    </ScreenScaffold>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-ink-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => onChange("cards")}
        className={cn(
          "px-2 py-1 text-xs inline-flex items-center gap-1",
          view === "cards"
            ? "bg-ink-900 text-white"
            : "text-ink-600 hover:bg-ink-50"
        )}
        title="תצוגת כרטיסים"
        aria-pressed={view === "cards"}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        כרטיסים
      </button>
      <button
        type="button"
        onClick={() => onChange("table")}
        className={cn(
          "px-2 py-1 text-xs inline-flex items-center gap-1",
          view === "table"
            ? "bg-ink-900 text-white"
            : "text-ink-600 hover:bg-ink-50"
        )}
        title="תצוגת טבלה"
        aria-pressed={view === "table"}
      >
        <ListIcon className="w-3.5 h-3.5" />
        טבלה
      </button>
    </div>
  );
}

function EmptyState({
  archived,
  onCreate,
}: {
  archived: boolean;
  onCreate: () => void;
}) {
  if (archived) {
    return (
      <div className="card p-8 text-center">
        <FolderArchive className="w-10 h-10 text-ink-300 mx-auto mb-2" />
        <p className="text-sm text-ink-500">אין פרויקטים בארכיון</p>
      </div>
    );
  }
  return (
    <div className="card p-8 text-center">
      <div className="text-4xl mb-3">📁</div>
      <h3 className="text-base font-semibold text-ink-900 mb-1">עוד אין פרויקטים</h3>
      <p className="text-xs text-ink-500 mb-4 max-w-sm mx-auto">
        כל פרויקט הוא דשבורד נפרד עם משימות, תמחור, הוצאות ותבנית לשימוש חוזר.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="btn-accent text-sm inline-flex items-center gap-1.5"
      >
        <Plus className="w-4 h-4" />
        פרויקט ראשון
      </button>
    </div>
  );
}
