import { useEffect, useMemo, useState } from "react";
import { Mic, ArrowLeft } from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { RecordingDropZone } from "@/components/recordings/RecordingDropZone";
import { RecordingCard } from "@/components/recordings/RecordingCard";
import { RecordingPlayer } from "@/components/recordings/RecordingPlayer";
import { useRecordings } from "@/lib/hooks/useRecordings";

export function Recordings() {
  const { data: recordings = [], isLoading } = useRecordings();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Auto-select most recent on first load + keep a valid selection on the list.
  useEffect(() => {
    if (recordings.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (selectedId == null || !recordings.some((r) => r.id === selectedId)) {
      setSelectedId(recordings[0].id);
    }
  }, [recordings, selectedId]);

  const selected = useMemo(
    () => recordings.find((r) => r.id === selectedId) ?? null,
    [recordings, selectedId]
  );

  const totalSeconds = useMemo(
    () => recordings.reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0),
    [recordings]
  );

  return (
    <ScreenScaffold
      title="הקלטות"
      subtitle="העלאה, ניגון, ותיוג. תמלול עברית והפרדת דוברים יחוברו בפאזה 6ב."
      actions={
        recordings.length > 0 ? (
          <span className="chip">
            {recordings.length} הקלטות · {formatTotal(totalSeconds)}
          </span>
        ) : null
      }
    >
      <div className="space-y-5">
        <RecordingDropZone
          source="other"
          onUploaded={(id) => setSelectedId(id)}
        />

        {isLoading ? (
          <div className="card p-8 text-center text-sm text-ink-500">טוענת…</div>
        ) : recordings.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] gap-4">
            {/* List (RTL leading edge → right column) */}
            <aside className="space-y-2">
              {recordings.map((r) => (
                <RecordingCard
                  key={r.id}
                  recording={r}
                  isActive={r.id === selectedId}
                  onSelect={() => setSelectedId(r.id)}
                />
              ))}
            </aside>

            {/* Detail */}
            <section>
              {selected ? (
                <RecordingPlayer key={selected.id} recording={selected} />
              ) : (
                <div className="card p-6 text-center text-sm text-ink-500">
                  בחרי הקלטה מהרשימה
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </ScreenScaffold>
  );
}

function EmptyState() {
  return (
    <div className="card p-8 sm:p-12 text-center">
      <div className="mx-auto w-14 h-14 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mb-3">
        <Mic className="w-7 h-7" />
      </div>
      <h2 className="text-lg font-semibold text-ink-900">עוד אין הקלטות</h2>
      <p className="text-sm text-ink-600 mt-1 max-w-md mx-auto leading-relaxed">
        גררי קובץ אודיו לאזור למעלה, או הקליטי ישירות מכפתור היצירה המהירה
        בפינה.
      </p>
      <p className="mt-3 text-[11px] text-ink-400 inline-flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" />
        אפשר גם דרך המיקרופון ב-Topbar
      </p>
    </div>
  );
}

function formatTotal(seconds: number) {
  if (seconds < 60) return `${seconds} שנ׳`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} דק׳`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h} שע׳` : `${h}:${String(mm).padStart(2, "0")} שע׳`;
}
