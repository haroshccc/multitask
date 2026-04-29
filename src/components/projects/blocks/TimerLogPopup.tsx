import { useEffect, useMemo, useState } from "react";
import { X, Plus, Pencil, Check, Trash2, Loader2 } from "lucide-react";
import {
  useTaskTimeEntries,
  useCreateManualTimeEntry,
  useUpdateTimeEntry,
  useDeleteTimeEntry,
} from "@/lib/hooks";
import type { Task, TimeEntry } from "@/lib/types/domain";

/**
 * Modal popup that lists every time_entries row for a task and lets the user
 * edit/add/delete them. Mirrors the spec MD's `openTimerLog` + log popup.
 *
 * Datetime entry uses two narrow inputs (date + time) per side; the merged
 * ISO string is what the service expects for started_at/ended_at.
 */
export function TimerLogPopup({
  task,
  onClose,
}: {
  task: Task;
  onClose: () => void;
}) {
  const { data: entries = [], isLoading } = useTaskTimeEntries(task.id);
  const create = useCreateManualTimeEntry();
  const update = useUpdateTimeEntry();
  const del = useDeleteTimeEntry();

  const [editingId, setEditingId] = useState<string | null>(null);

  const totalSeconds = useMemo(
    () =>
      entries.reduce(
        (s, e) => s + (e.duration_seconds ?? deriveDuration(e)),
        0
      ),
    [entries]
  );

  const handleAdd = () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    create.mutate({
      task_id: task.id,
      started_at: oneHourAgo.toISOString(),
      ended_at: now.toISOString(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/30 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lift w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-ink-200">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink-900 truncate">
              {task.title || "(ללא שם)"}
            </h3>
            <p className="text-[11px] text-ink-500 mt-0.5">
              {entries.length} סשנים · סה״כ {fmtDuration(totalSeconds)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-ink-100 text-ink-500 hover:text-ink-900"
            aria-label="סגרי"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8 text-ink-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
              טוענת רשומות…
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-10 text-ink-500 text-sm">
              עוד אין רשומות זמן למשימה הזו.
            </div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <EntryRow
                    entry={entry}
                    editing={editingId === entry.id}
                    onStartEdit={() => setEditingId(entry.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onSave={(patch) => {
                      update.mutate(
                        { entryId: entry.id, taskId: task.id, patch },
                        { onSuccess: () => setEditingId(null) }
                      );
                    }}
                    onDelete={() => {
                      if (confirm("למחוק את הרשומה?"))
                        del.mutate({ entryId: entry.id, taskId: task.id });
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="px-4 py-3 border-t border-ink-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleAdd}
            disabled={create.isPending}
            className="btn-outline text-xs flex items-center gap-1"
          >
            {create.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            הוסיפי רשומה
          </button>
          <span className="text-[11px] text-ink-500">
            שעון מקומי · ערוך כדי לתקן זמנים
          </span>
        </footer>
      </div>
    </div>
  );
}

// ─── Entry row (read & edit modes) ─────────────────────────────────────────

function EntryRow({
  entry,
  editing,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  entry: TimeEntry;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (patch: {
    started_at?: string;
    ended_at?: string;
    note?: string | null;
  }) => void;
  onDelete: () => void;
}) {
  const [draftStart, setDraftStart] = useState(toLocalInputs(entry.started_at));
  const [draftEnd, setDraftEnd] = useState(
    entry.ended_at ? toLocalInputs(entry.ended_at) : { date: "", time: "" }
  );
  const [draftNote, setDraftNote] = useState(entry.note ?? "");

  useEffect(() => {
    setDraftStart(toLocalInputs(entry.started_at));
    setDraftEnd(
      entry.ended_at ? toLocalInputs(entry.ended_at) : { date: "", time: "" }
    );
    setDraftNote(entry.note ?? "");
  }, [entry.id, entry.started_at, entry.ended_at, entry.note]);

  const isOpen = !entry.ended_at;
  const dur = entry.duration_seconds ?? deriveDuration(entry);

  if (!editing) {
    return (
      <div className="px-4 py-2.5 flex items-center gap-2 hover:bg-ink-50 group/log">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-ink-900 tabular-nums">
            {fmtDateTime(entry.started_at)}
            {entry.ended_at && (
              <>
                {" "}
                <span className="text-ink-400">←</span>{" "}
                {fmtTime(entry.ended_at)}
              </>
            )}
          </div>
          {entry.note && (
            <div className="text-[11px] text-ink-500 truncate mt-0.5">
              {entry.note}
            </div>
          )}
        </div>
        <span
          className={
            "text-xs tabular-nums font-medium " +
            (isOpen ? "text-danger" : "text-ink-700")
          }
        >
          {isOpen ? "פעיל" : fmtDuration(dur)}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover/log:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onStartEdit}
            className="p-1 rounded hover:bg-ink-200 text-ink-500 hover:text-ink-900"
            title="ערכי"
            aria-label="ערכי"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded hover:bg-ink-200 text-ink-500 hover:text-danger"
            title="מחקי"
            aria-label="מחקי"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  const submitEdit = () => {
    const patch: { started_at?: string; ended_at?: string; note?: string | null } = {};
    const newStart = fromLocalInputs(draftStart);
    if (newStart && newStart !== entry.started_at) patch.started_at = newStart;
    const newEnd = draftEnd.date && draftEnd.time ? fromLocalInputs(draftEnd) : null;
    if (newEnd !== entry.ended_at) {
      patch.ended_at = newEnd ?? undefined;
    }
    if (draftNote !== (entry.note ?? "")) patch.note = draftNote || null;
    if (Object.keys(patch).length === 0) {
      onCancelEdit();
      return;
    }
    onSave(patch);
  };

  return (
    <div className="px-4 py-3 bg-primary-50/40 border-y border-primary-200 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <DateTimeInputs
          label="התחלה"
          value={draftStart}
          onChange={setDraftStart}
        />
        <DateTimeInputs
          label="סיום"
          value={draftEnd}
          onChange={setDraftEnd}
        />
      </div>
      <input
        value={draftNote}
        onChange={(e) => setDraftNote(e.target.value)}
        placeholder="הערה (אופציונלי)"
        className="field py-1.5 text-xs"
      />
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={onCancelEdit}
          className="btn-ghost text-xs"
        >
          ביטול
        </button>
        <button
          type="button"
          onClick={submitEdit}
          className="btn-accent text-xs flex items-center gap-1"
        >
          <Check className="w-3.5 h-3.5" />
          שמרי
        </button>
      </div>
    </div>
  );
}

function DateTimeInputs({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { date: string; time: string };
  onChange: (v: { date: string; time: string }) => void;
}) {
  return (
    <div>
      <label className="eyebrow mb-1 block text-[10px]">{label}</label>
      <div className="grid grid-cols-2 gap-1">
        <input
          type="date"
          value={value.date}
          onChange={(e) => onChange({ ...value, date: e.target.value })}
          className="field py-1 text-xs"
        />
        <input
          type="time"
          value={value.time}
          onChange={(e) => onChange({ ...value, time: e.target.value })}
          className="field py-1 text-xs"
        />
      </div>
    </div>
  );
}

// ─── Datetime helpers ──────────────────────────────────────────────────────

function toLocalInputs(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function fromLocalInputs(v: { date: string; time: string }): string | null {
  if (!v.date || !v.time) return null;
  const d = new Date(`${v.date}T${v.time}:00`);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function deriveDuration(e: TimeEntry): number {
  if (!e.ended_at) return 0;
  return Math.max(
    0,
    Math.round(
      (new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) /
        1000
    )
  );
}

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
