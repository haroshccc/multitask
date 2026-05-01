import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Settings as SettingsIcon } from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import {
  DashboardGrid,
  type WidgetDefinition,
} from "@/components/dashboard/DashboardGrid";
import { RecorderModal } from "@/components/recordings/RecorderModal";
import { AiPromptsDialog } from "@/components/recordings/AiPromptsDialog";
import {
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
import {
  RecordingsPageContext,
  type RecordingsPageCtx,
} from "@/components/recordings/widgets/context";
import { FiltersAndListWidget } from "@/components/recordings/widgets/FiltersAndListWidget";
import { QuickRecordTallWidget } from "@/components/recordings/widgets/QuickRecordTallWidget";
import { UploadTallWidget } from "@/components/recordings/widgets/UploadTallWidget";
import { PlayerWidget } from "@/components/recordings/widgets/PlayerWidget";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 640,
  );
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return isMobile;
}

/**
 * Recordings page — fixed layout (banner positions are not user-editable
 * anywhere in the app; see DashboardGrid).
 *
 * Visual layout (intent frame: x=0 = visual right in RTL):
 *   ┌────────────┬─────────────┬──────────────┐
 *   │ Stats+     │ Quick       │ Upload       │  ← single-row strip (h=1)
 *   │ Filters    ├─────────────┴──────────────┤
 *   │  + List    │                            │
 *   │ (tall col) │           Player           │
 *   └────────────┴────────────────────────────┘
 *
 *   filters_list:  x=0, y=0, w=3, h=11  (stats embedded inside)
 *   quick_record:  x=3, y=0, w=4, h=1
 *   upload:        x=7, y=0, w=5, h=1
 *   player:        x=3, y=1, w=9, h=10
 */
const RECORDINGS_WIDGETS: WidgetDefinition[] = [
  {
    key: "filters_list",
    title: "סינון ורשימה",
    component: FiltersAndListWidget,
    chromeStyle: "bare",
    defaultDesktop: { x: 0, y: 0, w: 3, h: 11, minW: 3, minH: 6 },
    defaultTablet: { x: 0, y: 0, w: 8, h: 6 },
    defaultMobile: { x: 0, y: 0, w: 4, h: 2 },
  },
  {
    key: "quick_record",
    title: "הקלטה מהירה",
    component: QuickRecordTallWidget,
    chromeStyle: "bare",
    defaultDesktop: { x: 3, y: 0, w: 4, h: 1, minW: 3, minH: 1 },
    defaultTablet: { x: 0, y: 6, w: 4, h: 1 },
    defaultMobile: { x: 0, y: 2, w: 2, h: 1 },
  },
  {
    key: "upload",
    title: "העלאת קובץ",
    component: UploadTallWidget,
    chromeStyle: "bare",
    defaultDesktop: { x: 7, y: 0, w: 5, h: 1, minW: 3, minH: 1 },
    defaultTablet: { x: 4, y: 6, w: 4, h: 1 },
    defaultMobile: { x: 2, y: 2, w: 2, h: 1 },
  },
  {
    key: "player",
    title: "נגן ההקלטה",
    component: PlayerWidget,
    chromeStyle: "bare",
    defaultDesktop: { x: 3, y: 1, w: 9, h: 10, minW: 6, minH: 5 },
    defaultTablet: { x: 0, y: 7, w: 8, h: 10 },
    defaultMobile: { x: 0, y: 3, w: 4, h: 8 },
  },
];

export function Recordings() {
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState<RecordingsFilterState>(
    DEFAULT_RECORDING_FILTERS,
  );
  const [grouping, setGrouping] = useState<ListGroupingState>(DEFAULT_GROUPING);
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

  const filteredRecordings = useMemo(() => {
    const filtered = filterRecordings(allRecordings, filters);
    return applyGrouping(filtered, grouping, listsByRecording);
  }, [allRecordings, filters, listsByRecording, grouping]);

  // Honor `?id=...` from the URL — used by deep links from the project page's
  // recordings list. Cleared once consumed so reload doesn't re-force it.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialIdFromUrl = searchParams.get("id");
  const [selectedId, setSelectedId] = useState<string | null>(initialIdFromUrl);
  useEffect(() => {
    if (initialIdFromUrl && initialIdFromUrl !== selectedId) {
      setSelectedId(initialIdFromUrl);
      const next = new URLSearchParams(searchParams);
      next.delete("id");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIdFromUrl]);

  const [recorderOpen, setRecorderOpen] = useState(false);
  const [aiPromptsOpen, setAiPromptsOpen] = useState(false);

  // Auto-select most recent on first load + keep a valid selection.
  useEffect(() => {
    if (filteredRecordings.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (
      selectedId == null ||
      !filteredRecordings.some((r) => r.id === selectedId)
    ) {
      setSelectedId(filteredRecordings[0].id);
    }
  }, [filteredRecordings, selectedId]);

  const totalSeconds = useMemo(
    () => allRecordings.reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0),
    [allRecordings],
  );

  const ctx = useMemo<RecordingsPageCtx>(
    () => ({
      allRecordings,
      filteredRecordings,
      isLoading,
      listsByRecording,
      filters,
      setFilters,
      grouping,
      setGrouping,
      clearAll: () => {
        setFilters(DEFAULT_RECORDING_FILTERS);
        setGrouping(DEFAULT_GROUPING);
      },
      selectedId,
      setSelectedId,
      onStartRecording: () => setRecorderOpen(true),
      onUploaded: (id: string) => setSelectedId(id),
    }),
    [
      allRecordings,
      filteredRecordings,
      isLoading,
      listsByRecording,
      filters,
      grouping,
      selectedId,
    ],
  );

  return (
    <RecordingsPageContext.Provider value={ctx}>
      <ScreenScaffold
        title="הקלטות"
        subtitle="הקלטה ישירה, גרירת קובץ, ניגון, הורדה ושיוך לפרויקט."
        actions={
          <span className="inline-flex items-center gap-2">
            {allRecordings.length > 0 && (
              <span className="chip">
                {allRecordings.length} הקלטות · {formatTotal(totalSeconds)}
              </span>
            )}
            <button
              type="button"
              onClick={() => setAiPromptsOpen(true)}
              className="p-1.5 rounded-md hover:bg-ink-100 text-ink-600"
              title="הנחיות Claude לעיבוד הקלטות"
              aria-label="הגדרות AI"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </span>
        }
      >
        <AiPromptsDialog
          open={aiPromptsOpen}
          onClose={() => setAiPromptsOpen(false)}
        />

        <RecorderModal
          open={recorderOpen}
          onClose={() => setRecorderOpen(false)}
          onSaved={(id) => setSelectedId(id)}
          source="other"
        />

        {isMobile ? (
          <div className="mt-5 flex flex-col gap-2">
            <FiltersAndListWidget />
            <div className="grid grid-cols-2 gap-2 h-14">
              <QuickRecordTallWidget />
              <UploadTallWidget />
            </div>
            <div className="min-h-[600px]">
              <PlayerWidget />
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <DashboardGrid
              screenKey="recordings"
              widgets={RECORDINGS_WIDGETS}
            />
          </div>
        )}
      </ScreenScaffold>
    </RecordingsPageContext.Provider>
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
