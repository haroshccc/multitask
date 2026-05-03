import { useMemo, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  GitBranch,
  ArrowLeft,
  Clock,
} from "lucide-react";
import {
  useUpdateTask,
  useRecordProposalDecision,
} from "@/lib/hooks";
import { cn } from "@/lib/utils/cn";
import type {
  DailyBrief,
  Proposal,
  ProposalDecision,
  ReorderDayPayload,
} from "@/lib/types/domain";

interface Props {
  proposal: Proposal & { kind: "reorder_day"; payload: ReorderDayPayload };
  brief: DailyBrief;
  decision?: ProposalDecision;
}

type RowState = {
  task_id: string;
  task_title: string;
  current_scheduled_at: string | null;
  new_scheduled_at: string;
  duration_minutes: number | null;
  selected: boolean;
};

/**
 * Specialized card for `reorder_day` proposals. The AI returns an array of
 * (task_id, new_scheduled_at) — we sort by the new time and render it as a
 * day-agenda where every row has:
 *   - checkbox (per-task approval)
 *   - "old → new" diff
 *   - inline datetime editor
 *
 * Approve only the checked rows. If the user unchecks any, we record the
 * decision as "edited" with the trimmed payload.
 */
export function ReorderDayCard({ proposal, brief, decision }: Props) {
  const updateTask = useUpdateTask();
  const recordDecision = useRecordProposalDecision();

  const initialRows = useMemo<RowState[]>(() => {
    const moves = proposal.payload.moves ?? [];
    const sorted = [...moves].sort((a, b) =>
      a.new_scheduled_at.localeCompare(b.new_scheduled_at)
    );
    return sorted.map((m) => ({
      task_id: m.task_id,
      task_title: m.task_title ?? `task:${m.task_id.slice(0, 6)}`,
      current_scheduled_at: m.current_scheduled_at ?? null,
      new_scheduled_at: m.new_scheduled_at,
      duration_minutes: m.duration_minutes ?? null,
      selected: true,
    }));
  }, [proposal]);

  const [rows, setRows] = useState<RowState[]>(initialRows);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isApproved = decision?.state === "approved" || decision?.state === "edited";
  const isDismissed = decision?.state === "dismissed";

  if (isApproved || isDismissed) {
    return (
      <DecisionRow
        title="סידור היום"
        approved={isApproved}
        appliedAt={decision?.applied_at}
        count={
          decision?.edited_payload
            ? (decision.edited_payload as ReorderDayPayload).moves.length
            : proposal.payload.moves.length
        }
      />
    );
  }

  const selectedCount = rows.filter((r) => r.selected).length;
  const allSelected = selectedCount === rows.length;
  const anyEdited = rows.some(
    (r, i) => r.new_scheduled_at !== initialRows[i].new_scheduled_at
  );

  function setRow(index: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  async function handleApprove() {
    const selectedRows = rows.filter((r) => r.selected);
    if (selectedRows.length === 0) return;
    setBusy(true);
    setError(null);
    const wasEdited = !allSelected || anyEdited;
    try {
      for (const r of selectedRows) {
        await updateTask.mutateAsync({
          taskId: r.task_id,
          patch: { scheduled_at: r.new_scheduled_at },
        });
      }
      const editedPayload: ReorderDayPayload = {
        moves: selectedRows.map((r) => ({
          task_id: r.task_id,
          new_scheduled_at: r.new_scheduled_at,
          task_title: r.task_title,
          current_scheduled_at: r.current_scheduled_at,
          duration_minutes: r.duration_minutes,
        })),
      };
      await recordDecision.mutateAsync({
        brief,
        proposalId: proposal.id,
        decision: {
          state: wasEdited ? "edited" : "approved",
          applied_at: new Date().toISOString(),
          ...(wasEdited ? { edited_payload: editedPayload } : {}),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDismiss() {
    setBusy(true);
    setError(null);
    try {
      await recordDecision.mutateAsync({
        brief,
        proposalId: proposal.id,
        decision: { state: "dismissed" },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // Group rows by day so a multi-day reorder still reads cleanly.
  const groupedByDay = new Map<string, Array<{ row: RowState; index: number }>>();
  rows.forEach((row, index) => {
    const dayKey = row.new_scheduled_at.slice(0, 10);
    if (!groupedByDay.has(dayKey)) groupedByDay.set(dayKey, []);
    groupedByDay.get(dayKey)!.push({ row, index });
  });

  return (
    <div
      className={cn(
        "rounded-lg border border-emerald-200 bg-gradient-to-l from-emerald-50/60 to-cyan-50/30 p-3",
        busy && "opacity-60 pointer-events-none"
      )}
    >
      <header className="flex items-center gap-1.5 mb-2">
        <GitBranch className="w-3.5 h-3.5 text-emerald-700" />
        <span className="text-[11px] font-semibold text-ink-900">סידור היום המוצע</span>
        <span className="ms-auto text-[10px] text-ink-500">
          {selectedCount}/{rows.length} מסומנות
        </span>
      </header>

      <p className="text-[11px] text-ink-600 italic mb-2.5">{proposal.reason}</p>

      <div className="space-y-3">
        {Array.from(groupedByDay.entries()).map(([dayKey, items]) => (
          <div key={dayKey} className="space-y-1">
            <div className="text-[10px] font-semibold text-ink-500 uppercase tracking-wide ps-1">
              {fmtDayLabel(dayKey)}
            </div>
            <div className="bg-white border border-ink-200 rounded-md overflow-hidden">
              {items.map(({ row, index }, i) => (
                <ReorderRow
                  key={row.task_id}
                  row={row}
                  isLast={i === items.length - 1}
                  onToggle={() => setRow(index, { selected: !row.selected })}
                  onTimeChange={(newIso) =>
                    setRow(index, { new_scheduled_at: newIso })
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded p-1.5 mt-2">
          {error}
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap mt-3">
        <button
          type="button"
          onClick={handleApprove}
          disabled={busy || selectedCount === 0}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors",
            "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600",
            (busy || selectedCount === 0) && "opacity-60 cursor-not-allowed"
          )}
        >
          {busy ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3 h-3" />
          )}
          {selectedCount === rows.length
            ? "אשר את כל הסידור"
            : `אשר ${selectedCount} מסומנות`}
        </button>
        <button
          type="button"
          onClick={() =>
            setRows((prev) =>
              prev.map((r) => ({ ...r, selected: !allSelected }))
            )
          }
          disabled={busy}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border bg-white hover:bg-ink-50 text-ink-700 border-ink-300"
        >
          {allSelected ? "בטל הכל" : "סמן הכל"}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={busy}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border bg-white hover:bg-rose-50 text-rose-700 border-rose-300 ms-auto"
        >
          <XCircle className="w-3 h-3" />
          דחה הכל
        </button>
      </div>
    </div>
  );
}

function ReorderRow({
  row,
  isLast,
  onToggle,
  onTimeChange,
}: {
  row: RowState;
  isLast: boolean;
  onToggle: () => void;
  onTimeChange: (newIso: string) => void;
}) {
  const oldTime = row.current_scheduled_at
    ? fmtTimeOnly(row.current_scheduled_at)
    : "ללא תזמון";
  const newTime = fmtTimeOnly(row.new_scheduled_at);
  const changed = row.current_scheduled_at !== row.new_scheduled_at;

  return (
    <label
      className={cn(
        "flex items-center gap-2 p-2 cursor-pointer hover:bg-ink-50/60 transition-colors",
        !isLast && "border-b border-ink-100",
        !row.selected && "opacity-50"
      )}
    >
      <input
        type="checkbox"
        checked={row.selected}
        onChange={onToggle}
        className="w-3.5 h-3.5 accent-emerald-600 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-ink-900 truncate">
          {row.task_title}
        </div>
        <div className="flex items-center gap-1 mt-0.5 text-[10px] text-ink-500">
          {changed && row.current_scheduled_at && (
            <>
              <span className="line-through">{oldTime}</span>
              <ArrowLeft className="w-2.5 h-2.5" />
            </>
          )}
          {!row.current_scheduled_at && (
            <>
              <span className="italic">{oldTime}</span>
              <ArrowLeft className="w-2.5 h-2.5" />
            </>
          )}
          <span className="font-semibold text-emerald-700">{newTime}</span>
          {row.duration_minutes ? (
            <span className="text-ink-400">· {row.duration_minutes} דק׳</span>
          ) : null}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-1">
        <Clock className="w-3 h-3 text-ink-400" />
        <input
          type="datetime-local"
          value={toLocalInput(row.new_scheduled_at)}
          onChange={(e) => onTimeChange(fromLocalInput(e.target.value))}
          onClick={(e) => e.stopPropagation()}
          disabled={!row.selected}
          className="text-[10px] border border-ink-200 rounded px-1.5 py-0.5 bg-white"
        />
      </div>
    </label>
  );
}

function DecisionRow({
  title,
  approved,
  appliedAt,
  count,
}: {
  title: string;
  approved: boolean;
  appliedAt?: string;
  count: number;
}) {
  const cls = approved
    ? "border-emerald-200 bg-emerald-50/40 text-emerald-900"
    : "border-ink-200 bg-ink-50/40 text-ink-500";
  const Icon = approved ? CheckCircle2 : XCircle;
  return (
    <div
      className={cn("rounded-lg border p-2 flex items-center gap-2 text-xs", cls)}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <div className="flex-1 min-w-0 truncate">
        <span className="font-semibold">{title}:</span>{" "}
        {approved ? `הוחל על ${count} משימות` : "נדחה"}
      </div>
      {approved && appliedAt && (
        <span className="text-[10px] tabular-nums shrink-0 opacity-70">
          {new Date(appliedAt).toLocaleTimeString("he-IL", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      )}
    </div>
  );
}

function fmtDayLabel(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

function fmtTimeOnly(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const tzOff = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tzOff).toISOString().slice(0, 16);
}

function fromLocalInput(local: string): string {
  if (!local) return "";
  return new Date(local).toISOString();
}
