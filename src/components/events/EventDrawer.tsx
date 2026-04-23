import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon,
  Loader2,
  MapPin,
  Save,
  StickyNote,
  Trash2,
  Video,
  X,
} from "lucide-react";
import type { EventRow, EventUpdate } from "@/lib/types/domain";
import {
  useCreateEvent,
  useDeleteEvent,
  useUpdateEvent,
} from "@/lib/queries/events";
import { useAuth } from "@/lib/auth/AuthContext";

type Mode =
  | { kind: "edit"; event: EventRow }
  | { kind: "create"; defaultStartsAt?: Date };

interface Props {
  mode: Mode;
  onClose: () => void;
}

function toLocalInputValue(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}

export function EventDrawer({ mode, onClose }: Props) {
  const { user, activeOrganizationId } = useAuth();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const initialEvent = mode.kind === "edit" ? mode.event : null;
  const initialStart =
    mode.kind === "edit"
      ? new Date(mode.event.starts_at)
      : mode.defaultStartsAt ?? new Date();
  const initialEnd =
    mode.kind === "edit"
      ? new Date(mode.event.ends_at)
      : new Date(initialStart.getTime() + 60 * 60 * 1000);

  const [title, setTitle] = useState(initialEvent?.title ?? "");
  const [description, setDescription] = useState(initialEvent?.description ?? "");
  const [allDay, setAllDay] = useState(initialEvent?.all_day ?? false);
  const [startsLocal, setStartsLocal] = useState(toLocalInputValue(initialStart));
  const [endsLocal, setEndsLocal] = useState(toLocalInputValue(initialEnd));
  const [location, setLocation] = useState(initialEvent?.location ?? "");
  const [videoUrl, setVideoUrl] = useState(initialEvent?.video_call_url ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode.kind === "edit") {
      const ev = mode.event;
      setTitle(ev.title);
      setDescription(ev.description ?? "");
      setAllDay(ev.all_day);
      setStartsLocal(toLocalInputValue(new Date(ev.starts_at)));
      setEndsLocal(toLocalInputValue(new Date(ev.ends_at)));
      setLocation(ev.location ?? "");
      setVideoUrl(ev.video_call_url ?? "");
      setError(null);
    }
  }, [mode.kind === "edit" ? mode.event.id : null]); // eslint-disable-line react-hooks/exhaustive-deps

  const saving = createEvent.isPending || updateEvent.isPending;

  const handleSave = async () => {
    if (!title.trim()) {
      setError("כותרת נדרשת");
      return;
    }
    const startsAt = fromLocalInputValue(startsLocal);
    const endsAt = fromLocalInputValue(endsLocal);
    if (!startsAt || !endsAt) {
      setError("מועד התחלה וסיום נדרשים");
      return;
    }
    if (new Date(endsAt) < new Date(startsAt)) {
      setError("הסיום חייב להיות אחרי ההתחלה");
      return;
    }
    setError(null);

    try {
      if (mode.kind === "edit") {
        const patch: EventUpdate = {
          title: title.trim(),
          description: description.trim() || null,
          all_day: allDay,
          starts_at: startsAt,
          ends_at: endsAt,
          location: location.trim() || null,
          video_call_url: videoUrl.trim() || null,
        };
        await updateEvent.mutateAsync({ id: mode.event.id, patch });
      } else {
        if (!user || !activeOrganizationId) {
          setError("חסר ארגון פעיל");
          return;
        }
        await createEvent.mutateAsync({
          orgId: activeOrganizationId,
          ownerId: user.id,
          title: title.trim(),
          description: description.trim() || undefined,
          startsAt,
          endsAt,
          allDay,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async () => {
    if (mode.kind !== "edit") return;
    if (!confirm("למחוק את האירוע?")) return;
    await deleteEvent.mutateAsync(mode.event.id);
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-sm flex items-stretch justify-start"
      >
        <motion.aside
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ type: "spring", stiffness: 400, damping: 36 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white w-full max-w-md h-full flex flex-col shadow-lift"
        >
          <header className="flex items-center justify-between px-5 py-3 border-b border-ink-200 shrink-0">
            <h3 className="font-semibold text-ink-900 text-sm flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-ink-500" />
              {mode.kind === "edit" ? "עריכת אירוע" : "אירוע חדש"}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-ink-100"
              aria-label="סגירה"
            >
              <X className="w-4 h-4 text-ink-600" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
            <Field label="כותרת">
              <input
                className="field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                placeholder="פגישה / שיחה / אירוע"
              />
            </Field>

            <Field label="תיאור">
              <textarea
                className="field min-h-[60px] resize-y"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="פרטים (אופציונלי)"
              />
            </Field>

            <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
              />
              אירוע יום שלם
            </label>

            <div className="grid grid-cols-2 gap-3">
              <Field label="התחלה" icon={CalendarIcon}>
                <input
                  type="datetime-local"
                  className="field"
                  value={startsLocal}
                  onChange={(e) => setStartsLocal(e.target.value)}
                />
              </Field>
              <Field label="סיום" icon={CalendarIcon}>
                <input
                  type="datetime-local"
                  className="field"
                  value={endsLocal}
                  onChange={(e) => setEndsLocal(e.target.value)}
                />
              </Field>
            </div>

            <Field label="מיקום" icon={MapPin}>
              <input
                className="field"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="כתובת / חדר"
              />
            </Field>

            <Field label="קישור שיחה" icon={Video}>
              <input
                className="field"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://meet.google.com/..."
              />
            </Field>

            {error && (
              <div className="text-xs text-danger-600 bg-danger-500/10 border border-danger-500/20 rounded-xl px-3 py-2">
                {error}
              </div>
            )}
          </div>

          <footer className="flex items-center justify-between gap-2 px-5 py-3 border-t border-ink-200 shrink-0">
            {mode.kind === "edit" ? (
              <button
                onClick={handleDelete}
                className="btn-ghost text-danger-600 hover:bg-danger-500/10"
                disabled={deleteEvent.isPending}
              >
                <Trash2 className="w-4 h-4" />
                מחק
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-ghost">
                ביטול
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-accent">
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                שמרי
              </button>
            </div>
          </footer>
        </motion.aside>
      </motion.div>
    </AnimatePresence>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: typeof CalendarIcon | typeof StickyNote;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-sm font-medium text-ink-800 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-ink-500" />}
        {label}
      </span>
      {children}
    </label>
  );
}
