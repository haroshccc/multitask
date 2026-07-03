import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  MoreHorizontal,
  Archive,
  ArchiveRestore,
  Folder,
  Presentation,
} from "lucide-react";
import { useArchiveProject, useRestoreProject } from "@/lib/hooks/useProjects";
import { useTasks, useTaskLists } from "@/lib/hooks";
import { formatMoney, type Currency } from "@/lib/utils/pricing";
import type { Project } from "@/lib/types/domain";
import { pushUndo } from "@/lib/undo/store";
import { cn } from "@/lib/utils/cn";
import { ListIcon } from "@/components/tasks/list-icons";
import { ProjectStateControl } from "@/components/projects/ProjectStateControl";

interface Props {
  projects: Project[];
}

interface ProjectStats {
  estH: number; // planned hours (Σ estimated)
  actualH: number; // worked hours (Σ actual_seconds)
  done: number; // completed tasks
  open: number; // not-yet-done tasks
  blendedH: number; // actual for done + estimated for not-done
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function ProjectsTable({ projects }: Props) {
  const navigate = useNavigate();
  const { data: tasks = [] } = useTasks();
  const { data: lists = [] } = useTaskLists();

  // Aggregate task stats per project (task → list → project).
  const statsByProject = useMemo(() => {
    const listToProject = new Map<string, string>();
    for (const l of lists) if (l.project_id) listToProject.set(l.id, l.project_id);
    const m = new Map<string, ProjectStats>();
    const get = (pid: string): ProjectStats => {
      let s = m.get(pid);
      if (!s) {
        s = { estH: 0, actualH: 0, done: 0, open: 0, blendedH: 0 };
        m.set(pid, s);
      }
      return s;
    };
    for (const t of tasks) {
      if (t.is_phase) continue;
      const pid = t.task_list_id ? listToProject.get(t.task_list_id) : undefined;
      if (!pid) continue;
      const s = get(pid);
      const est = t.estimated_hours ?? 0;
      const act = (t.actual_seconds ?? 0) / 3600;
      const done = !!t.completed_at;
      s.estH += est;
      s.actualH += act;
      if (done) s.done += 1;
      else s.open += 1;
      s.blendedH += done ? act : est;
    }
    return m;
  }, [tasks, lists]);

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 border-b border-ink-200">
            <tr className="text-start text-ink-500 text-xs">
              <th className="text-start font-semibold px-3 py-2">שם</th>
              <th className="text-start font-semibold px-3 py-2">מצב</th>
              <th className="text-start font-semibold px-3 py-2">משימות</th>
              <th className="text-start font-semibold px-3 py-2 hidden sm:table-cell">
                שעות (מתוכנן/בפועל)
              </th>
              <th className="text-end font-semibold px-3 py-2">מחיר</th>
              <th className="text-end font-semibold px-3 py-2 hidden sm:table-cell">
                רווח/שעה
              </th>
              <th className="text-center font-semibold px-3 py-2 hidden md:table-cell">
                קישורים
              </th>
              <th className="w-8 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                stats={statsByProject.get(p.id)}
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
  stats,
  onOpen,
}: {
  project: Project;
  stats?: ProjectStats;
  onOpen: () => void;
}) {
  const archive = useArchiveProject();
  const restore = useRestoreProject();
  const isActive = project.is_active !== false;
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
  const currency = ((project.currency as Currency) ?? "ILS") as Currency;
  const priceCents = project.total_price_cents ?? 0;
  const s = stats ?? { estH: 0, actualH: 0, done: 0, open: 0, blendedH: 0 };
  const total = s.done + s.open;
  const profitPerHour = s.blendedH > 0 ? Math.round(priceCents / s.blendedH) : null;

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
        <ProjectStateControl project={project} />
      </td>

      {/* Tasks: done / open */}
      <td className="px-3 py-2 whitespace-nowrap">
        {total === 0 ? (
          <span className="text-ink-300 text-xs">—</span>
        ) : (
          <span className="text-xs">
            <span className="font-semibold text-success-700 tabular-nums">
              {s.done}
            </span>
            <span className="text-ink-400"> הושלמו · </span>
            <span className="font-semibold text-ink-700 tabular-nums">{s.open}</span>
            <span className="text-ink-400"> פתוחות</span>
          </span>
        )}
      </td>

      {/* Hours: planned / actual */}
      <td className="px-3 py-2 whitespace-nowrap hidden sm:table-cell">
        <span className="text-xs tabular-nums">
          <span className="text-ink-600">{round1(s.estH)}</span>
          <span className="text-ink-400"> / </span>
          <span className="text-primary-700 font-medium">{round1(s.actualH)}</span>
          <span className="text-ink-400"> ש׳</span>
        </span>
      </td>

      {/* Price */}
      <td className="px-3 py-2 text-end whitespace-nowrap tabular-nums">
        {priceCents > 0 ? (
          <span className="font-semibold text-ink-900">
            {formatMoney(priceCents, currency)}
          </span>
        ) : (
          <span className="text-ink-300 text-xs">—</span>
        )}
      </td>

      {/* Profit / hour (blended) */}
      <td className="px-3 py-2 text-end whitespace-nowrap tabular-nums hidden sm:table-cell">
        {profitPerHour == null || priceCents === 0 ? (
          <span className="text-ink-300 text-xs">—</span>
        ) : (
          <span className="font-medium text-primary-700">
            {formatMoney(profitPerHour, currency)}
          </span>
        )}
      </td>

      {/* Quick links */}
      <td className="px-3 py-2 hidden md:table-cell" onClick={stop}>
        <div className="flex items-center justify-center gap-1">
          <LinkIconBtn
            url={project.files_folder_url}
            Icon={Folder}
            colorClass="text-amber-500"
            title="תיקיית הקבצים"
          />
          <LinkIconBtn
            url={project.presentation_url}
            Icon={Presentation}
            colorClass="text-pink-500"
            title="מצגת (Canva)"
          />
        </div>
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

function LinkIconBtn({
  url,
  Icon,
  colorClass,
  title,
}: {
  url: string | null | undefined;
  Icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  title: string;
}) {
  if (!url) {
    return (
      <span className="p-1 text-ink-200" title={`${title} — לא הוגדר`}>
        <Icon className="w-4 h-4" />
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("p-1 rounded-md hover:bg-ink-100", colorClass)}
      title={title}
      aria-label={title}
    >
      <Icon className="w-4 h-4" />
    </a>
  );
}
