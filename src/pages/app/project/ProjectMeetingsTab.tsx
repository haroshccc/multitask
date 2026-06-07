import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Loader2,
  CalendarClock,
  CalendarPlus,
  Mic,
  Trash2,
  X,
  ExternalLink,
  Table2,
  LayoutGrid,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { useProjectContext } from "@/pages/app/ProjectShell";
import {
  useProjectMeetings,
  useCreateProjectMeeting,
  useSaveProjectMeeting,
  useDeleteProjectMeeting,
  useMeetingTaskLinks,
  useLinkMeetingTask,
  useUnlinkMeetingTask,
  type ProjectMeeting,
} from "@/lib/hooks/useProjectMeetings";
import { useUpdateProjectMeeting } from "@/lib/hooks/useProjectMeetings";
import { useTasksByProject } from "@/lib/hooks/useTasks";
import { useRecordings } from "@/lib/hooks/useRecordings";
import {
  useProjectCustomFields,
  useCreateCustomField,
  useUpdateCustomField,
  useDeleteCustomField,
} from "@/lib/hooks/useTaskCustomFields";
import { useEntityColumns } from "@/lib/hooks/useEntityColumns";
import { useEntityColumnVisibility } from "@/lib/hooks/useEntityColumnVisibility";
import {
  buildGridCols,
  buildGridMinWidth,
  type FixedColumnDescriptor,
} from "@/components/configurable-table/gridLayout";
import { TableHeader } from "@/components/configurable-table/ConfigurableTableHeader";
import {
  ColumnsMenu,
  type ColumnsMenuItem,
} from "@/components/configurable-table/ColumnsMenu";
import { ExportExcelButton } from "@/components/configurable-table/ExportExcelButton";
import { buildMeetingsSheet } from "@/lib/export/projectSheets";
import {
  DynCell,
  OptionsEditorModal,
  readCustomField,
  writeCustomField,
  type SelectOption,
} from "@/components/configurable-table/fieldCells";
import type {
  CustomFieldType,
  TaskCustomField,
} from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

const VIEW_KEY = "multitask.projectMeetings.view";
type ViewMode = "table" | "cards";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "scheduled", label: "מתוכננת" },
  { value: "done", label: "התקיימה" },
  { value: "cancelled", label: "בוטלה" },
];
const STATUS_LABEL = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label])
);

const pad2 = (n: number) => String(n).padStart(2, "0");

function splitLocal(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}
function combineLocal(date: string, time: string): string | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d!, hh || 0, mm || 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}
function formatWhen(iso: string | null, allDay: boolean): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("he-IL", {
    day: "numeric",
    month: "short",
    ...(allDay ? {} : { hour: "2-digit", minute: "2-digit" }),
  });
}

// ── Configurable-table column model for the meetings table view ──────────────
// Meetings reuse the same CSS-grid configurable table as tasks, but with no
// control columns (no drag/expand/checkbox), no sub-rows, and a small actions
// column for the delete button. Fixed columns are renamable/reorderable via
// `useEntityColumns({ entityType: "meeting" })`.
type MeetingFixedKey = "title" | "when" | "status" | "tasks" | "recording";

const MEETING_FIXED_DESCRIPTORS: FixedColumnDescriptor<MeetingFixedKey>[] = [
  {
    key: "title",
    width: "minmax(160px, 1fr)",
    defaultLabel: "פגישה",
    align: "start",
    sortable: false,
    sortKey: null,
  },
  {
    key: "when",
    width: "minmax(120px, 0.5fr)",
    defaultLabel: "מתי",
    align: "start",
    sortable: false,
    sortKey: null,
  },
  {
    key: "status",
    width: "90px",
    defaultLabel: "סטטוס",
    align: "start",
    sortable: false,
    sortKey: null,
  },
  {
    key: "tasks",
    width: "70px",
    defaultLabel: "משימות",
    align: "start",
    sortable: false,
    sortKey: null,
  },
  {
    key: "recording",
    width: "120px",
    defaultLabel: "הקלטה",
    align: "start",
    sortable: false,
    sortKey: null,
  },
];

const MEETING_FIXED_WIDTHS = Object.fromEntries(
  MEETING_FIXED_DESCRIPTORS.map((d) => [d.key, d.width])
) as Record<MeetingFixedKey, string>;

const MEETING_CONTROL_COLS = ""; // meetings have no drag/expand/checkbox chrome
const MEETING_ACTIONS_COL = "40px"; // delete button
const MEETING_DYN_COL_WIDTH = 160;
const MEETING_CONTROL_AND_ACTIONS_WIDTH = 40;

export function ProjectMeetingsTab() {
  const { projectId } = useProjectContext();
  const { data: meetings = [], isLoading } = useProjectMeetings(projectId);
  const { data: links = [] } = useMeetingTaskLinks(projectId);
  const createMeeting = useCreateProjectMeeting();
  const [openId, setOpenId] = useState<string | null>(null);

  // Configurable custom columns (meeting entity).
  const { data: customFields = [] } = useProjectCustomFields(
    projectId,
    "meeting"
  );
  const createField = useCreateCustomField();
  const updateField = useUpdateCustomField();
  const deleteField = useDeleteCustomField();
  const updateMeeting = useUpdateProjectMeeting();
  const { fixedLabels, orderedKeys, renameFixed, reorderFixed } =
    useEntityColumns<MeetingFixedKey>({
      entityType: "meeting",
      projectId,
      descriptors: MEETING_FIXED_DESCRIPTORS,
    });
  const { hiddenIds, toggleHidden } = useEntityColumnVisibility({
    entityType: "meeting",
    projectId,
  });
  const [optionsFieldId, setOptionsFieldId] = useState<string | null>(null);
  const optionsField = useMemo(
    () => customFields.find((f) => f.id === optionsFieldId) ?? null,
    [customFields, optionsFieldId]
  );

  // Visible (non-hidden) columns drive the table; the full lists drive the
  // "עמודות" menu so hidden columns can be toggled back on.
  const visibleKeys = useMemo(
    () => orderedKeys.filter((k) => !hiddenIds.has(k)),
    [orderedKeys, hiddenIds]
  );
  const visibleFields = useMemo(
    () => customFields.filter((f) => !hiddenIds.has(f.id)),
    [customFields, hiddenIds]
  );
  const columnMenuItems = useMemo<ColumnsMenuItem[]>(
    () => [
      ...orderedKeys.map((k) => ({
        id: k,
        kind: "fixed" as const,
        label:
          fixedLabels[k] ??
          MEETING_FIXED_DESCRIPTORS.find((d) => d.key === k)?.defaultLabel ??
          k,
      })),
      ...customFields.map((f) => ({
        id: f.id,
        kind: "custom" as const,
        label: f.field_label,
      })),
    ],
    [orderedKeys, customFields, fixedLabels]
  );

  const orderedDescriptors = useMemo(
    () =>
      visibleKeys.map((k) => MEETING_FIXED_DESCRIPTORS.find((d) => d.key === k)!),
    [visibleKeys]
  );

  const gridCols = useMemo(
    () =>
      buildGridCols(visibleKeys, visibleFields.length, MEETING_FIXED_WIDTHS, {
        controlCols: MEETING_CONTROL_COLS,
        actionsCol: MEETING_ACTIONS_COL,
        dynColWidth: MEETING_DYN_COL_WIDTH,
      }),
    [visibleKeys, visibleFields.length]
  );
  const gridMinWidth = useMemo(
    () =>
      buildGridMinWidth(visibleKeys, visibleFields.length, MEETING_FIXED_WIDTHS, {
        controlAndActionsWidth: MEETING_CONTROL_AND_ACTIONS_WIDTH,
        dynColWidth: MEETING_DYN_COL_WIDTH,
      }),
    [visibleKeys, visibleFields.length]
  );

  const handleAddField = (type: CustomFieldType, label: string) => {
    if (!projectId) return;
    const fieldKey = `f_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    createField.mutate({
      project_id: projectId,
      field_key: fieldKey,
      field_label: label,
      field_type: type,
      is_visible: true,
      entity_type: "meeting",
    });
  };
  const handleRenameField = (fieldId: string, label: string) =>
    updateField.mutate({ fieldId, patch: { field_label: label } });
  const handleReorderFields = (newOrder: TaskCustomField[]) => {
    newOrder.forEach((field, i) => {
      const next = (i + 1) * 1000;
      if (field.sort_order !== next) {
        updateField.mutate({ fieldId: field.id, patch: { sort_order: next } });
      }
    });
  };
  const handleDeleteField = (fieldId: string) => deleteField.mutate(fieldId);
  const handleSaveOptions = (fieldId: string, options: SelectOption[]) => {
    updateField.mutate({
      fieldId,
      patch: { options: options as unknown as TaskCustomField["options"] },
    });
    setOptionsFieldId(null);
  };
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "table";
    return localStorage.getItem(VIEW_KEY) === "cards" ? "cards" : "table";
  });
  const setViewPersist = (v: ViewMode) => {
    setView(v);
    if (typeof window !== "undefined") localStorage.setItem(VIEW_KEY, v);
  };

  const linkCountByMeeting = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of links) m.set(l.meeting_id, (m.get(l.meeting_id) ?? 0) + 1);
    return m;
  }, [links]);

  const openMeeting = meetings.find((m) => m.id === openId) ?? null;

  const handleCreate = async () => {
    const m = await createMeeting.mutateAsync({ projectId, title: "" });
    setOpenId(m.id);
  };

  if (isLoading) {
    return (
      <div className="card p-10 text-center text-ink-500 text-sm">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
        טוען פגישות…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <ViewToggle view={view} onChange={setViewPersist} />
        <div className="inline-flex items-center gap-2">
          {view === "table" && (
            <ColumnsMenu
              items={columnMenuItems}
              hiddenIds={hiddenIds}
              onToggle={toggleHidden}
            />
          )}
          {meetings.length > 0 && (
            <ExportExcelButton
              filename="פגישות"
              build={() => buildMeetingsSheet(meetings, customFields)}
            />
          )}
          <button
            type="button"
            onClick={handleCreate}
            disabled={createMeeting.isPending}
            className="btn-accent text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            פגישה חדשה
          </button>
        </div>
      </div>

      {optionsField && (
        <OptionsEditorModal
          field={optionsField}
          onSave={(opts) => handleSaveOptions(optionsField.id, opts)}
          onClose={() => setOptionsFieldId(null)}
        />
      )}

      {meetings.length === 0 ? (
        <EmptyState onCreate={handleCreate} />
      ) : view === "table" ? (
        <div className="card overflow-hidden">
          <div className="overflow-auto">
            <div style={{ minWidth: gridMinWidth }}>
              <TableHeader
                controlSpacerCount={0}
                gridCols={gridCols}
                customFields={visibleFields}
                fixedLabels={fixedLabels}
                orderedDescriptors={orderedDescriptors}
                sortKey={null}
                sortDir="asc"
                onSort={() => {}}
                onRenameFixed={renameFixed}
                onReorderFixed={reorderFixed}
                onAddField={handleAddField}
                onDeleteField={handleDeleteField}
                onRenameField={handleRenameField}
                onReorderFields={handleReorderFields}
                onEditFieldOptions={(fieldId) => setOptionsFieldId(fieldId)}
              />
              {meetings.map((m) => (
                <MeetingRow
                  key={m.id}
                  meeting={m}
                  projectId={projectId}
                  linkCount={linkCountByMeeting.get(m.id) ?? 0}
                  gridCols={gridCols}
                  orderedKeys={visibleKeys}
                  customFields={visibleFields}
                  onSaveCustom={(field, value) =>
                    updateMeeting.mutate({
                      id: m.id,
                      projectId,
                      patch: {
                        custom_fields: writeCustomField(
                          m,
                          field.field_key,
                          value
                        ),
                      },
                    })
                  }
                  onOpen={() => setOpenId(m.id)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {meetings.map((m) => (
            <MeetingCard
              key={m.id}
              meeting={m}
              linkCount={linkCountByMeeting.get(m.id) ?? 0}
              onOpen={() => setOpenId(m.id)}
            />
          ))}
        </div>
      )}

      {openMeeting && (
        <MeetingDetailModal
          meeting={openMeeting}
          projectId={projectId}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="card p-8 text-center">
      <CalendarClock className="w-9 h-9 text-ink-300 mx-auto mb-2" />
      <h3 className="text-base font-semibold text-ink-900 mb-1">
        עוד אין פגישות
      </h3>
      <p className="text-xs text-ink-500 mb-4 max-w-sm mx-auto">
        כל פגישה יכולה להחזיק תאריך, נקודות, משימות מקושרות, קישור להקלטה עם
        סיכום AI ואירוע ביומן.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="btn-accent text-sm inline-flex items-center gap-1.5"
      >
        <Plus className="w-4 h-4" />
        פגישה ראשונה
      </button>
    </div>
  );
}

function MeetingRow({
  meeting,
  projectId,
  linkCount,
  gridCols,
  orderedKeys,
  customFields,
  onSaveCustom,
  onOpen,
}: {
  meeting: ProjectMeeting;
  projectId: string;
  linkCount: number;
  gridCols: string;
  orderedKeys: MeetingFixedKey[];
  customFields: TaskCustomField[];
  onSaveCustom: (field: TaskCustomField, value: unknown) => void;
  onOpen: () => void;
}) {
  const del = useDeleteProjectMeeting();

  const renderFixed = (key: MeetingFixedKey) => {
    switch (key) {
      case "title":
        return (
          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 truncate text-start font-medium text-ink-900 hover:text-primary-700"
          >
            {meeting.title.trim() || "פגישה ללא שם"}
          </button>
        );
      case "when":
        return (
          <span className="text-xs text-ink-600 truncate">
            {formatWhen(meeting.meeting_at, meeting.all_day)}
            {meeting.event_id && (
              <CalendarPlus
                className="inline-block w-3.5 h-3.5 text-primary-600 ms-1 align-text-bottom"
                aria-label="מסונכרן ליומן"
              />
            )}
          </span>
        );
      case "status":
        return (
          <span className="chip text-[10px]">
            {STATUS_LABEL[meeting.status] ?? meeting.status}
          </span>
        );
      case "tasks":
        return linkCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs text-ink-600">
            <ListChecks className="w-3.5 h-3.5" />
            {linkCount}
          </span>
        ) : (
          <span className="text-xs text-ink-400">—</span>
        );
      case "recording":
        return meeting.recording_id ? (
          <Link
            to={`/app/recordings?id=${meeting.recording_id}`}
            className="inline-flex items-center gap-1 text-xs text-primary-700 hover:underline truncate"
          >
            <Mic className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">לעמוד ההקלטה</span>
          </Link>
        ) : (
          <span className="text-xs text-ink-400">—</span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="grid items-center gap-1 px-1.5 py-1.5 border-b border-ink-100 hover:bg-ink-50"
      style={{ gridTemplateColumns: gridCols }}
    >
      {orderedKeys.map((key) => (
        <div key={key} className="min-w-0 flex items-center">
          {renderFixed(key)}
        </div>
      ))}
      {customFields.map((f) => (
        <div key={f.id} className="min-w-0 flex items-center">
          <DynCell
            field={f}
            value={readCustomField(meeting, f.field_key)}
            onSave={(v) => onSaveCustom(f, v)}
          />
        </div>
      ))}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => {
            if (confirm("למחוק את הפגישה? (גם האירוע ביומן יימחק)"))
              del.mutate({
                id: meeting.id,
                projectId,
                eventId: meeting.event_id,
              });
          }}
          className="p-1 rounded-md text-ink-400 hover:text-danger-600 hover:bg-danger/10"
          aria-label="מחק פגישה"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function MeetingCard({
  meeting,
  linkCount,
  onOpen,
}: {
  meeting: ProjectMeeting;
  linkCount: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card p-4 text-start hover:shadow-lift transition-shadow flex flex-col gap-2"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-ink-900 leading-snug">
          {meeting.title.trim() || "פגישה ללא שם"}
        </h4>
        <span className="chip shrink-0">
          {STATUS_LABEL[meeting.status] ?? meeting.status}
        </span>
      </div>
      <div className="text-xs text-ink-500 inline-flex items-center gap-1">
        <CalendarClock className="w-3.5 h-3.5" />
        {formatWhen(meeting.meeting_at, meeting.all_day)}
      </div>
      {meeting.notes && (
        <p className="text-xs text-ink-600 line-clamp-2">{meeting.notes}</p>
      )}
      <div className="flex items-center gap-3 text-xs text-ink-500 mt-auto pt-1">
        {linkCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <ListChecks className="w-3.5 h-3.5" />
            {linkCount}
          </span>
        )}
        {meeting.recording_id && (
          <span className="inline-flex items-center gap-1 text-primary-700">
            <Mic className="w-3.5 h-3.5" />
            הקלטה
          </span>
        )}
        {meeting.event_id && (
          <span className="inline-flex items-center gap-1 text-primary-700">
            <CalendarPlus className="w-3.5 h-3.5" />
            ביומן
          </span>
        )}
      </div>
    </button>
  );
}

function MeetingDetailModal({
  meeting,
  projectId,
  onClose,
}: {
  meeting: ProjectMeeting;
  projectId: string;
  onClose: () => void;
}) {
  const saveMeeting = useSaveProjectMeeting();
  const { data: recordings = [] } = useRecordings();
  const { data: tasks = [] } = useTasksByProject(projectId);
  const { data: links = [] } = useMeetingTaskLinks(projectId);
  const linkTask = useLinkMeetingTask();
  const unlinkTask = useUnlinkMeetingTask();

  const initial = splitLocal(meeting.meeting_at);
  const [title, setTitle] = useState(meeting.title);
  const [dateStr, setDateStr] = useState(initial.date);
  const [timeStr, setTimeStr] = useState(initial.time || "09:00");
  const [hasTime, setHasTime] = useState(!meeting.all_day && !!meeting.meeting_at);
  const [location, setLocation] = useState(meeting.location ?? "");
  const [status, setStatus] = useState(meeting.status);
  const [notes, setNotes] = useState(meeting.notes ?? "");
  const [summary, setSummary] = useState(meeting.summary ?? "");
  const [recordingId, setRecordingId] = useState(meeting.recording_id ?? "");

  const projectRecordings = useMemo(
    () => recordings.filter((r) => r.project_id === projectId),
    [recordings, projectId]
  );
  const selectedRecording = projectRecordings.find((r) => r.id === recordingId);

  const myLinks = useMemo(
    () => links.filter((l) => l.meeting_id === meeting.id),
    [links, meeting.id]
  );
  const linkedTaskIds = new Set(myLinks.map((l) => l.task_id));
  const linkedTasks = tasks.filter((t) => linkedTaskIds.has(t.id));
  const linkableTasks = tasks.filter(
    (t) => !linkedTaskIds.has(t.id) && !t.completed_at
  );

  const recordingSummary = (rec: typeof selectedRecording): string => {
    if (!rec) return "";
    const fromOutput =
      rec.summary ||
      ((rec.ai_output as any)?.summary as string | undefined) ||
      "";
    return fromOutput;
  };
  const canPullSummary = !!recordingSummary(selectedRecording);

  const meetingAt = combineLocal(dateStr, hasTime ? timeStr : "00:00");
  const allDay = !!dateStr && !hasTime;

  const save = () => {
    saveMeeting.mutate({
      id: meeting.id,
      projectId,
      existingEventId: meeting.event_id,
      patch: {
        title: title.trim(),
        meeting_at: meetingAt,
        all_day: allDay,
        location: location.trim() || null,
        status,
        notes: notes.trim() || null,
        summary: summary.trim() || null,
        recording_id: recordingId || null,
      },
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-lift w-full max-w-2xl my-8 flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-ink-900">פרטי פגישה</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-ink-100"
          >
            <X className="w-4 h-4 text-ink-600" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto min-h-0">
          <div>
            <label className="eyebrow mb-1.5 block">שם הפגישה</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="למשל: פגישת אפיון עם הלקוח"
              className="field"
            />
          </div>

          <div>
            <label className="eyebrow mb-1.5 block">מועד</label>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="field w-auto"
              />
              <label className="inline-flex items-center gap-1.5 text-sm text-ink-700 select-none">
                <input
                  type="checkbox"
                  checked={hasTime}
                  disabled={!dateStr}
                  onChange={(e) => setHasTime(e.target.checked)}
                  className="rounded"
                />
                שעה ספציפית
              </label>
              {hasTime && (
                <input
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  className="field w-auto"
                />
              )}
            </div>
            <p className="text-[11px] text-ink-400 mt-1">
              {!dateStr
                ? "בלי תאריך — הפגישה לא תופיע ביומן."
                : hasTime
                ? "תיווצר אוטומטית כאירוע מתוזמן ביומן."
                : "תופיע ביומן כאירוע ליום שלם (בלי שעה)."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="eyebrow mb-1.5 block">סטטוס</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="field"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="eyebrow mb-1.5 block">מיקום</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="זום / משרד…"
                className="field"
              />
            </div>
          </div>

          {/* Recording link */}
          <div>
            <label className="eyebrow mb-1.5 block">הקלטה מקושרת</label>
            <div className="flex items-center gap-2">
              <select
                value={recordingId}
                onChange={(e) => setRecordingId(e.target.value)}
                className="field flex-1"
              >
                <option value="">— ללא הקלטה —</option>
                {projectRecordings.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title?.trim() || "הקלטה ללא שם"}
                  </option>
                ))}
              </select>
              {recordingId && (
                <Link
                  to={`/app/recordings?id=${recordingId}`}
                  className="btn-ghost text-xs inline-flex items-center gap-1 shrink-0"
                  title="פתח את עמוד ההקלטה"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  פתח
                </Link>
              )}
            </div>
            {recordingId && (
              <button
                type="button"
                disabled={!canPullSummary}
                onClick={() => setSummary(recordingSummary(selectedRecording))}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary-700 hover:underline disabled:text-ink-300 disabled:no-underline"
                title={
                  canPullSummary
                    ? "העתק את סיכום ה-AI מההקלטה לשדה הסיכום"
                    : "אין עדיין סיכום AI בהקלטה הזו"
                }
              >
                <Sparkles className="w-3.5 h-3.5" />
                משוך סיכום AI מההקלטה
              </button>
            )}
          </div>

          {/* Linked tasks */}
          <div>
            <label className="eyebrow mb-1.5 block">משימות מקושרות</label>
            {linkedTasks.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {linkedTasks.map((t) => {
                  const link = myLinks.find((l) => l.task_id === t.id)!;
                  return (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1 chip"
                    >
                      {t.title?.trim() || "משימה"}
                      <button
                        type="button"
                        onClick={() =>
                          unlinkTask.mutate({ linkId: link.id, projectId })
                        }
                        className="text-ink-400 hover:text-danger-600"
                        aria-label="הסר קישור"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <select
              value=""
              onChange={(e) => {
                if (e.target.value)
                  linkTask.mutate({
                    projectId,
                    meetingId: meeting.id,
                    taskId: e.target.value,
                  });
              }}
              className="field"
            >
              <option value="">+ קשרי משימה מהפרויקט…</option>
              {linkableTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title?.trim() || "משימה ללא שם"}
                </option>
              ))}
            </select>
          </div>

          {/* Calendar event — kept in sync automatically from the date above */}
          {meeting.event_id && (
            <Link
              to="/app/calendar"
              className="inline-flex items-center gap-1.5 text-sm text-primary-700 hover:underline"
            >
              <CalendarPlus className="w-4 h-4" />
              מסונכרן ליומן — פתח יומן
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}

          <div>
            <label className="eyebrow mb-1.5 block">נקודות / הערות</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="נקודות שעלו בפגישה…"
              className="field resize-y"
            />
          </div>

          <div>
            <label className="eyebrow mb-1.5 block">סיכום</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={5}
              placeholder="סיכום הפגישה (אפשר למשוך סיכום AI מההקלטה למעלה)…"
              className="field resize-y"
            />
          </div>
        </div>

        <div className="px-5 py-3 bg-ink-50 border-t border-ink-200 flex items-center justify-end gap-2 shrink-0">
          <button onClick={onClose} className="btn-ghost text-sm">
            ביטול
          </button>
          <button
            onClick={save}
            disabled={saveMeeting.isPending}
            className={cn(
              "btn-accent text-sm",
              saveMeeting.isPending && "opacity-50"
            )}
          >
            {saveMeeting.isPending ? "שומר…" : "שמירה"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-ink-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => onChange("table")}
        className={cn(
          "px-2.5 py-1.5 text-xs inline-flex items-center gap-1",
          view === "table"
            ? "bg-ink-900 text-white"
            : "text-ink-600 hover:bg-ink-50"
        )}
      >
        <Table2 className="w-3.5 h-3.5" />
        טבלה
      </button>
      <button
        type="button"
        onClick={() => onChange("cards")}
        className={cn(
          "px-2.5 py-1.5 text-xs inline-flex items-center gap-1",
          view === "cards"
            ? "bg-ink-900 text-white"
            : "text-ink-600 hover:bg-ink-50"
        )}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        כרטיסיות
      </button>
    </div>
  );
}
