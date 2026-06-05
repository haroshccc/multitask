import { useMemo } from "react";
import { Clock, Users, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { EventRow } from "@/lib/types/domain";
import type { ProjectMeeting } from "@/lib/hooks/useProjectMeetings";
import type { CalendarItem } from "./calendar-utils";
import {
  type ItemDropHandler,
  beginDrag,
  endDrag,
  startPointerMove,
} from "./calendar-drag";

/**
 * Scheduling-mode side panel for project MEETINGS. Mirrors the task scheduling
 * panel, but lists the project's meetings and lets the user drag one onto the
 * calendar grid to set (or move) its `meeting_at`. A drag carries a synthetic
 * `isUnscheduledDraft` CalendarItem whose id is `meeting:<id>`, so the page's
 * `onItemDrop` can recognise it and reconcile the meeting + its linked event.
 *
 * Already-scheduled meetings stay visible but dimmed, so the unscheduled ones
 * stand out — the same affordance the task panel uses.
 */
export function MeetingSchedulingPanel({
  meetings,
  onItemDrop,
  onOpenMeeting,
  onClose,
  wide,
}: {
  meetings: ProjectMeeting[];
  onItemDrop: ItemDropHandler;
  /** Double-click a meeting → jump to the meetings tab to edit it. */
  onOpenMeeting: (meetingId: string) => void;
  onClose: () => void;
  wide?: boolean;
}) {
  // Unscheduled first (the ones the panel is really for), then scheduled.
  const ordered = useMemo(() => {
    const unscheduled = meetings.filter((m) => !m.meeting_at);
    const scheduled = meetings.filter((m) => !!m.meeting_at);
    return { unscheduled, scheduled };
  }, [meetings]);

  return (
    <aside
      className={cn(
        "shrink-0 card overflow-hidden flex flex-col max-h-[calc(100vh-220px)]",
        wide ? "w-80 sm:w-96 lg:w-[28rem]" : "w-72"
      )}
    >
      <header className="px-3 py-2 border-b border-ink-200 flex items-center justify-between bg-ink-50/60">
        <span className="text-sm font-semibold text-ink-900 inline-flex items-center gap-1.5">
          <Users className="w-4 h-4 text-pink-500" />
          שיבוץ פגישות
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-ink-500 hover:bg-ink-100"
          title="סגירה"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {meetings.length === 0 ? (
          <p className="text-xs text-ink-400 text-center py-6">
            אין עדיין פגישות בפרויקט. צרי פגישה בלשונית "פגישות" כדי לגרור אותה
            אל היומן.
          </p>
        ) : (
          <>
            <section>
              <h4 className="px-1 mb-1 text-[11px] font-semibold text-ink-500">
                ממתינות לשיבוץ ({ordered.unscheduled.length})
              </h4>
              {ordered.unscheduled.length === 0 ? (
                <p className="text-[11px] text-ink-300 px-1 py-1">
                  כל הפגישות כבר משובצות
                </p>
              ) : (
                <div className="space-y-1">
                  {ordered.unscheduled.map((m) => (
                    <PanelMeetingItem
                      key={m.id}
                      meeting={m}
                      onItemDrop={onItemDrop}
                      onOpenMeeting={onOpenMeeting}
                    />
                  ))}
                </div>
              )}
            </section>

            {ordered.scheduled.length > 0 && (
              <section>
                <h4 className="px-1 mb-1 text-[11px] font-semibold text-ink-500">
                  משובצות ({ordered.scheduled.length})
                </h4>
                <div className="space-y-1">
                  {ordered.scheduled.map((m) => (
                    <PanelMeetingItem
                      key={m.id}
                      meeting={m}
                      onItemDrop={onItemDrop}
                      onOpenMeeting={onOpenMeeting}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

const MEETING_DEFAULT_MIN = 60;

function buildDraftItem(m: ProjectMeeting): CalendarItem {
  // start/end are placeholders; the drop only reads the id + duration to
  // position the hover-pill. The id prefix `meeting:` is the discriminator
  // the page's drop handler keys on.
  const start = m.meeting_at ? new Date(m.meeting_at) : new Date();
  return {
    id: `meeting:${m.id}`,
    kind: "event",
    title: m.title || "פגישה",
    description: m.notes ?? null,
    start,
    end: new Date(start.getTime() + MEETING_DEFAULT_MIN * 60_000),
    allDay: false,
    color: "#ec4899",
    listId: null,
    calendarId: null,
    completed: false,
    // The drop handler only reads `id`; cast keeps the CalendarItem shape
    // happy without inventing a fake event row.
    source: m as unknown as EventRow,
    isUnscheduledDraft: true,
  };
}

function PanelMeetingItem({
  meeting,
  onItemDrop,
  onOpenMeeting,
}: {
  meeting: ProjectMeeting;
  onItemDrop: ItemDropHandler;
  onOpenMeeting: (meetingId: string) => void;
}) {
  const draft = useMemo(() => buildDraftItem(meeting), [meeting]);
  const scheduled = !!meeting.meeting_at;
  const whenLabel = meeting.meeting_at
    ? new Date(meeting.meeting_at).toLocaleString("he-IL", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      draggable
      onDragStart={(e) => {
        beginDrag(draft, 0, "move");
        e.dataTransfer.effectAllowed = "move";
        try {
          e.dataTransfer.setData("text/plain", meeting.id);
        } catch {
          /* ignore */
        }
      }}
      onDragEnd={() => endDrag()}
      onDoubleClick={() => onOpenMeeting(meeting.id)}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse") return;
        startPointerMove(draft, e, 0, { onItemDrop });
      }}
      style={{ touchAction: "none" }}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs border bg-white",
        "cursor-grab active:cursor-grabbing hover:bg-ink-50 border-ink-150",
        scheduled && "opacity-45"
      )}
      title={
        scheduled
          ? "כבר משובצת — אפשר לגרור לזמן אחר"
          : "גררי אל היומן כדי לשבץ"
      }
    >
      <span className="w-2 h-2 rounded-full shrink-0 bg-pink-500" />
      <span className="truncate flex-1 text-ink-800">
        {meeting.title || "פגישה ללא כותרת"}
      </span>
      {whenLabel ? (
        <span className="text-[10px] text-ink-400 tabular-nums shrink-0">
          {whenLabel}
        </span>
      ) : null}
      {scheduled && <Clock className="w-3 h-3 text-ink-300 shrink-0" />}
    </div>
  );
}
