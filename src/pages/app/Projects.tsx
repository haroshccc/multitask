import { useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import {
  ArrowLeft,
  Archive,
  FolderKanban,
  Loader2,
  Plus,
} from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCreateProject, useProjects } from "@/lib/queries/projects";
import type { ProjectPricingMode } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

const PRICING_LABELS: Record<ProjectPricingMode, string> = {
  hourly: "שעתי",
  fixed_price: "מחיר קבוע",
  quote: "הצעה",
};

export function Projects() {
  const { user, activeOrganizationId } = useAuth();
  const [includeArchived, setIncludeArchived] = useState(false);
  const projects = useProjects(activeOrganizationId, includeArchived);
  const createProject = useCreateProject();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [pricingMode, setPricingMode] = useState<ProjectPricingMode>("hourly");
  const [hourlyRate, setHourlyRate] = useState("");

  const handleCreate = async () => {
    if (!name.trim() || !user || !activeOrganizationId) return;
    await createProject.mutateAsync({
      orgId: activeOrganizationId,
      ownerId: user.id,
      name: name.trim(),
      pricingMode,
      hourlyRateCents:
        pricingMode === "hourly" && hourlyRate
          ? Math.round(Number(hourlyRate) * 100)
          : null,
    });
    setName("");
    setHourlyRate("");
    setCreating(false);
  };

  return (
    <ScreenScaffold
      title="פרויקטים"
      subtitle="ניהול פרויקטים עם תמחור, משימות, ותבניות"
      actions={
        <button onClick={() => setCreating((v) => !v)} className="btn-accent">
          <Plus className="w-4 h-4" />
          פרויקט חדש
        </button>
      }
    >
      {creating && (
        <div className="card p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
            <label className="block">
              <span className="text-xs font-medium text-ink-700 mb-1 block">שם הפרויקט</span>
              <input
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="שם הפרויקט"
                autoFocus
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink-700 mb-1 block">סוג תמחור</span>
              <select
                className="field"
                value={pricingMode}
                onChange={(e) => setPricingMode(e.target.value as ProjectPricingMode)}
              >
                <option value="hourly">שעתי</option>
                <option value="fixed_price">מחיר קבוע</option>
                <option value="quote">הצעה</option>
              </select>
            </label>
            {pricingMode === "hourly" && (
              <label className="block">
                <span className="text-xs font-medium text-ink-700 mb-1 block">תעריף שעתי (₪)</span>
                <input
                  type="number"
                  min="0"
                  className="field w-28"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="250"
                />
              </label>
            )}
            <button
              onClick={handleCreate}
              disabled={!name.trim() || createProject.isPending}
              className="btn-accent"
            >
              {createProject.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              צרי
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-3">
        <label className="flex items-center gap-2 text-sm text-ink-600 cursor-pointer">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          כולל בארכיון
        </label>
      </div>

      {projects.isLoading ? (
        <div className="card p-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-ink-400" />
        </div>
      ) : !projects.data || projects.data.length === 0 ? (
        <div className="card p-8 md:p-12 text-center">
          <FolderKanban className="w-10 h-10 text-ink-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-ink-900 mb-1">אין עדיין פרויקטים</h2>
          <p className="text-sm text-ink-600 mb-4">
            פרויקט מרכז משימות, תמחור, הוצאות וזמנים במקום אחד.
          </p>
          <button onClick={() => setCreating(true)} className="btn-accent">
            <Plus className="w-4 h-4" />
            צרי את הראשון
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {projects.data.map((project) => {
            const pricingLabel = PRICING_LABELS[project.pricing_mode];
            const rateLabel =
              project.pricing_mode === "hourly" && project.hourly_rate_cents
                ? `₪${(project.hourly_rate_cents / 100).toLocaleString()} / שעה`
                : project.pricing_mode === "fixed_price" && project.total_price_cents
                  ? `₪${(project.total_price_cents / 100).toLocaleString()}`
                  : null;
            return (
              <li key={project.id}>
                <Link
                  to={`/app/projects/${project.id}`}
                  className={cn(
                    "card-lift p-4 block h-full",
                    project.is_archived && "opacity-60"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {project.emoji && (
                          <span className="text-lg">{project.emoji}</span>
                        )}
                        <h3 className="text-base font-semibold text-ink-900 truncate">
                          {project.name}
                        </h3>
                      </div>
                      {project.description && (
                        <p className="text-xs text-ink-500 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                    </div>
                    {project.is_archived && (
                      <Archive className="w-4 h-4 text-ink-400 shrink-0" />
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span className="chip">{pricingLabel}</span>
                    {rateLabel && <span className="chip-accent">{rateLabel}</span>}
                    <span
                      className={cn(
                        "chip",
                        project.status === "active"
                          ? "bg-success-500/10 text-success-600"
                          : project.status === "paused"
                            ? "bg-ink-200 text-ink-600"
                            : "bg-accent-purple/10 text-accent-purple"
                      )}
                    >
                      {project.status === "active"
                        ? "פעיל"
                        : project.status === "paused"
                          ? "מושהה"
                          : "הושלם"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-ink-200 text-xs text-ink-500">
                    <span>
                      עודכן{" "}
                      {formatDistanceToNow(new Date(project.updated_at), {
                        addSuffix: true,
                        locale: he,
                      })}
                    </span>
                    <span className="flex items-center gap-1 text-ink-700 hover:text-primary-600">
                      לפתיחה <ArrowLeft className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </ScreenScaffold>
  );
}
