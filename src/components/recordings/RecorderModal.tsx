import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle } from "lucide-react";
import { useFileUpload } from "@/lib/hooks/useFileUpload";
import { useCreateRecording } from "@/lib/hooks/useRecordings";
import type { RecordingSource } from "@/lib/types/domain";
import { RecorderPanel, type RecorderPanelHandle } from "./RecorderPanel";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Notified after the recording row is created. */
  onSaved?: (recordingId: string) => void;
  /** Defaults to "other" — Recordings page passes this; QuickCapture would pass "thought". */
  source?: RecordingSource;
  title?: string;
}

export function RecorderModal({
  open,
  onClose,
  onSaved,
  source = "other",
  title = "הקלטה חדשה",
}: Props) {
  const upload = useFileUpload();
  const createRecording = useCreateRecording();
  const recorderRef = useRef<RecorderPanelHandle>(null);

  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const isDirtyRef = useRef(false);

  // Reset everything when the modal opens.
  useEffect(() => {
    if (open) {
      setSaving(false);
      setErrorText(null);
      setConfirmingClose(false);
      upload.reset();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = async (blob: Blob, durationSeconds: number) => {
    setErrorText(null);
    setSaving(true);
    try {
      const ext = inferExtension(blob);
      const keySuffix = `recordings/${stamp()}-${rand()}.${ext}`;
      const { key } = await upload.upload(blob, {
        keySuffix,
        contentType: blob.type || `audio/${ext}`,
      });
      const rec = await createRecording.mutateAsync({
        source,
        title: defaultTitle(durationSeconds),
        storage_key: key,
        storage_provider: "r2",
        size_bytes: blob.size,
        duration_seconds: durationSeconds,
        mime_type: blob.type || `audio/${ext}`,
        status: "uploaded",
      });
      onSaved?.(rec.id);
      // Discard local recording state, then close.
      recorderRef.current?.discard();
      isDirtyRef.current = false;
      onClose();
    } catch (err) {
      setErrorText(humanizeError(err));
    } finally {
      setSaving(false);
    }
  };

  const requestClose = () => {
    if (saving) return; // don't let a close attempt cancel an in-flight save
    if (recorderRef.current?.hasUnsaved()) {
      setConfirmingClose(true);
      return;
    }
    onClose();
  };

  const handleSaveAndClose = async () => {
    const current = recorderRef.current?.getCurrent();
    if (!current) {
      // Live recording (not stopped yet): force-stop is too lossy of a UX.
      // Ask user to stop first.
      setErrorText("עצרי את ההקלטה לפני שמירה (כפתור 'סיום').");
      setConfirmingClose(false);
      return;
    }
    setConfirmingClose(false);
    await persist(current.blob, current.durationSeconds);
  };

  const handleDiscardAndClose = () => {
    recorderRef.current?.discard();
    isDirtyRef.current = false;
    setConfirmingClose(false);
    onClose();
  };

  // Esc: same logic as clicking X (with confirmation)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving]); // eslint-disable-line react-hooks/exhaustive-deps

  const uploadProgress =
    upload.state.status === "single-upload" ||
    upload.state.status === "multipart-uploading" ||
    upload.state.status === "completing"
      ? upload.state.progress
      : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            // Click on backdrop = same as X (with confirmation)
            if (e.target === e.currentTarget) requestClose();
          }}
          className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-lift w-full max-w-lg overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink-200">
              <h3 className="font-semibold text-ink-900">{title}</h3>
              <button
                onClick={requestClose}
                disabled={saving}
                className="p-1.5 rounded-lg hover:bg-ink-100 disabled:opacity-50"
                aria-label="סגור"
              >
                <X className="w-4 h-4 text-ink-600" />
              </button>
            </div>

            <div className="p-5 relative">
              <RecorderPanel
                ref={recorderRef}
                onSave={persist}
                onDirtyChange={(d) => (isDirtyRef.current = d)}
                saving={saving}
                uploadProgress={uploadProgress}
                errorText={errorText}
              />

              {confirmingClose && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center p-5">
                  <CloseConfirmation
                    onSaveAndClose={handleSaveAndClose}
                    onDiscardAndClose={handleDiscardAndClose}
                    onCancel={() => setConfirmingClose(false)}
                  />
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CloseConfirmation({
  onSaveAndClose,
  onDiscardAndClose,
  onCancel,
}: {
  onSaveAndClose: () => void;
  onDiscardAndClose: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <div className="text-center">
        <h4 className="font-semibold text-ink-900">יש הקלטה שלא נשמרה</h4>
        <p className="text-sm text-ink-600 mt-1">מה תרצי לעשות לפני סגירה?</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
        <button onClick={onSaveAndClose} className="btn-primary">
          שמרי וסגרי
        </button>
        <button
          onClick={onDiscardAndClose}
          className="btn-outline text-danger-700 border-danger-300 hover:bg-danger-50"
        >
          צאי בלי לשמור
        </button>
        <button onClick={onCancel} className="btn-ghost">
          המשיכי
        </button>
      </div>
    </div>
  );
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function rand() {
  return Math.random().toString(36).slice(2, 8);
}

function inferExtension(blob: Blob): string {
  const t = blob.type.toLowerCase();
  if (t.includes("mp4") || t.includes("m4a") || t.includes("aac")) return "m4a";
  if (t.includes("webm")) return "webm";
  if (t.includes("ogg") || t.includes("opus")) return "ogg";
  if (t.includes("wav")) return "wav";
  if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
  return "webm";
}

function defaultTitle(durationSeconds: number): string {
  const now = new Date();
  const date = now.toLocaleDateString("he-IL", { day: "numeric", month: "long" });
  const time = now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  const m = Math.floor(durationSeconds / 60);
  const s = durationSeconds % 60;
  const dur =
    m > 0
      ? `${m}:${String(s).padStart(2, "0")} דק׳`
      : `${s} שנ׳`;
  return `הקלטה ${date} ${time} (${dur})`;
}

function humanizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("no_active_org")) return "אין לך ארגון פעיל. צרי או הצטרפי לאחד.";
  if (msg.includes("not_authenticated") || msg.includes("invalid_jwt")) {
    return "ההתחברות פגה. רעני את הדף ונסי שוב.";
  }
  if (msg.toLowerCase().includes("network")) return "תקלת רשת. בדקי חיבור.";
  return msg || "שגיאה לא צפויה בעת השמירה.";
}
