import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Video,
  MapPin,
  Trash2,
  Users,
  Repeat,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useEvent,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
} from "@/lib/hooks/useEvents";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { EventParticipantsSection } from "./EventParticipantsSection";
import { RrulePicker } from "./RrulePicker";

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
  onClose: () => void;
}

type Tab = "details" | "participants" | "recurrence";

export function EventEditModal({
  open,
  eventId,
  initialStart,
  initialEnd,
  onClose,
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
      setTab("details");
    } else if (!isEdit) {
      const s = initialStart ?? new Date();
      const e = initialEnd ?? new Date(s.getTime() + 60 * 60_000);
      setTitle("");
      setDescription("");
      setLocation("");
      setVideoCallUrl("");
      setAllDay(false);
      setStartsAt(s.toISOString());
      setEndsAt(e.toISOString());
      setRecurrenceRule(null);
      setTab("details");
    }
  }, [open, isEdit, existing, initialStart, initialEnd]);

  const save = async () => {
    if (!title.trim() || !startsAt || !endsAt) return;
    const payload = {
      title: title.trim(),
      description: description || null,
      location: location || null,
      video_call_url: videoCallUrl || null,
      all_day: allDay,
      starts_at: startsAt,
      ends_at: endsAt,
      recurrence_rule: recurrenceRule,
    };
    if (isEdit && eventId) {
      await updateEvent.mutateAsync({ eventId, patch: payload });
    } else {
      await createEvent.mutateAsync(payload);
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
          onClick={onClose}
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
              <h3 className="text-lg font-semibold text-ink-900">
                {isEdit ? "עריכת אירוע" : "אירוע חדש"}
              </h3>
              <button
                onClick={onClose}
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
              <div className="ms-auto flex items-center gap-2">
                <button onClick={onClose} className="btn-ghost text-sm" type="button">
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
