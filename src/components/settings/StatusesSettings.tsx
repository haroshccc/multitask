import { useState } from "react";
import { Plus, Trash2, GripVertical, Lock } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useMyTaskStatuses,
  useCreateUserTaskStatus,
  useUpdateUserTaskStatus,
  useDeleteUserTaskStatus,
} from "@/lib/hooks/useUserTaskStatuses";
import { slugifyStatusKey } from "@/lib/services/user-task-statuses";
import type { TaskStatusKind, UserTaskStatus } from "@/lib/types/domain";

const KIND_OPTIONS: { value: TaskStatusKind; label: string; hint: string }[] = [
  { value: "backlog", label: "טרם התחלה", hint: "משימות שטרם נגעת בהן" },
  { value: "active", label: "בעבודה", hint: "פעילה עכשיו" },
  { value: "waiting_approval", label: "ממתינה לאישור", hint: "מוגשת לאישור" },
  { value: "done", label: "הסתיימה", hint: "משימה שהושלמה; יקבל וי" },
  { value: "cancelled", label: "בוטלה", hint: "ננטש — לא יושלם" },
];

const COLOR_PRESETS = [
  "#a8a8bc",
  "#f59e0b",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
];

export function StatusesSettings() {
  const { data: statuses = [], isLoading } = useMyTaskStatuses();
  const createStatus = useCreateUserTaskStatus();

  const [draftLabel, setDraftLabel] = useState("");
  const [draftKind, setDraftKind] = useState<TaskStatusKind>("active");
  const [draftColor, setDraftColor] = useState(COLOR_PRESETS[1]);

  const handleAdd = async () => {
    const label = draftLabel.trim();
    if (!label) return;
    const existingKeys = new Set(statuses.map((s) => s.key));
    let key = slugifyStatusKey(label);
    let i = 1;
    while (existingKeys.has(key)) {
      key = `${slugifyStatusKey(label)}_${i++}`;
    }
    await createStatus.mutateAsync({
      key,
      label,
      kind: draftKind,
      color: draftColor,
      sort_order: (statuses.at(-1)?.sort_order ?? 0) + 100,
      is_builtin: false,
    });
    setDraftLabel("");
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h3 className="font-semibold text-ink-900 mb-1">סטטוסים של משימות</h3>
        <p className="text-xs text-ink-500 mb-4 leading-relaxed">
          כל סטטוס נראה לך ולשאר חברי הארגון שלך. ה-5 הראשונים הם ברירות מחדל —
          אפשר לשנות שם/צבע/סדר, אבל לא למחוק. כל סטטוס שייך ל"סוג" שקובע איך
          המערכת מתייחסת אליו (למשל מה מסמל "הסתיים").
        </p>

        {/* Existing statuses */}
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
        <div className="grid grid-cols-1 md:grid-cols-[1fr,180px,auto] gap-2">
          <input
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder='שם סטטוס (למשל "אצל הלקוח")'
            className="field"
          />
          <select
            value={draftKind}
            onChange={(e) => setDraftKind(e.target.value as TaskStatusKind)}
            className="field"
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
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
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-ink-500">צבע:</span>
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
        <p className="text-xs text-ink-500 mt-3">
          {KIND_OPTIONS.find((k) => k.value === draftKind)?.hint}
        </p>
      </div>
    </div>
  );
}

function StatusRow({ status }: { status: UserTaskStatus }) {
  const update = useUpdateUserTaskStatus();
  const del = useDeleteUserTaskStatus();

  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(status.label);
  const [color, setColor] = useState(status.color ?? "#a8a8bc");
  const [kind, setKind] = useState<TaskStatusKind>(status.kind);

  const commit = async () => {
    await update.mutateAsync({
      statusId: status.id,
      patch: {
        label: label.trim() || status.label,
        color,
        kind,
      },
    });
    setEditing(false);
  };

  const handleDelete = () => {
    if (status.is_builtin) return;
    if (!confirm(`למחוק את הסטטוס "${status.label}"?`)) return;
    del.mutate(status.id);
  };

  return (
    <li className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2">
      <GripVertical className="w-4 h-4 text-ink-300" />
      <button
        type="button"
        onClick={() => setEditing((v) => !v)}
        className="w-5 h-5 rounded-full border border-ink-200 shrink-0"
        style={{ backgroundColor: color }}
        aria-label="צבע"
      />
      {editing ? (
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
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
      <select
        value={kind}
        onChange={(e) => {
          const k = e.target.value as TaskStatusKind;
          setKind(k);
          update.mutate({ statusId: status.id, patch: { kind: k } });
        }}
        className="text-xs bg-ink-100 border border-ink-200 rounded-md px-2 py-1 text-ink-700"
      >
        {KIND_OPTIONS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </select>
      {editing && (
        <div className="flex gap-0.5">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c);
                update.mutate({
                  statusId: status.id,
                  patch: { color: c },
                });
              }}
              type="button"
              className={cn(
                "w-4 h-4 rounded-full border",
                color === c ? "ring-1 ring-ink-900 ring-offset-1" : "border-ink-200"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
      {status.is_builtin ? (
        <span className="text-ink-400 shrink-0" title="ברירת מחדל — לא ניתן למחוק">
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
