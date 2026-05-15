import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Archive, ArchiveRestore } from "lucide-react";
import { useArchiveProject, useRestoreProject } from "@/lib/hooks/useProjects";
import type { Project, ProjectPricingMode } from "@/lib/types/domain";
import { pushUndo } from "@/lib/undo/store";

interface Props {
  projects: Project[];
}

const PRICING_LABEL: Record<ProjectPricingMode, string> = {
  hourly: "שעתי",
  fixed_price: "מחיר סופי",
  quote: "הצעת מחיר",
};

const STATUS_LABEL: Record<string, string> = {
  active: "פעיל",
  on_hold: "מושהה",
  completed: "הושלם",
  archived: "בארכיון",
};

export function ProjectsTable({ projects }: Props) {
  const navigate = useNavigate();

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 border-b border-ink-200">
            <tr className="text-start text-ink-500 text-xs">
              <th className="text-start font-semibold px-3 py-2">שם</th>
              <th className="text-start font-semibold px-3 py-2">תמחור</th>
              <th className="text-start font-semibold px-3 py-2">סטטוס</th>
              <th className="text-start font-semibold px-3 py-2">תגים</th>
              <th className="text-start font-semibold px-3 py-2 hidden md:table-cell">
                עודכן
              </th>
              <th className="w-8 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                onOpen={() => navigate(`/app/projects/${p.id}`)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  onOpen,
}: {
  project: Project;
  onOpen: () => void;
}) {
  const archive = useArchiveProject();
  const restore = useRestoreProject();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const stop = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const accent = project.color ?? "#a8a8bc";
  const updated = new Date(project.updated_at).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
  });

  return (
    <tr
      onClick={onOpen}
      className="border-b border-ink-100 hover:bg-ink-50 cursor-pointer"
    >
      <td className="px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-1.5 h-6 rounded-sm shrink-0"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
          {project.emoji && (
            <span className="text-base shrink-0" aria-hidden>
              {project.emoji}
            </span>
          )}
          <span className="font-medium text-ink-900 truncate">{project.name}</span>
        </div>
      </td>
      <td className="px-3 py-2 text-ink-700">
        {PRICING_LABEL[project.pricing_mode]}
      </td>
      <td className="px-3 py-2 text-ink-600">
        {STATUS_LABEL[project.status] ?? project.status}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1 flex-wrap">
          {project.tags?.slice(0, 3).map((t) => (
            <span key={t} className="chip-accent">
              {t}
            </span>
          ))}
          {project.tags && project.tags.length > 3 && (
            <span className="text-[10px] text-ink-400">
              +{project.tags.length - 3}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-ink-500 text-xs hidden md:table-cell">
        {updated}
      </td>
      <td className="px-3 py-2 text-end" onClick={stop}>
        <div className="relative inline-block" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-ink-100"
            aria-label="פעולות"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute end-0 top-full mt-1 z-20 bg-white border border-ink-200 rounded-lg shadow-lift min-w-[160px] py-1">
              {project.is_archived ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    const id = project.id;
                    restore.mutate(id);
                    pushUndo({
                      description: "שחזור פרויקט",
                      undo: () => archive.mutate(id),
                      redo: () => restore.mutate(id),
                    });
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start text-ink-700 hover:bg-ink-50"
                >
                  <ArchiveRestore className="w-3.5 h-3.5" />
                  שחזרי מארכיון
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    const id = project.id;
                    archive.mutate(id);
                    pushUndo({
                      description: "ארכוב פרויקט",
                      undo: () => restore.mutate(id),
                      redo: () => archive.mutate(id),
                    });
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-start text-ink-700 hover:bg-ink-50"
                >
                  <Archive className="w-3.5 h-3.5" />
                  ארכבי
                </button>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
