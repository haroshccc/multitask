import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Archive, ArchiveRestore, Power } from "lucide-react";
import {
  useArchiveProject,
  useRestoreProject,
  useUpdateProject,
} from "@/lib/hooks/useProjects";
import type { Project } from "@/lib/types/domain";
import { pushUndo } from "@/lib/undo/store";
import { cn } from "@/lib/utils/cn";
import { ListIcon } from "@/components/tasks/list-icons";

interface Props {
  projects: Project[];
}

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
  const update = useUpdateProject();
  const isActive = project.is_active !== false;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleActive = () => {
    const id = project.id;
    const next = !isActive;
    update.mutate({ projectId: id, patch: { is_active: next } });
    pushUndo({
      description: next ? "הפעלת פרויקט" : "השבתת פרויקט",
      undo: () => update.mutate({ projectId: id, patch: { is_active: !next } }),
      redo: () => update.mutate({ projectId: id, patch: { is_active: next } }),
    });
  };

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
      className={cn(
        "border-b border-ink-100 hover:bg-ink-50 cursor-pointer",
        !isActive && "opacity-60"
      )}
    >
      <td className="px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-1.5 h-6 rounded-sm shrink-0"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
          {project.emoji && (
            <span className="shrink-0 inline-flex text-ink-700" aria-hidden>
              <ListIcon emoji={project.emoji} className="w-4 h-4" />
            </span>
          )}
          <span className="font-medium text-ink-900 truncate">{project.name}</span>
        </div>
      </td>
      <td className="px-3 py-2" onClick={stop}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleActive}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
              isActive
                ? "border-success-300 bg-success-50 text-success-700 hover:bg-success-100"
                : "border-ink-200 bg-ink-50 text-ink-400 hover:bg-ink-100"
            )}
            title={isActive ? "פרויקט פעיל — לחצי להשבתה" : "פרויקט לא פעיל — לחצי להפעלה"}
            aria-pressed={isActive}
          >
            <Power className="w-3 h-3" />
            {isActive ? "פעיל" : "לא פעיל"}
          </button>
          {project.status !== "active" && (
            <span className="text-xs text-ink-500">
              {STATUS_LABEL[project.status] ?? project.status}
            </span>
          )}
        </div>
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
