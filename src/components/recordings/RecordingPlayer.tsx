import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, ChevronDown, Sparkles, Loader2, GitMerge, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import {
  useDeleteRecording,
  useRecordingAudioUrl,
  useTranscriptionPoll,
  useTriggerRecordingProcessing,
  useUpdateRecording,
} from "@/lib/hooks/useRecordings";
import {
  useRecordingLists,
  useRecordingListAssignments,
  useAssignRecordingToList,
  useUnassignRecordingFromList,
  useCreateRecordingList,
} from "@/lib/hooks/useRecordingLists";
import { useProjects, useCreateProject } from "@/lib/hooks/useProjects";
import { useTaskLists, useCreateTaskList } from "@/lib/hooks/useTaskLists";
import {
  useEventCalendars,
  useCreateEventCalendar,
} from "@/lib/hooks/useEventCalendars";
import { cn } from "@/lib/utils/cn";
import { ListIcon } from "@/components/tasks/list-icons";
import { AudioPlayer } from "@/components/recordings/AudioPlayer";
import { TranscriptEditor } from "@/components/recordings/TranscriptEditor";
import { MergeRecordingsDialog } from "@/components/recordings/MergeRecordingsDialog";
import { AiInsights } from "@/components/recordings/AiInsights";
import type { Recording } from "@/lib/types/domain";

interface Props {
  recording: Recording;
}

export function RecordingPlayer({ recording }: Props) {
  const { data: url, isLoading, error } = useRecordingAudioUrl(recording);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);

  const downloadFilename = buildDownloadFilename(recording);

  return (
    <div className="card p-5 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <EditableTitle recording={recording} />
          <p className="text-xs text-ink-500 mt-0.5">
            הועלתה {format(new Date(recording.created_at), "d בMMM yyyy, HH:mm", { locale: he })}
          </p>
          {recording.merged_into && (
            <p className="text-[11px] text-ink-500 mt-1 inline-flex items-center gap-1">
              <GitMerge className="w-3 h-3" />
              מוזגה לתוך הקלטה אחרת.
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!recording.merged_into && (
            <button
              type="button"
              onClick={() => setMergeOpen(true)}
              className="btn-outline !py-1 !px-2 !text-[11px] inline-flex items-center gap-1"
              title="איחוד עם הקלטה נוספת"
            >
              <GitMerge className="w-3 h-3" />
              איחוד
            </button>
          )}
          <DeleteButton recording={recording} />
        </div>
      </header>

      <MergeRecordingsDialog
        recording={recording}
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
      />

      <div>
        {recording.audio_archived ? (
          <div className="rounded-md border border-ink-300 bg-ink-50 px-3 py-3 text-sm text-ink-600 inline-flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-ink-400" />
            האודיו של הקלטה זו נמחק לפי מדיניות retention. המטא-דאטה נשמר.
          </div>
        ) : (
          <AudioPlayer
            src={url}
            isLoading={isLoading}
            hasError={!!error}
            downloadFilename={downloadFilename}
            onAudioElement={setAudioElement}
          />
        )}
      </div>

      {/* Editable meta grid — every cell is a status-style picker with an */}
      {/* inline "+ create new" affordance. Replaces both the read-only       */}
      {/* summary grid and the standalone "שיוך" chip-bar that used to       */}
      {/* duplicate this data above. */}
      <section className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          <StatusMeta recording={recording} />
          <SourceMeta recording={recording} />
          <ProjectLinkMeta recording={recording} />
          <EventCalendarLinkMeta recording={recording} />
          <TaskListLinkMeta recording={recording} />
          <RecordingListsLinkMeta recording={recording} />
        </div>
      </section>

      <TranscriptionSection recording={recording} audioElement={audioElement} />

      {/* AI/manual processing pane is always available once the recording */}
      {/* exists. Even without a transcript the user can fill the sections by */}
      {/* hand and "הפעלת AI" gates itself on whether transcript_text is set. */}
      {recording.status !== "recording" &&
        recording.status !== "transcribing" && (
          <AiInsights recording={recording} />
        )}
    </div>
  );
}

function TranscriptionSection({
  recording,
  audioElement,
}: {
  recording: Recording;
  audioElement: HTMLAudioElement | null;
}) {
  const trigger = useTriggerRecordingProcessing();
  const update = useUpdateRecording();
  const status = recording.status;
  const [retryNotice, setRetryNotice] = useState<
    { kind: "ok" | "err"; msg: string } | null
  >(null);
  // Webhook fallback: while a job is transcribing, poll Gladia every 30s.
  // Picks up the result if Gladia's webhook delivery is delayed or missing.
  useTranscriptionPoll(recording.id, status === "transcribing");

  // Once a transcript exists it must NEVER disappear from the UI — even if
  // `status` later flips to `processing` / `processed` because the AI
  // summarize edge function repurposes that field. Render the editor as soon
  // as we have transcript_text so the user can't lose access to it.
  if (recording.transcript_text && recording.transcript_text.trim().length > 0) {
    return <TranscriptEditor recording={recording} audioElement={audioElement} />;
  }

  if (status === "transcribing") {
    const ageMin = recording.updated_at
      ? Math.floor((Date.now() - new Date(recording.updated_at).getTime()) / 60_000)
      : null;
    const isStuck = ageMin !== null && ageMin >= 5;
    const busy = update.isPending || trigger.isPending;
    return (
      <section className="rounded-md border border-ink-200 bg-ink-50 px-3 py-3 space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-700">
          <Loader2 className="w-3.5 h-3.5 text-primary-600 animate-spin" />
          מתמללת...
          {ageMin !== null && ageMin > 0 ? (
            <span className="text-ink-400 font-normal">
              ({ageMin >= 60 ? `לפני ${Math.floor(ageMin / 60)} שעות` : `לפני ${ageMin} דק'`})
            </span>
          ) : null}
        </div>
        <p className="text-xs text-ink-500 leading-relaxed">
          {isStuck
            ? "התמלול לוקח יותר מהצפוי. ייתכן שה-webhook מ-Gladia לא חזר. אפשר לנסות שוב."
            : "Gladia מעבדת את ההקלטה. בדרך כלל לוקח דקה לכל ~10 דקות אודיו. הסטטוס יתעדכן אוטומטית כשהתמלול מוכן."}
        </p>
        {retryNotice && (
          <p
            className={cn(
              "text-xs font-medium pt-0.5",
              retryNotice.kind === "ok" ? "text-emerald-700" : "text-red-700"
            )}
          >
            {retryNotice.msg}
          </p>
        )}
        <button
          type="button"
          className="text-xs font-medium text-primary-700 hover:underline disabled:opacity-50 pt-0.5"
          disabled={busy}
          onClick={async () => {
            setRetryNotice(null);
            try {
              await update.mutateAsync({
                recordingId: recording.id,
                patch: { status: "uploaded", provider_job_id: null },
              });
              await trigger.mutateAsync(recording.id);
              setRetryNotice({ kind: "ok", msg: "נשלח מחדש ל-Gladia ✓" });
              setTimeout(() => setRetryNotice(null), 4000);
            } catch (e) {
              setRetryNotice({
                kind: "err",
                msg: `שגיאה: ${e instanceof Error ? e.message : String(e)}`,
              });
            }
          }}
        >
          {busy ? "שולח..." : "נתקע? נסה שוב"}
        </button>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="rounded-md border border-red-200 bg-red-50 px-3 py-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-red-700">
          <AlertCircle className="w-3.5 h-3.5" />
          שגיאת תמלול
        </div>
        {recording.error_message ? (
          <p className="text-xs text-red-700 leading-relaxed break-words">
            {recording.error_message}
          </p>
        ) : null}
        <button
          type="button"
          className="text-xs font-medium text-primary-700 hover:underline disabled:opacity-50"
          disabled={trigger.isPending}
          onClick={() => trigger.mutate(recording.id)}
        >
          נסה שוב
        </button>
      </section>
    );
  }

  // status === 'uploaded' (default landing state after upload completes)
  return (
    <section className="rounded-md border border-dashed border-ink-300 bg-ink-50 px-3 py-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-700">
        <Sparkles className="w-3.5 h-3.5 text-primary-600" />
        תמלול וסיכום AI
      </div>
      <p className="text-xs text-ink-500 leading-relaxed">
        Gladia מתמללת את ההקלטה עם הפרדת דוברים בעברית. תוצאה תופיע כאן.
      </p>
      <button
        type="button"
        className="btn-primary text-sm"
        disabled={trigger.isPending}
        onClick={() => trigger.mutate(recording.id)}
      >
        {trigger.isPending ? "שולחת..." : "התחל תמלול"}
      </button>
    </section>
  );
}

function EditableTitle({ recording }: { recording: Recording }) {
  const update = useUpdateRecording();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(recording.title ?? "");
  // Resync the draft whenever the row changes from the server (e.g. after a
  // successful save, or when the user navigates between recordings).
  useEffect(() => {
    if (!editing) setDraft(recording.title ?? "");
  }, [recording.title, recording.id, editing]);

  const commit = () => {
    const next = draft.trim();
    if (next === (recording.title ?? "")) {
      setEditing(false);
      return;
    }
    update.mutate(
      { recordingId: recording.id, patch: { title: next || null } },
      { onSettled: () => setEditing(false) }
    );
  };

  if (!editing) {
    return (
      <h2
        className="text-lg font-semibold text-ink-900 truncate cursor-text hover:bg-ink-50 rounded px-1 -mx-1"
        title="לחיצה לעריכה"
        onClick={() => setEditing(true)}
      >
        {recording.title || "ללא כותרת"}
      </h2>
    );
  }
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          setDraft(recording.title ?? "");
          setEditing(false);
        }
      }}
      className="text-lg font-semibold text-ink-900 bg-transparent border-b border-primary-300 outline-none w-full min-w-0"
      placeholder="ללא כותרת"
    />
  );
}

function DeleteButton({ recording }: { recording: Recording }) {
  const del = useDeleteRecording();
  const [confirm, setConfirm] = useState(false);
  if (confirm) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px]">
        <span className="text-ink-700">למחוק?</span>
        <button
          type="button"
          onClick={() => del.mutate(recording.id)}
          disabled={del.isPending}
          className="btn-primary !py-1 !px-2 !text-[11px] !bg-danger-600 !border-danger-600 hover:!bg-danger-700"
        >
          {del.isPending ? "מוחקת…" : "מחיקה"}
        </button>
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="btn-outline !py-1 !px-2 !text-[11px]"
        >
          ביטול
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      className="btn-outline !py-1 !px-2 !text-[11px] inline-flex items-center gap-1 text-danger-600 hover:!bg-danger-50"
      title="מחיקת ההקלטה — בלתי הפיך"
    >
      <Trash2 className="w-3 h-3" />
      מחיקה
    </button>
  );
}

/**
 * Status-meta-style picker cell. The dropdown lists the existing options;
 * the bottom panel exposes "+ Add new" inline so the user never has to leave
 * the recording to create a project / calendar / list / etc.
 */
function LinkMeta<T extends { id: string }>({
  label,
  current,
  options,
  renderOption,
  onChange,
  createLabel,
  onCreate,
}: {
  label: string;
  current: T | null;
  options: T[];
  renderOption: (o: T) => ReactNode;
  onChange: (id: string | null) => void;
  createLabel: string;
  onCreate?: (name: string) => Promise<{ id: string } | undefined>;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Click-away to close.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const submitCreate = async () => {
    if (!onCreate) return;
    const name = draft.trim();
    if (!name) return;
    setBusy(true);
    try {
      const created = await onCreate(name);
      if (created?.id) onChange(created.id);
      setDraft("");
      setCreating(false);
      setOpen(false);
    } catch (err) {
      console.error("create from picker failed:", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="rounded-md bg-ink-50 px-2.5 py-2 relative">
      <div className="text-[10px] uppercase tracking-wider text-ink-400">{label}</div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="bg-transparent text-xs text-ink-800 mt-0.5 w-full text-start outline-none cursor-pointer hover:text-primary-700 inline-flex items-center gap-1"
      >
        <span className="flex-1 truncate min-w-0">{current ? renderOption(current) : "—"}</span>
        <ChevronDown className="w-3 h-3 shrink-0 text-ink-400" />
      </button>
      {open && (
        <div className="absolute z-30 top-full mt-1 start-0 w-56 bg-white border border-ink-200 rounded-md shadow-lift overflow-hidden text-xs">
          <div className="max-h-48 overflow-y-auto p-1">
            <button
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="w-full text-start px-2 py-1.5 rounded hover:bg-ink-100"
            >
              — ללא —
            </button>
            {options.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className="w-full text-start px-2 py-1.5 rounded hover:bg-ink-100 truncate inline-flex items-center gap-1"
              >
                {renderOption(o)}
              </button>
            ))}
          </div>
          {onCreate && (
            <div className="border-t border-ink-200 p-1">
              {creating ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitCreate();
                  }}
                  className="flex items-center gap-1"
                >
                  <input
                    autoFocus
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={createLabel}
                    disabled={busy}
                    className="field !py-1 !px-2 !text-xs flex-1 min-w-0"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || busy}
                    className="btn-ghost !py-1 !px-2 disabled:opacity-50"
                    title="הוספה"
                  >
                    +
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="w-full text-start px-2 py-1.5 rounded text-primary-700 hover:bg-primary-50"
                >
                  + {createLabel}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectLinkMeta({ recording }: { recording: Recording }) {
  const update = useUpdateRecording();
  const { data: projects = [] } = useProjects();
  const createProject = useCreateProject();
  const current = projects.find((p) => p.id === recording.project_id) ?? null;
  return (
    <LinkMeta
      label="פרויקט"
      current={current}
      options={projects}
      renderOption={(p) => <span className="truncate">{p.name}</span>}
      onChange={(id) =>
        update.mutate({ recordingId: recording.id, patch: { project_id: id } })
      }
      createLabel="פרויקט חדש"
      onCreate={async (name) => {
        const created = await createProject.mutateAsync({ name });
        return created;
      }}
    />
  );
}

function EventCalendarLinkMeta({ recording }: { recording: Recording }) {
  const update = useUpdateRecording();
  const { data: calendars = [] } = useEventCalendars();
  const createCalendar = useCreateEventCalendar();
  const current =
    calendars.find((c) => c.id === recording.event_calendar_id) ?? null;
  return (
    <LinkMeta
      label="יומן"
      current={current}
      options={calendars}
      renderOption={(c) => (
        <span className="inline-flex items-center gap-1 truncate">
          <ListIcon emoji={c.emoji} className="w-3 h-3" />
          <span className="truncate">{c.name}</span>
        </span>
      )}
      onChange={(id) =>
        update.mutate({
          recordingId: recording.id,
          patch: { event_calendar_id: id },
        })
      }
      createLabel="יומן חדש"
      onCreate={async (name) => {
        const created = await createCalendar.mutateAsync({ name });
        return created;
      }}
    />
  );
}

function TaskListLinkMeta({ recording }: { recording: Recording }) {
  const update = useUpdateRecording();
  const { data: taskLists = [] } = useTaskLists();
  const createTaskList = useCreateTaskList();
  const current = taskLists.find((l) => l.id === recording.task_list_id) ?? null;
  return (
    <LinkMeta
      label="משימות"
      current={current}
      options={taskLists}
      renderOption={(l) => (
        <span className="inline-flex items-center gap-1 truncate">
          <ListIcon emoji={l.emoji} className="w-3 h-3" />
          <span className="truncate">{l.name}</span>
        </span>
      )}
      onChange={(id) =>
        update.mutate({
          recordingId: recording.id,
          patch: { task_list_id: id },
        })
      }
      createLabel="רשימת משימות חדשה"
      onCreate={async (name) => {
        const created = await createTaskList.mutateAsync({ name });
        return created;
      }}
    />
  );
}

function RecordingListsLinkMeta({ recording }: { recording: Recording }) {
  const { data: allLists = [] } = useRecordingLists();
  const { data: assignments = [] } = useRecordingListAssignments(recording.id);
  const assign = useAssignRecordingToList();
  const unassign = useUnassignRecordingFromList();
  const createList = useCreateRecordingList();
  const myLists = assignments
    .map((a) => allLists.find((l) => l.id === a.list_id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l));
  const summary =
    myLists.length === 0
      ? null
      : myLists.length === 1
      ? myLists[0].name
      : `${myLists.length} רשימות`;
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = (id: string) => {
    const owned = assignments.some((a) => a.list_id === id);
    if (owned) {
      unassign.mutate({ recordingId: recording.id, listId: id });
    } else {
      assign.mutate({ recordingId: recording.id, listId: id });
    }
  };

  const submitCreate = async () => {
    const name = draft.trim();
    if (!name) return;
    setBusy(true);
    try {
      const created = await createList.mutateAsync({ name });
      assign.mutate({ recordingId: recording.id, listId: created.id });
      setDraft("");
      setCreating(false);
    } catch (err) {
      console.error("create recording list failed:", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="rounded-md bg-ink-50 px-2.5 py-2 relative">
      <div className="text-[10px] uppercase tracking-wider text-ink-400">רשימות</div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="bg-transparent text-xs text-ink-800 mt-0.5 w-full text-start outline-none cursor-pointer hover:text-primary-700 inline-flex items-center gap-1"
      >
        {myLists.length === 1 && (
          <ListIcon emoji={myLists[0].emoji} className="w-3 h-3 shrink-0" />
        )}
        <span className="flex-1 truncate min-w-0">{summary ?? "—"}</span>
        <ChevronDown className="w-3 h-3 shrink-0 text-ink-400" />
      </button>
      {open && (
        <div className="absolute z-30 top-full mt-1 start-0 w-56 bg-white border border-ink-200 rounded-md shadow-lift overflow-hidden text-xs">
          <div className="max-h-48 overflow-y-auto p-1">
            {allLists.length === 0 ? (
              <div className="px-2 py-1.5 text-[11px] text-ink-400">אין רשימות עדיין</div>
            ) : (
              allLists.map((l) => {
                const owned = assignments.some((a) => a.list_id === l.id);
                return (
                  <button
                    key={l.id}
                    onClick={() => toggle(l.id)}
                    className={cn(
                      "w-full text-start px-2 py-1.5 rounded inline-flex items-center gap-1.5 truncate",
                      owned
                        ? "bg-primary-50 text-primary-800 hover:bg-primary-100"
                        : "hover:bg-ink-100"
                    )}
                  >
                    <span
                      className={cn(
                        "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0",
                        owned
                          ? "bg-primary-500 border-primary-500 text-white"
                          : "border-ink-300 bg-white"
                      )}
                    >
                      {owned && "✓"}
                    </span>
                    <ListIcon emoji={l.emoji} className="w-3 h-3" />
                    <span className="truncate">{l.name}</span>
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t border-ink-200 p-1">
            {creating ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitCreate();
                }}
                className="flex items-center gap-1"
              >
                <input
                  autoFocus
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="רשימה חדשה"
                  disabled={busy}
                  className="field !py-1 !px-2 !text-xs flex-1 min-w-0"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || busy}
                  className="btn-ghost !py-1 !px-2 disabled:opacity-50"
                  title="הוספה"
                >
                  +
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="w-full text-start px-2 py-1.5 rounded text-primary-700 hover:bg-primary-50"
              >
                + רשימה חדשה
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SourceMeta({ recording }: { recording: Recording }) {
  const update = useUpdateRecording();
  const [customDraft, setCustomDraft] = useState(recording.source_custom ?? "");
  useEffect(() => {
    setCustomDraft(recording.source_custom ?? "");
  }, [recording.source_custom, recording.id]);

  const commitCustom = () => {
    const next = customDraft.trim();
    if (next === (recording.source_custom ?? "")) return;
    update.mutate({ recordingId: recording.id, patch: { source_custom: next || null } });
  };

  return (
    <div className="rounded-md bg-ink-50 px-2.5 py-2 space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-ink-400">מקור</div>
      <select
        value={recording.source}
        onChange={(e) => {
          const src = e.target.value as Recording["source"];
          update.mutate({ recordingId: recording.id, patch: { source: src } });
        }}
        disabled={update.isPending}
        className="bg-transparent text-xs text-ink-800 w-full outline-none cursor-pointer hover:text-primary-700 disabled:cursor-wait"
      >
        <option value="thought">מחשבה</option>
        <option value="call">שיחה</option>
        <option value="meeting">פגישה</option>
        <option value="recording">מהקלטה</option>
        <option value="whatsapp">מוואטספ</option>
        <option value="upload">מהעלאה</option>
        <option value="other">אחר</option>
      </select>
      {recording.source === "other" && (
        <input
          type="text"
          value={customDraft}
          onChange={(e) => setCustomDraft(e.target.value)}
          onBlur={commitCustom}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commitCustom(); }
            if (e.key === "Escape") setCustomDraft(recording.source_custom ?? "");
          }}
          placeholder="פרט..."
          className="field !py-0.5 !px-1.5 !text-xs w-full"
        />
      )}
    </div>
  );
}

function StatusMeta({ recording }: { recording: Recording }) {
  const update = useUpdateRecording();
  const onChange = (next: Recording["status"]) => {
    if (next === recording.status) return;
    update.mutate({ recordingId: recording.id, patch: { status: next } });
  };
  return (
    <div className="rounded-md bg-ink-50 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-400">סטטוס</div>
      <select
        value={recording.status}
        onChange={(e) => onChange(e.target.value as Recording["status"])}
        disabled={update.isPending}
        className="bg-transparent text-xs text-ink-800 mt-0.5 w-full outline-none cursor-pointer hover:text-primary-700 disabled:cursor-wait"
      >
        {/* Render the current status even if it's not user-pickable (e.g. */}
        {/* `transcribing` while a job is in flight) so the dropdown reflects */}
        {/* reality and the user can flip to a manual status from there. */}
        {!USER_PICKABLE_STATUSES.some((o) => o.value === recording.status) && (
          <option value={recording.status}>{statusLabel(recording.status)}</option>
        )}
        {USER_PICKABLE_STATUSES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function statusLabel(status: Recording["status"]): string {
  switch (status) {
    case "recording":
      return "מקליטה";
    case "uploaded":
      return "הועלתה";
    case "transcribing":
      return "מתמללת";
    case "extracting":
      return "מחלצת משימות";
    case "ready":
      return "מוכנה";
    case "processing":
      return "בעיבוד";
    case "processed":
      return "עובדה";
    case "error":
      return "שגיאה";
  }
}

const USER_PICKABLE_STATUSES: Array<{
  value: Recording["status"];
  label: string;
}> = [
  { value: "uploaded", label: "הועלתה" },
  { value: "ready", label: "מוכנה" },
  { value: "processing", label: "בעיבוד" },
  { value: "processed", label: "עובדה" },
  { value: "error", label: "שגיאה" },
];

function buildDownloadFilename(recording: Recording): string {
  // Take the extension from storage_key tail, fallback by mime.
  const keyTail = recording.storage_key.split("/").pop() ?? "";
  const ext =
    keyTail.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ??
    extFromMime(recording.mime_type);
  const stem = (recording.title?.trim() || "recording")
    .replace(/[\\/:*?"<>|]/g, "-")
    .slice(0, 80);
  return `${stem}.${ext}`;
}

function extFromMime(t: string): string {
  const s = (t ?? "").toLowerCase();
  if (s.includes("mpeg") || s.includes("mp3")) return "mp3";
  if (s.includes("mp4") || s.includes("m4a") || s.includes("aac")) return "m4a";
  if (s.includes("webm")) return "webm";
  if (s.includes("ogg") || s.includes("opus")) return "ogg";
  if (s.includes("wav")) return "wav";
  return "audio";
}
