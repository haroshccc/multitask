import { useMemo } from "react";
import { Mic, ArrowLeft } from "lucide-react";
import { RecordingPlayer } from "@/components/recordings/RecordingPlayer";
import { useRecording } from "@/lib/hooks/useRecordings";
import { useRecordingsPageCtx } from "./context";

/**
 * Center column: shows the selected recording's full player. Falls back to
 * an empty state when there are no recordings yet, or a "select one" hint
 * when the filtered list is empty / nothing is picked.
 */
export function PlayerWidget() {
  const ctx = useRecordingsPageCtx();
  // The list rows are intentionally light (no `transcript_json` — see
  // `listRecordings`). The detail view needs the full row, so fetch it by id.
  // We fall back to the light list row while that fetch is in flight so the
  // player still renders immediately on selection.
  const listRow = useMemo(
    () =>
      ctx.filteredRecordings.find((r) => r.id === ctx.selectedId) ?? null,
    [ctx.filteredRecordings, ctx.selectedId],
  );
  const { data: full } = useRecording(ctx.selectedId);
  const selected = full ?? listRow;

  if (ctx.isLoading) {
    return (
      <div className="card h-full p-8 text-center text-sm text-ink-500 flex items-center justify-center">
        טוענת…
      </div>
    );
  }

  if (ctx.allRecordings.length === 0) {
    return <EmptyState />;
  }

  if (!selected) {
    return (
      <div className="card h-full p-8 text-center text-sm text-ink-500 flex items-center justify-center">
        בחרי הקלטה מהרשימה
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto scrollbar-thin">
      <RecordingPlayer key={selected.id} recording={selected} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card h-full p-8 sm:p-12 text-center flex flex-col items-center justify-center">
      <div className="mx-auto w-14 h-14 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mb-3">
        <Mic className="w-7 h-7" />
      </div>
      <h2 className="text-lg font-semibold text-ink-900">עוד אין הקלטות</h2>
      <p className="text-sm text-ink-600 mt-1 max-w-md mx-auto leading-relaxed">
        גררי קובץ אודיו לבאנר ההעלאה, או הקליטי ישירות.
      </p>
      <p className="mt-3 text-[11px] text-ink-400 inline-flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" />
        אפשר גם דרך המיקרופון ב-Topbar
      </p>
    </div>
  );
}
