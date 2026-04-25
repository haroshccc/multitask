import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Video,
  MapPin,
  Trash2,
  Users,
  Repeat,
  ListTodo,
  Lightbulb,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useEvent,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
} from "@/lib/hooks/useEvents";
import { useThought } from "@/lib/hooks/useThoughts";
import { useEventCalendars } from "@/lib/hooks/useEventCalendars";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { EventParticipantsSection } from "./EventParticipantsSection";
import { RrulePicker } from "./RrulePicker";
import { ThoughtEditModal } from "@/components/thoughts/ThoughtEditModal";
import { UnsavedChangesGuard } from "@/components/ui/UnsavedChangesGuard";

/**
 * Event edit modal — SPEC §16. Three tabs: details / participants / recurrence.
 * Uses the same `DateTimePicker` as the Tasks screen so the feel stays
 * consistent; `video_call_url` button for Meet is a placeholder (SPEC §9 —
 * deferred to Phase 9b).
 */

interface EventEditModalProps {
  open: boolean;
  eventId: string | null;
  initialStart?: Date;
  initialEnd?: Date;
  /** Optional pre-filled title for create mode. */
  initialTitle?: string;
  /** Optional pre-filled description for create mode. */
  initialDescription?: string;
  /** Optional pre-filled all-day flag for create mode. */
  initialAllDay?: boolean;
  /** Optional source-thought link for provenance (create mode). */
  initialSourceThoughtId?: string | null;
  onClose: () => void;
  /** Fires once after a successful create-mode save. */
  onCreated?: (eventId: string) => void;
  /**
   * Optional UI strip rendered at the top of the modal in CREATE mode
   * only. Used by Calendar's "create event/task picker" to let the user
   * flip the modal to TaskEditModal without losing context.
   */
  topSlot?: React.ReactNode;
}

type Tab = "details" | "participants" | "recurrence";

const EVENT_COLOR_PRESETS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#22c55e", "#10b981", "#0ea5e9", "#3b82f6",
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
];

export function EventEditModal({
  open,
  eventId,
  initialStart,
  initialEnd,
  initialTitle,
  initialDescription,
  initialAllDay,
  initialSourceThoughtId,
  onClose,
  onCreated,
  topSlot,
}: EventEditModalProps) {
  const isEdit = !!eventId;
  const { data: existing } = useEvent(eventId);
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const [tab, setTab] = useState<Tab>("details");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [videoCallUrl, setVideoCallUrl] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(null);
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const { data: availableCalendars = [] } = useEventCalendars();

  useEffect(() => {
    if (!open) return;
    if (isEdit && existing) {
      setTitle(existing.title);
      setDescription(existing.description ?? "");
      setLocation(existing.location ?? "");
      setVideoCallUrl(existing.video_call_url ?? "");
      setAllDay(existing.all_day);
      setStartsAt(existing.starts_at);
      setEndsAt(existing.ends_at);
      setRecurrenceRule(existing.recurrence_rule);
      setCalendarId(existing.calendar_id ?? null);
      setColor(existing.color ?? null);
      setTab("details");
    } else if (!isEdit) {
      const s = initialStart ?? new Date();
      const e = initialEnd ?? new Date(s.getTime() + 60 * 60_000);
      setTitle(initialTitle ?? "");
      setDescription(initialDescription ?? "");
      setLocation("");
      setVideoCallUrl("");
      setAllDay(initialAllDay ?? false);
      setStartsAt(s.toISOString());
      setEndsAt(e.toISOString());
      setRecurrenceRule(null);
      setCalendarId(null);
      setColor(null);
      setTab("details");
    }
  }, [
    open,
    isEdit,
    existing,
    initialStart,
    initialEnd,
    initialTitle,
    initialDescription,
    initialAllDay,
  ]);

  const [guardOpen, setGuardOpen] = useState(false);

  // Dirty when any field differs from the persisted row (edit mode) or
  // from the empty/initial defaults (create mode).
  const dirty = useMemo(() => {
    if (isEdit && existing) {
      return (
        title !== existing.title ||
        description !== (existing.description ?? "") ||
        location !== (existing.location ?? "") ||
        videoCallUrl !== (existing.video_call_url ?? "") ||
        allDay !== existing.all_day ||
        startsAt !== existing.starts_at ||
        endsAt !== existing.ends_at ||
        recurrenceRule !== existing.recurrence_rule ||
        calendarId !== (existing.calendar_id ?? null) ||
        color !== (existing.color ?? null)
      );
    }
    // Create mode: dirty only if user filled the title — every other field
    // has a default that came from the create context, so changes there
    // don't constitute a "real" edit until the title says so.
    return title.trim().length > 0;
  }, [
    isEdit,
    existing,
    title,
    description,
    location,
    videoCallUrl,
    allDay,
    startsAt,
    endsAt,
    recurrenceRule,
    calendarId,
    color,
  ]);

  const save = async (): Promise<boolean> => {
    if (!title.trim() || !startsAt || !endsAt) return false;
    const payload = {
      title: title.trim(),
      description: description || null,
      location: location || null,
      video_call_url: videoCallUrl || null,
      all_day: allDay,
      starts_at: startsAt,
      ends_at: endsAt,
      recurrence_rule: recurrenceRule,
      source_thought_id: initialSourceThoughtId ?? null,
      calendar_id: calendarId,
      color: color,
    };
    try {
      if (isEdit && eventId) {
        await updateEvent.mutateAsync({ eventId, patch: payload });
      } else {
        const created = await createEvent.mutateAsync(payload);
        onCreated?.(created.id);
      }
      onClose();
      return true;
    } catch {
      return false;
    }
  };

  const handleClose = () => {
    if (dirty) {
      setGuardOpen(true);
      return;
    }
    onClose();
  };

  const del = async () => {
    if (!eventId) return;
    await deleteEvent.mutateAsync(eventId);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-lift w-full max-w-2xl my-8 overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-ink-900">
                  {isEdit ? "עריכת אירוע" : "אירוע חדש"}
                </h3>
                {!isEdit && topSlot}
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg hover:bg-ink-100"
                type="button"
              >
                <X className="w-4 h-4 text-ink-600" />
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-ink-200 px-3 flex items-center gap-1 text-sm">
              <TabBtn active={tab === "details"} onClick={() => setTab("details")}>
                <ListTodo className="w-4 h-4" />
                פרטים
              </TabBtn>
              <TabBtn
                active={tab === "participants"}
                onClick={() => setTab("participants")}
              >
                <Users className="w-4 h-4" />
                מוזמנים
              </TabBtn>
              <TabBtn
                active={tab === "recurrence"}
                onClick={() => setTab("recurrence")}
              >
                <Repeat className="w-4 h-4" />
                חזרה
              </TabBtn>
            </div>

            <div className="p-5 max-h-[calc(100vh-16rem)] overflow-y-auto">
              {tab === "details" && (
                <div className="space-y-4">
                  <Field label="כותרת">
                    <input
                      autoFocus
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="שם האירוע"
                      className="field"
                    />
                  </Field>

                  <Field label="תיאור">
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="field min-h-[80px] resize-y"
                      placeholder="פרטים..."
                    />
                  </Field>

                  <label className="flex items-center gap-2 text-sm text-ink-700 select-none">
                    <input
                      type="checkbox"
                      checked={allDay}
                      onChange={(e) => setAllDay(e.target.checked)}
                      className="w-4 h-4"
                    />
                    אירוע של יום שלם
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="התחלה">
                      <DateTimePicker
                        value={startsAt}
                        onChange={(v) => {
                          setStartsAt(v);
                          // Keep the duration constant when the user shifts start.
                          if (v && startsAt && endsAt) {
                            const dur =
                              new Date(endsAt).getTime() -
                              new Date(startsAt).getTime();
                            setEndsAt(new Date(new Date(v).getTime() + dur).toISOString());
                          }
                        }}
                        dateOnly={allDay}
                      />
                    </Field>
                    <Field label="סיום">
                      <DateTimePicker
                        value={endsAt}
                        onChange={setEndsAt}
                        dateOnly={allDay}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="יומן">
                      <select
                        value={calendarId ?? ""}
                        onChange={(e) =>
                          setCalendarId(e.target.value || null)
                        }
                        className="field"
                      >
                        <option value="">ללא שיוך</option>
                        {availableCalendars.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="צבע (דורס את צבע היומן)">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setColor(null)}
                          className={cn(
                            "h-7 px-2 rounded-md border text-[11px]",
                            color === null
                              ? "bg-ink-900 text-white border-ink-900"
                              : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
                          )}
                          title="השתמש בצבע היומן (או ברירת מחדל אם אין יומן)"
                        >
                          ברירת מחדל
                        </button>
                        {EVENT_COLOR_PRESETS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setColor(c)}
                            className={cn(
                              "w-6 h-6 rounded-full border border-ink-200 transition-transform",
                              color === c && "ring-2 ring-ink-900 ring-offset-1"
                            )}
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                    </Field>
                  </div>

                  <Field label="מיקום">
                    <div className="relative">
                      <MapPin className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                      <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="field ps-9"
                        placeholder="כתובת או אולם..."
                      />
                    </div>
                  </Field>

                  <Field label="לינק וידאו">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Video className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                        <input
                          type="url"
                          value={videoCallUrl}
                          onChange={(e) => setVideoCallUrl(e.target.value)}
                          dir="ltr"
                          className="field ps-9"
                          placeholder="https://meet.google.com/..."
                        />
                      </div>
                      <button
                        disabled
                        className="btn-outline text-xs opacity-60 cursor-not-allowed"
                        title="בקרוב — יצירת Meet אוטומטית תגיע בפאזה 9b"
                        type="button"
                      >
                        🎥 צור Meet
                      </button>
                    </div>
                    <p className="text-[11px] text-ink-400 mt-1">
                      הדבק לינק Zoom / Teams / Meet ידנית, או המתן ליצירה אוטומטית
                      (בקרוב).
                    </p>
                  </Field>
                </div>
              )}

              {tab === "participants" && (
                <EventParticipantsSection
                  eventId={eventId}
                  ownerId={existing?.owner_id ?? null}
                />
              )}

              {tab === "recurrence" && (
                <RrulePicker
                  value={recurrenceRule}
                  onChange={setRecurrenceRule}
                  anchorDate={startsAt ? new Date(startsAt) : null}
                />
              )}

              {tab === "details" && existing?.source_thought_id && (
                <div className="mt-4">
                  <EventSourceThoughtRow
                    thoughtId={existing.source_thought_id}
                  />
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-ink-200 flex items-center gap-2">
              {isEdit && (
                <button
                  onClick={del}
                  className="btn-ghost text-danger-600 text-sm"
                  type="button"
                >
                  <Trash2 className="w-4 h-4" />
                  מחק
                </button>
              )}
              {dirty && (
                <span className="text-[11px] text-warning-600 me-auto">
                  יש שינויים לא שמורים
                </span>
              )}
              <div className={cn("flex items-center gap-2", !dirty && "ms-auto")}>
                <button onClick={handleClose} className="btn-ghost text-sm" type="button">
                  בטל
                </button>
                <button
                  onClick={save}
                  disabled={!title.trim()}
                  className="btn-accent text-sm"
                  type="button"
                >
                  {isEdit ? "שמור" : "צור אירוע"}
                </button>
              </div>
            </div>
          </motion.div>

          <UnsavedChangesGuard
            open={guardOpen}
            saving={updateEvent.isPending || createEvent.isPending}
            onSaveAndClose={async () => {
              const ok = await save();
              if (ok) setGuardOpen(false);
            }}
            onDiscardAndClose={() => {
              setGuardOpen(false);
              onClose();
            }}
            onCancel={() => setGuardOpen(false)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-2 border-b-2 -mb-px transition-colors",
        active
          ? "border-primary-500 text-primary-700 font-medium"
          : "border-transparent text-ink-600 hover:text-ink-900"
      )}
      type="button"
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="eyebrow mb-1 block">{label}</label>
      {children}
    </div>
  );
}

/** Banner shown in the details tab when the event was created from a thought. */
function EventSourceThoughtRow({ thoughtId }: { thoughtId: string }) {
  const { data: thought } = useThought(thoughtId);
  const [open, setOpen] = useState(false);
  if (!thought) return null;
  const label =
    thought.ai_generated_title ??
    (thought.text_content ?? "מחשבה").slice(0, 80);
  return (
    <>
      <div className="p-2 rounded-md border border-ink-200 bg-ink-50/40 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-accent-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-ink-500">נוצר מהמחשבה</div>
          <div className="text-sm text-ink-900 truncate">{label}</div>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
          type="button"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          פתח
        </button>
      </div>
      <ThoughtEditModal
        thoughtId={open ? thoughtId : null}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
