import { useEffect, useMemo, useState } from "react";
import { Mic, ArrowLeft } from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { RecordingDropZone } from "@/components/recordings/RecordingDropZone";
import { RecordingCard } from "@/components/recordings/RecordingCard";
import { RecordingPlayer } from "@/components/recordings/RecordingPlayer";
import { RecorderModal } from "@/components/recordings/RecorderModal";
import { QuickRecordCard } from "@/components/recordings/QuickRecordCard";
import {
  RecordingFilters,
  DEFAULT_RECORDING_FILTERS,
  filterRecordings,
  type RecordingsFilterState,
} from "@/components/recordings/RecordingFilters";
import {
  DEFAULT_GROUPING,
  applyGrouping,
  type ListGroupingState,
} from "@/components/recordings/RecordingsListBanner";
import { useRecordings } from "@/lib/hooks/useRecordings";
import { useAllRecordingAssignments } from "@/lib/hooks/useRecordingLists";

export function Recordings() {
  const [filters, setFilters] = useState<RecordingsFilterState>(
    DEFAULT_RECORDING_FILTERS
  );
  const [grouping, setGrouping] = useState<ListGroupingState>(DEFAULT_GROUPING);
  // Always fetch with archived included; client-side filter then narrows.
  const { data: allRecordings = [], isLoading } = useRecordings({
    includeArchived: true,
  });
  const { data: assignments = [] } = useAllRecordingAssignments();

  const listsByRecording = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const a of assignments) {
      let s = m.get(a.recording_id);
      if (!s) {
        s = new Set();
        m.set(a.recording_id, s);
      }
      s.add(a.list_id);
    }
    return m;
  }, [assignments]);

  const recordings = useMemo(() => {
    const filtered = filterRecordings(allRecordings, filters);
    return applyGrouping(filtered, grouping, listsByRecording);
  }, [allRecordings, filters, listsByRecording, grouping]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recorderOpen, setRecorderOpen] = useState(false);

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
    () => allRecordings.reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0),
    [allRecordings]
  );

  const filteredOutCount = allRecordings.length - recordings.length;

  const clearFiltersAndGrouping = () => {
    setFilters(DEFAULT_RECORDING_FILTERS);
    setGrouping(DEFAULT_GROUPING);
  };

  return (
    <ScreenScaffold
      title="הקלטות"
      subtitle="הקלטה ישירה, גרירת קובץ, ניגון, הורדה ושיוך לפרויקט. תמלול עברית בפאזה הבאה."
      actions={
        allRecordings.length > 0 ? (
          <span className="chip">
            {allRecordings.length} הקלטות · {formatTotal(totalSeconds)}
          </span>
        ) : null
      }
    >
      <RecorderModal
        open={recorderOpen}
        onClose={() => setRecorderOpen(false)}
        onSaved={(id) => setSelectedId(id)}
        source="other"
      />

      <div className="space-y-5">
        {/* 3-column banner (RTL leading edge → right):
            Filters | QuickRecord | DropZone
            All three are sized to match (compact, centered content). */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <RecordingFilters
            filters={filters}
            onFiltersChange={setFilters}
            grouping={grouping}
            onGroupingChange={setGrouping}
          />
          <QuickRecordCard onStart={() => setRecorderOpen(true)} />
          <RecordingDropZone
            source="other"
            onUploaded={(id) => setSelectedId(id)}
          />
        </div>

        {isLoading ? (
          <div className="card p-8 text-center text-sm text-ink-500">טוענת…</div>
        ) : allRecordings.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] gap-4">
            {/* List sits on the leading (right) edge in RTL */}
            <aside className="space-y-2">
              {recordings.length === 0 ? (
                <FilteredEmpty
                  total={allRecordings.length}
                  hidden={filteredOutCount}
                  onClear={clearFiltersAndGrouping}
                />
              ) : (
                recordings.map((r) => (
                  <RecordingCard
                    key={r.id}
                    recording={r}
                    isActive={r.id === selectedId}
                    onSelect={() => setSelectedId(r.id)}
                  />
                ))
              )}
            </aside>

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
        גררי קובץ אודיו לאזור למעלה, או הקליטי ישירות מ"הקלטה מהירה".
      </p>
      <p className="mt-3 text-[11px] text-ink-400 inline-flex items-center gap-1">
        <ArrowLeft className="w-3 h-3" />
        אפשר גם דרך המיקרופון ב-Topbar
      </p>
    </div>
  );
}

function FilteredEmpty({
  total,
  hidden,
  onClear,
}: {
  total: number;
  hidden: number;
  onClear: () => void;
}) {
  return (
    <div className="card p-5 text-center space-y-2">
      <p className="text-sm font-medium text-ink-800">אין הקלטות בסינון זה</p>
      <p className="text-xs text-ink-500">
        {hidden} מתוך {total} הקלטות מוסתרות.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="btn-outline !py-1.5 !px-3 !text-xs"
      >
        נקי סינון
      </button>
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
