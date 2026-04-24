import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Video, MapPin, Trash2 } from "lucide-react";
import {
  useEvent,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
} from "@/lib/hooks/useEvents";
import type { EventRow } from "@/lib/types/domain";

/**
 * Event edit modal — SPEC §16. A lighter cousin of TaskEditModal, scoped to
 * the events table only. Used when the calendar's "+" creates an event or a
 * user clicks an existing event on the grid.
 *
 * Props:
 * - `eventId = null` + `initialStart` present → creation mode.
 * - `eventId` set → edit mode (loads row by id).
 */

interface EventEditModalProps {
  open: boolean;
  eventId: string | null;
  /** When creating a new event, seed the start/end from the click target. */
  initialStart?: Date;
  initialEnd?: Date;
  onClose: () => void;
}

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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [videoCallUrl, setVideoCallUrl] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  // Hydrate when modal opens or the source row changes.
  useEffect(() => {
    if (!open) return;
    if (isEdit && existing) {
      setTitle(existing.title);
      setDescription(existing.description ?? "");
      setLocation(existing.location ?? "");
      setVideoCallUrl(existing.video_call_url ?? "");
      setAllDay(existing.all_day);
      setStartsAt(existing.starts_at.slice(0, 16));
      setEndsAt(existing.ends_at.slice(0, 16));
    } else if (!isEdit) {
      const s = initialStart ?? new Date();
      const e = initialEnd ?? new Date(s.getTime() + 60 * 60_000);
      setTitle("");
      setDescription("");
      setLocation("");
      setVideoCallUrl("");
      setAllDay(false);
      setStartsAt(toLocalInput(s));
      setEndsAt(toLocalInput(e));
    }
  }, [open, isEdit, existing, initialStart, initialEnd]);

  const save = async () => {
    if (!title.trim()) return;
    const payload = {
      title: title.trim(),
      description: description || null,
      location: location || null,
      video_call_url: videoCallUrl || null,
      all_day: allDay,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
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
            className="bg-white rounded-3xl shadow-lift w-full max-w-xl my-8 overflow-hidden"
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

            <div className="p-5 space-y-4">
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
                  <input
                    type={allDay ? "date" : "datetime-local"}
                    value={allDay ? startsAt.slice(0, 10) : startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="field"
                  />
                </Field>
                <Field label="סיום">
                  <input
                    type={allDay ? "date" : "datetime-local"}
                    value={allDay ? endsAt.slice(0, 10) : endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="field"
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
                <div className="relative">
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
                <p className="text-[11px] text-ink-400 mt-1">
                  יצירת Meet אוטומטית — בקרוב (שלב 9b).
                </p>
              </Field>
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

function toLocalInput(d: Date): string {
  // YYYY-MM-DDTHH:MM — matches <input type="datetime-local"> expected value.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Helper: read-only peek at an event (for code that wants to type-guard). ------
export function isEventRow(x: unknown): x is EventRow {
  return !!x && typeof x === "object" && "starts_at" in (x as Record<string, unknown>);
}
