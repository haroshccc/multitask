import { useRef, useState } from "react";
import { Download, Upload, FileJson, Table, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useOrgScope } from "@/lib/hooks/useOrgScope";
import {
  buildFullBackup,
  buildTasksCsv,
  downloadJson,
  downloadCsv,
  type OrgBackup,
} from "@/lib/services/export-service";

// ---------------------------------------------------------------------------

type ExportState = "idle" | "loading" | "done" | "error";

function useExportAction(fn: () => Promise<void>) {
  const [state, setState] = useState<ExportState>("idle");
  const run = async () => {
    setState("loading");
    try {
      await fn();
      setState("done");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    }
  };
  return { state, run };
}

// ---------------------------------------------------------------------------

export function BackupRestoreSection() {
  const { organizationId } = useOrgScope();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [restoreState, setRestoreState] = useState<
    "idle" | "preview" | "importing" | "done" | "error"
  >("idle");
  const [restorePreview, setRestorePreview] = useState<OrgBackup | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const jsonExport = useExportAction(async () => {
    if (!organizationId) throw new Error("no org");
    const backup = await buildFullBackup(organizationId);
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(backup, `multitask-backup-${date}.json`);
  });

  const csvExport = useExportAction(async () => {
    if (!organizationId) throw new Error("no org");
    const csv = await buildTasksCsv(organizationId);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `multitask-tasks-${date}.csv`);
  });

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as OrgBackup;
        if (parsed.version !== 2 || !parsed.data) {
          throw new Error("קובץ גיבוי לא תקין");
        }
        setRestorePreview(parsed);
        setRestoreState("preview");
      } catch (err) {
        setRestoreError(err instanceof Error ? err.message : "שגיאה בקריאת הקובץ");
        setRestoreState("error");
      }
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  const handleRestoreConfirm = async () => {
    if (!restorePreview || !organizationId) return;
    setRestoreState("importing");
    try {
      const { supabase } = await import("@/lib/supabase/client");
      const db = supabase as any;
      const d = restorePreview.data;

      if (d.task_lists?.length) {
        await db.from("task_lists").upsert(
          d.task_lists.map((r: any) => ({ ...r, organization_id: organizationId })),
          { onConflict: "id", ignoreDuplicates: true }
        );
      }
      if (d.tasks?.length) {
        await db.from("tasks").upsert(
          d.tasks.map((r: any) => ({ ...r, organization_id: organizationId })),
          { onConflict: "id", ignoreDuplicates: true }
        );
      }
      if (d.projects?.length) {
        await db.from("projects").upsert(
          d.projects.map((r: any) => ({ ...r, organization_id: organizationId })),
          { onConflict: "id", ignoreDuplicates: true }
        );
      }
      if (d.thought_lists?.length) {
        await db.from("thought_lists").upsert(
          d.thought_lists.map((r: any) => ({ ...r, organization_id: organizationId })),
          { onConflict: "id", ignoreDuplicates: true }
        );
      }
      if (d.thoughts?.length) {
        await db.from("thoughts").upsert(
          d.thoughts.map((r: any) => ({ ...r, organization_id: organizationId })),
          { onConflict: "id", ignoreDuplicates: true }
        );
      }
      if (d.events?.length) {
        await db.from("events").upsert(
          d.events.map((r: any) => ({ ...r, organization_id: organizationId })),
          { onConflict: "id", ignoreDuplicates: true }
        );
      }
      if (d.meal_categories?.length) {
        await db.from("meal_categories").upsert(
          d.meal_categories.map((r: any) => ({ ...r, organization_id: organizationId })),
          { onConflict: "id", ignoreDuplicates: true }
        );
      }
      if (d.ingredient_categories?.length) {
        await db.from("ingredient_categories").upsert(
          d.ingredient_categories.map((r: any) => ({ ...r, organization_id: organizationId })),
          { onConflict: "id", ignoreDuplicates: true }
        );
      }
      if (d.ingredients?.length) {
        const rows = d.ingredients.map(({ ingredient_units: _u, ...r }: any) => ({
          ...r,
          organization_id: organizationId,
        }));
        await db.from("ingredients").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
        for (const ing of d.ingredients as any[]) {
          if (ing.ingredient_units?.length) {
            await db.from("ingredient_units").upsert(
              ing.ingredient_units.map((u: any) => ({ ...u, ingredient_id: ing.id })),
              { onConflict: "id", ignoreDuplicates: true }
            );
          }
        }
      }
      if (d.meals?.length) {
        const mealRows = d.meals.map(({ meal_ingredients: _mi, ...r }: any) => ({
          ...r,
          organization_id: organizationId,
        }));
        await db.from("meals").upsert(mealRows, { onConflict: "id", ignoreDuplicates: true });
        for (const meal of d.meals as any[]) {
          if (meal.meal_ingredients?.length) {
            await db.from("meal_ingredients").upsert(
              meal.meal_ingredients.map((mi: any) => ({ ...mi, meal_id: meal.id })),
              { onConflict: "id", ignoreDuplicates: true }
            );
          }
        }
      }
      if (d.meal_plan_days?.length) {
        await db.from("meal_plan_days").upsert(
          d.meal_plan_days.map((r: any) => ({ ...r, organization_id: organizationId })),
          { onConflict: "id", ignoreDuplicates: true }
        );
      }

      setRestoreState("done");
      setRestorePreview(null);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "שגיאה בייבוא");
      setRestoreState("error");
    }
  };

  const cancelRestore = () => {
    setRestoreState("idle");
    setRestorePreview(null);
    setRestoreError(null);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Export ---------------------------------------------------------------- */}
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-ink-800">ייצוא נתונים</h3>
        <p className="text-sm text-ink-500">
          הורד גיבוי של כל הנתונים שלך. מומלץ לגבות מפעם לפעם.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ExportButton
            icon={FileJson}
            label="גיבוי מלא (JSON)"
            sublabel="משימות, מחשבות, הקלטות, יומן, תפריטים"
            state={jsonExport.state}
            onClick={jsonExport.run}
          />
          <ExportButton
            icon={Table}
            label="משימות (CSV / Excel)"
            sublabel="פתיחה ישירה ב-Excel עם תמיכה בעברית"
            state={csvExport.state}
            onClick={csvExport.run}
          />
        </div>
      </div>

      {/* Import / Restore ------------------------------------------------------- */}
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-ink-800">שחזור מגיבוי</h3>
        <p className="text-sm text-ink-500">
          ייבוא מקובץ JSON שיוצר כאן. הנתונים מתווספים — לא מוחקים נתונים קיימים.
        </p>

        {restoreState === "idle" && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            בחר קובץ גיבוי
          </button>
        )}

        {restoreState === "preview" && restorePreview && (
          <div className="space-y-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm space-y-2">
              <p className="font-medium text-amber-800">תצוגה מקדימה — מה יתווסף:</p>
              <BackupSummary backup={restorePreview} />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRestoreConfirm}
                className="btn btn-primary"
              >
                ייבא עכשיו
              </button>
              <button type="button" onClick={cancelRestore} className="btn btn-secondary">
                ביטול
              </button>
            </div>
          </div>
        )}

        {restoreState === "importing" && (
          <div className="flex items-center gap-2 text-sm text-ink-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            מייבא נתונים...
          </div>
        )}

        {restoreState === "done" && (
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
            הייבוא הושלם בהצלחה. רענן את הדף לראות את הנתונים.
          </div>
        )}

        {restoreState === "error" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-rose-700">
              <AlertCircle className="w-4 h-4" />
              {restoreError ?? "שגיאה בייבוא"}
            </div>
            <button type="button" onClick={cancelRestore} className="btn btn-secondary text-xs">
              נסה שנית
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileSelected}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

type ExportButtonProps = {
  icon: React.ElementType;
  label: string;
  sublabel: string;
  state: ExportState;
  onClick: () => void;
};

function ExportButton({ icon: Icon, label, sublabel, state, onClick }: ExportButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "loading"}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 text-start transition-colors",
        state === "idle" && "border-ink-200 hover:border-brand-400 hover:bg-brand-50",
        state === "loading" && "border-ink-200 opacity-60 cursor-wait",
        state === "done" && "border-emerald-300 bg-emerald-50",
        state === "error" && "border-rose-300 bg-rose-50"
      )}
    >
      <span className="mt-0.5 shrink-0">
        {state === "loading" ? (
          <Loader2 className="w-5 h-5 animate-spin text-ink-400" />
        ) : state === "done" ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        ) : state === "error" ? (
          <AlertCircle className="w-5 h-5 text-rose-600" />
        ) : (
          <Icon className="w-5 h-5 text-ink-400" />
        )}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-ink-800 flex items-center gap-1">
          {label}
          {state === "idle" && <Download className="w-3.5 h-3.5 text-ink-400" />}
        </span>
        <span className="text-xs text-ink-500">{sublabel}</span>
        {state === "done" && (
          <span className="text-xs text-emerald-700">הורד בהצלחה</span>
        )}
        {state === "error" && (
          <span className="text-xs text-rose-700">שגיאה — נסה שנית</span>
        )}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------

function BackupSummary({ backup }: { backup: OrgBackup }) {
  const d = backup.data;
  const items = [
    { label: "משימות", count: d.tasks?.length ?? 0 },
    { label: "פרויקטים", count: d.projects?.length ?? 0 },
    { label: "מחשבות", count: d.thoughts?.length ?? 0 },
    { label: "הקלטות", count: d.recordings?.length ?? 0 },
    { label: "אירועים", count: d.events?.length ?? 0 },
    { label: "ארוחות", count: d.meals?.length ?? 0 },
    { label: "מוצרים", count: d.ingredients?.length ?? 0 },
  ].filter((i) => i.count > 0);

  const exportedAt = backup.exported_at
    ? new Date(backup.exported_at).toLocaleDateString("he-IL", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <ul className="space-y-1 text-amber-700">
      {exportedAt && <li className="text-xs text-amber-600">יוצא ב-{exportedAt}</li>}
      {items.map((i) => (
        <li key={i.label} className="flex justify-between">
          <span>{i.label}</span>
          <span className="font-medium">{i.count.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}
