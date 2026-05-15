import { useMemo, useState } from "react";
import { Check, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useTasks, useUpdateTask } from "@/lib/hooks/useTasks";
import { pushUndo } from "@/lib/undo/store";
import {
  useCreateManualTimeEntry,
  useDeleteTimeEntry,
  useTimeEntriesByRange,
} from "@/lib/hooks/useTimer";
import { computeGoalStats } from "@/lib/goals/computation";
import type { Task, TimeEntry } from "@/lib/types/domain";

// =============================================================================
// "פעימות בלי זמן" — for every goal that's set to track time, list each
// completed beat that has no time-entry on the same day. Two quick actions:
//   • Enter actual minutes inline → creates a manual time-entry for that day.
//   • "כאן זמן לא רלוונטי" → flips the task's goal_track_time to false so the
//     reminder is silenced for that task forever (until the user re-enables
//     it from the task editor).
// =============================================================================

interface BeatRow {
  task: Task;
  /** Local-day Date (start-of-day for the beat). */
  beatAt: Date;
  /** Default minutes the input is seeded with — task.duration_minutes. */
  defaultMinutes: number;
}

export function MissingBeatTime() {
  const { data: tasks = [] } = useTasks();
  const range = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 30);
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    };
  }, []);
  const { data: entries = [] } = useTimeEntriesByRange(range);

  const beats = useMemo((): BeatRow[] => {
    const entriesByTask = new Map<string, TimeEntry[]>();
    for (const e of entries) {
      let arr = entriesByTask.get(e.task_id);
      if (!arr) {
        arr = [];
        entriesByTask.set(e.task_id, arr);
      }
      arr.push(e);
    }
    const out: BeatRow[] = [];
    for (const task of tasks) {
      if (!task.goal_period || !task.goal_track_time) continue;
      if (!task.duration_minutes || task.duration_minutes <= 0) continue;
      const stats = computeGoalStats(task, entriesByTask.get(task.id) ?? []);
      if (!stats) continue;
      for (const d of stats.beatsWithoutTime) {
        out.push({
          task,
          beatAt: d,
          defaultMinutes: task.duration_minutes,
        });
      }
    }
    // Most recent beats first — the user's freshest memories.
    out.sort((a, b) => b.beatAt.getTime() - a.beatAt.getTime());
    return out;
  }, [tasks, entries]);

  return (
    <div className="card p-3 h-full flex flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-ink-900 inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          פעימות בלי זמן
        </h3>
        {beats.length > 0 && (
          <span className="text-[11px] text-ink-500">
            {beats.length} פעימות ממתינות
          </span>
        )}
      </header>

      {beats.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center text-xs text-ink-500 px-3">
          הכל מסונכרן — כל פעימה של היעדים שלך תועדה גם בזמן.
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto -mx-1 px-1 divide-y divide-ink-100">
          {beats.map((b) => (
            <BeatRowItem
              key={`${b.task.id}:${b.beatAt.getTime()}`}
              row={b}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// =============================================================================
// Single beat row
// =============================================================================

function BeatRowItem({ row }: { row: BeatRow }) {
  const { task, beatAt, defaultMinutes } = row;
  const createEntry = useCreateManualTimeEntry();
  const deleteEntry = useDeleteTimeEntry();
  const updateTask = useUpdateTask();
  const [minutes, setMinutes] = useState<string>(String(defaultMinutes));
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"saved" | "muted" | null>(null);

  const handleFill = async () => {
    const m = Math.max(1, Math.round(Number(minutes) || 0));
    if (m <= 0) return;
    setBusy(true);
    try {
      const start = new Date(beatAt);
      start.setHours(12, 0, 0, 0);
      const end = new Date(start.getTime() + m * 60_000);
      const payload = {
        task_id: task.id,
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        note: "מילוי בדיעבד מהדשבורד",
      };
      const created = await createEntry.mutateAsync(payload);
      let currentId = created.id;
      pushUndo({
        description: "מילוי פעימה בדיעבד",
        undo: () =>
          deleteEntry.mutate({ entryId: currentId, taskId: task.id }),
        redo: async () => {
          const again = await createEntry.mutateAsync(payload);
          currentId = again.id;
        },
      });
      setDone("saved");
    } finally {
      setBusy(false);
    }
  };

  const handleMute = async () => {
    setBusy(true);
    try {
      const prev = task.goal_track_time;
      await updateTask.mutateAsync({
        taskId: task.id,
        patch: { goal_track_time: false },
      });
      pushUndo({
        description: "השתקת מעקב זמן למשימה",
        undo: () =>
          updateTask.mutate({
            taskId: task.id,
            patch: { goal_track_time: prev },
          }),
        redo: () =>
          updateTask.mutate({
            taskId: task.id,
            patch: { goal_track_time: false },
          }),
      });
      setDone("muted");
    } finally {
      setBusy(false);
    }
  };

  if (done === "saved") {
    return (
      <li className="flex items-center gap-2 py-1.5 text-[12px] text-success-700">
        <Check className="w-3.5 h-3.5" /> נשמרו {minutes} דק' עבור "{task.title}".
      </li>
    );
  }
  if (done === "muted") {
    return (
      <li className="flex items-center gap-2 py-1.5 text-[12px] text-ink-500">
        <X className="w-3.5 h-3.5" /> "{task.title}" — לא נצק עוד תזכורות זמן.
      </li>
    );
  }

  return (
    <li className="py-1.5 flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-ink-900 truncate">{task.title}</div>
        <div className="text-[11px] text-ink-500">{formatHe(beatAt)}</div>
      </div>
      <input
        type="number"
        min={1}
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
        disabled={busy}
        className="field text-xs py-1 w-16 tabular-nums"
        aria-label="דקות בפועל"
      />
      <span className="text-[11px] text-ink-500">דק'</span>
      <button
        type="button"
        onClick={handleFill}
        disabled={busy}
        className={cn(
          "p-1 rounded-md text-success-700 hover:bg-success-50 disabled:opacity-50"
        )}
        title="שמור"
      >
        <Check className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={handleMute}
        disabled={busy}
        className="text-[11px] text-ink-500 hover:text-ink-900 underline-offset-2 hover:underline disabled:opacity-50"
        title="כבה תזכורות זמן עבור משימה זו"
      >
        לא רלוונטי
      </button>
    </li>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatHe(d: Date): string {
  return d.toLocaleDateString("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
