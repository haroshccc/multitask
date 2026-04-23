import { useState } from "react";
import { Plus, Trash2, Lock, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils/cn";
import {
  useMyTaskStatuses,
  useCreateUserTaskStatus,
  useUpdateUserTaskStatus,
  useDeleteUserTaskStatus,
} from "@/lib/hooks/useUserTaskStatuses";
import {
  resetUserTaskStatuses,
  slugifyStatusKey,
} from "@/lib/services/user-task-statuses";
import { pushUndo } from "@/lib/undo/store";
import type { UserTaskStatus } from "@/lib/types/domain";

const COLOR_PRESETS = [
  "#a8a8bc", "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
  "#ec4899", "#f43f5e", "#db2777", "#64748b", "#6b7280",
];

export function StatusesSettings() {
  const { data: statuses = [], isLoading } = useMyTaskStatuses();
  const createStatus = useCreateUserTaskStatus();
  const deleteStatus = useDeleteUserTaskStatus();
  const qc = useQueryClient();

  const [draftLabel, setDraftLabel] = useState("");
  const [draftColor, setDraftColor] = useState(COLOR_PRESETS[3]);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleAdd = async () => {
    const label = draftLabel.trim();
    if (!label) return;
    const existingKeys = new Set(statuses.map((s) => s.key));
    let key = slugifyStatusKey(label);
    let i = 1;
    while (existingKeys.has(key)) {
      key = `${slugifyStatusKey(label)}_${i++}`;
    }
    const created = await createStatus.mutateAsync({
      key,
      label,
      kind: "active",
      color: draftColor,
      sort_order: (statuses.at(-1)?.sort_order ?? 0) + 100,
      is_builtin: false,
    });
    setDraftLabel("");
    pushUndo({
      description: "הוספת סטטוס",
      undo: () => deleteStatus.mutate(created.id),
      redo: () =>
        createStatus.mutate({
          key: created.key,
          label: created.label,
          kind: created.kind,
          color: created.color,
          sort_order: created.sort_order,
          is_builtin: false,
        }),
    });
  };

  const handleReset = async () => {
    await resetUserTaskStatuses();
    qc.invalidateQueries({ queryKey: ["user-task-statuses"] });
    setConfirmReset(false);
    // Reset is destructive + already guarded by the confirmation modal;
    // we intentionally don't push it to the undo stack.
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold text-ink-900">סטטוסים של משימות</h3>
            <p className="text-xs text-ink-500 mt-0.5 leading-relaxed">
              הסטטוסים פרטיים לחשבון שלך — אחרים בארגון לא רואים אותם. אפשר
              לשנות שם/צבע, להוסיף חדשים, ולמחוק (חוץ מ-5 ברירות-המחדל).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="btn-ghost text-xs shrink-0"
            title="איפוס לברירות מחדל"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            איפוס
          </button>
        </div>

        {isLoading ? (
          <div className="text-sm text-ink-500 text-center py-6">טוען...</div>
        ) : (
          <ul className="space-y-1.5">
            {statuses.map((s) => (
              <StatusRow key={s.id} status={s} />
            ))}
          </ul>
        )}
      </div>

      {/* Add new */}
      <div className="card p-4">
        <h4 className="font-semibold text-ink-900 mb-3 text-sm">
          הוספת סטטוס חדש
        </h4>
        <div className="flex items-center gap-2">
          <input
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder='שם סטטוס (למשל "אצל הלקוח")'
            className="field flex-1"
          />
          <button
            onClick={handleAdd}
            disabled={!draftLabel.trim()}
            className="btn-accent text-sm"
            type="button"
          >
            <Plus className="w-4 h-4" />
            הוסף
          </button>
        </div>
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-ink-500 ms-1">צבע:</span>
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              onClick={() => setDraftColor(c)}
              type="button"
              className={cn(
                "w-5 h-5 rounded-full border",
                draftColor === c
                  ? "ring-2 ring-ink-900 ring-offset-1 border-white"
                  : "border-ink-200"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {confirmReset && (
        <div
          className="fixed inset-0 z-[60] bg-ink-900/40 flex items-center justify-center p-4"
          onClick={() => setConfirmReset(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-lift w-full max-w-sm p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-ink-900">
              איפוס סטטוסים לברירת מחדל
            </h3>
            <p className="text-sm text-ink-600">
              זה ימחק את כל הסטטוסים המותאמים שיצרת וישחזר את 5 ברירות-המחדל
              המקוריות.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmReset(false)}
                className="btn-ghost text-xs"
                type="button"
              >
                בטל
              </button>
              <button
                onClick={handleReset}
                className="btn-accent text-xs"
                type="button"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                אפס
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusRow({ status }: { status: UserTaskStatus }) {
  const update = useUpdateUserTaskStatus();
  const del = useDeleteUserTaskStatus();
  const create = useCreateUserTaskStatus();

  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(status.label);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const commitLabel = async () => {
    const trimmed = label.trim();
    if (!trimmed || trimmed === status.label) {
      setLabel(status.label);
      setEditing(false);
      return;
    }
    const prev = status.label;
    const next = trimmed;
    await update.mutateAsync({
      statusId: status.id,
      patch: { label: next },
    });
    setEditing(false);
    pushUndo({
      description: "שינוי שם סטטוס",
      undo: () =>
        update.mutate({ statusId: status.id, patch: { label: prev } }),
      redo: () =>
        update.mutate({ statusId: status.id, patch: { label: next } }),
    });
  };

  const setColor = (c: string) => {
    const prev = status.color;
    update.mutate({ statusId: status.id, patch: { color: c } });
    setPaletteOpen(false);
    pushUndo({
      description: "שינוי צבע סטטוס",
      undo: () =>
        update.mutate({ statusId: status.id, patch: { color: prev } }),
      redo: () =>
        update.mutate({ statusId: status.id, patch: { color: c } }),
    });
  };

  const handleDelete = () => {
    if (status.is_builtin) return;
    if (!confirm(`למחוק את הסטטוס "${status.label}"?`)) return;
    const snap = {
      key: status.key,
      label: status.label,
      color: status.color,
      kind: status.kind,
      sort_order: status.sort_order,
    };
    del.mutate(status.id);
    pushUndo({
      description: "מחיקת סטטוס",
      undo: () => create.mutate({ ...snap, is_builtin: false }),
      redo: () => del.mutate(status.id),
    });
  };

  return (
    <li className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2">
      <div className="relative">
        <button
          type="button"
          onClick={() => setPaletteOpen((v) => !v)}
          className="w-5 h-5 rounded-full border border-ink-200 shrink-0 hover:ring-2 hover:ring-ink-300"
          style={{ backgroundColor: status.color ?? "#a8a8bc" }}
          aria-label="שנה צבע"
          title="שנה צבע"
        />
        {paletteOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setPaletteOpen(false)}
            />
            <div className="absolute start-0 mt-1 z-20 bg-white border border-ink-200 rounded-xl shadow-lift p-2 grid grid-cols-5 gap-1 w-[180px]">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-6 h-6 rounded-full border",
                    status.color === c
                      ? "ring-2 ring-ink-900 ring-offset-1 border-white"
                      : "border-ink-200"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {editing ? (
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitLabel();
            if (e.key === "Escape") {
              setLabel(status.label);
              setEditing(false);
            }
          }}
          className="flex-1 min-w-0 text-sm bg-transparent border-b border-primary-500 outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex-1 min-w-0 text-start text-sm text-ink-900 hover:text-primary-700"
        >
          {status.label}
        </button>
      )}

      {status.is_builtin ? (
        <span
          className="text-ink-300 shrink-0"
          title="ברירת מחדל — לא ניתן למחוק (אבל אפשר לשנות שם וצבע)"
        >
          <Lock className="w-3.5 h-3.5" />
        </span>
      ) : (
        <button
          onClick={handleDelete}
          className="p-1 text-ink-400 hover:text-danger-500"
          title="מחק"
          type="button"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </li>
  );
}
