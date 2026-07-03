import { useMemo, useState, useEffect } from "react";
import { Plus, LayoutGrid, List as ListIcon, FolderArchive } from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import {
  FilterBar,
  useFiltersFromUrl,
} from "@/components/filters/FilterBar";
import { useProjects } from "@/lib/hooks/useProjects";
import { useOrgContacts, useAllProjectContacts } from "@/lib/hooks/useContacts";
import {
  getProjectState,
  PROJECT_STATE_LABEL,
  type ProjectState,
} from "@/lib/projects/state";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ProjectsTable } from "@/components/projects/ProjectsTable";
import { cn } from "@/lib/utils/cn";

const VIEW_STORAGE_KEY = "multitask.projects.view";
type ViewMode = "cards" | "table";
type StateFilter = "all" | ProjectState;

export function Projects() {
  const [filters, setFilters] = useFiltersFromUrl();
  const [showArchived, setShowArchived] = useState(false);
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [contactId, setContactId] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "table";
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    return stored === "cards" ? "cards" : "table"; // default: table
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  useEffect(() => {
    const handler = () => setCreateOpen(true);
    window.addEventListener("app:new-project", handler);
    return () => window.removeEventListener("app:new-project", handler);
  }, []);

  const { data: projects = [], isLoading } = useProjects({}, true);
  const { data: contacts = [] } = useOrgContacts();
  const { data: projectContactLinks = [] } = useAllProjectContacts();

  // All distinct tags across projects → ready-to-click chips in the filter.
  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) for (const t of p.tags ?? []) set.add(t);
    return [...set]
      .sort((a, b) => a.localeCompare(b, "he"))
      .map((t) => ({ value: t, label: t }));
  }, [projects]);

  // project id → set of linked contact ids (for the contact filter).
  const contactsByProject = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const link of projectContactLinks) {
      const set = m.get(link.project_id) ?? new Set<string>();
      set.add(link.contact_id);
      m.set(link.project_id, set);
    }
    return m;
  }, [projectContactLinks]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (showArchived) {
        if (!p.is_archived) return false;
      } else {
        if (p.is_archived) return false;
      }
      if (stateFilter !== "all" && getProjectState(p) !== stateFilter) return false;
      if (contactId && !contactsByProject.get(p.id)?.has(contactId)) return false;
      if (filters.tags?.length) {
        const tagSet = new Set(p.tags ?? []);
        if (!filters.tags.some((t) => tagSet.has(t))) return false;
      }
      return true;
    });
  }, [projects, filters, showArchived, stateFilter, contactId, contactsByProject]);

  const archivedCount = useMemo(
    () => projects.filter((p) => p.is_archived).length,
    [projects]
  );

  return (
    <ScreenScaffold
      title="פרויקטים"
      subtitle="כל פרויקט = מרחב עבודה עם משימות, פגישות, תשלומים ומסמכים — משותף לבחירתך."
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
      />

      <div className="space-y-3">
        <FilterBar
          screenKey="projects"
          filters={filters}
          onChange={setFilters}
          fields={[
            tagOptions.length > 0
              ? {
                  key: "tags",
                  type: "multi-enum" as const,
                  label: "תגים",
                  options: tagOptions,
                }
              : { key: "tags", type: "multi-text" as const, label: "תגים" },
          ]}
        />

        <div className="flex items-center gap-2 flex-wrap">
          {/* Project state filter: פעיל / לא פעיל / הושלם */}
          <div className="inline-flex items-center rounded-md border border-ink-200 bg-white overflow-hidden text-xs">
            {([
              ["all", "הכל"],
              ["active", PROJECT_STATE_LABEL.active],
              ["inactive", PROJECT_STATE_LABEL.inactive],
              ["completed", PROJECT_STATE_LABEL.completed],
            ] as [StateFilter, string][]).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setStateFilter(val)}
                className={cn(
                  "px-2.5 py-1",
                  stateFilter === val
                    ? "bg-ink-900 text-white"
                    : "text-ink-600 hover:bg-ink-50"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Contact filter */}
          {contacts.length > 0 && (
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="field text-xs py-1.5 w-auto max-w-[12rem]"
              title="סינון לפי איש קשר"
            >
              <option value="">כל אנשי הקשר</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.company || "ללא שם"}
                </option>
              ))}
            </select>
          )}

          {(contactId || stateFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setContactId("");
                setStateFilter("all");
              }}
              className="text-xs text-ink-400 hover:text-ink-700"
            >
              נקה סינון
            </button>
          )}
        </div>

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
        כל פרויקט הוא מרחב עבודה נפרד עם משימות, פגישות, תשלומים ומסמכים.
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
