import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Send,
  X,
  Plus,
  CheckSquare,
  Calendar,
  FolderKanban,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useNavigate } from "react-router-dom";
import { useCreateThought } from "@/lib/hooks/useThoughts";
import { useCreateRecording } from "@/lib/hooks/useRecordings";
import { useCreateTask } from "@/lib/hooks/useTasks";
import { useFileUpload } from "@/lib/hooks/useFileUpload";
import { useOrgScope } from "@/lib/hooks/useOrgScope";
import {
  RecorderPanel,
  type RecorderPanelHandle,
} from "@/components/recordings/RecorderPanel";

interface QuickCaptureProps {
  open: boolean;
  onClose: () => void;
  currentPath: string;
}

type Mode = "menu" | "thought" | "recording";

export function QuickCapture({ open, onClose }: QuickCaptureProps) {
  const navigate = useNavigate();
  const scope = useOrgScope();
  const createThought = useCreateThought();
  const createRecording = useCreateRecording();
  const createTask = useCreateTask();
  const upload = useFileUpload();
  const recorderRef = useRef<RecorderPanelHandle>(null);

  const [mode, setMode] = useState<Mode>("menu");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "thought") {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open, mode]);

  // Reset everything when the modal closes.
  useEffect(() => {
    if (!open) {
      setMode("menu");
      setText("");
      setSaving(false);
      setError(null);
      setConfirmingClose(false);
      upload.reset();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const requestClose = () => {
    if (saving) return;
    if (mode === "recording" && recorderRef.current?.hasUnsaved()) {
      setConfirmingClose(true);
      return;
    }
    onClose();
  };

  // Esc closes (with confirmation if dirty)
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
  }, [open, mode, saving]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveThought = async () => {
    if (!text.trim() || !scope.enabled) return;
    setSaving(true);
    setError(null);
    try {
      await createThought.mutateAsync({
        source: "app_text",
        text_content: text.trim(),
      });
      setText("");
      onClose();
    } catch (err) {
      console.error("Failed to save thought:", err);
      setError("שמירה נכשלה. נסי שוב.");
    } finally {
      setSaving(false);
    }
  };

  const persistRecording = async (blob: Blob, durationSeconds: number) => {
    if (!scope.enabled) return;
    setError(null);
    setSaving(true);
    try {
      const ext = inferExtension(blob);
      const keySuffix = `recordings/${stamp()}-${rand()}.${ext}`;

      // Upload to R2 (single-PUT or multipart automatically based on size).
      const { key } = await upload.upload(blob, {
        keySuffix,
        contentType: blob.type || `audio/${ext}`,
      });

      // Persist the recording row.
      const recording = await createRecording.mutateAsync({
        source: "thought",
        title: defaultRecordingTitle(durationSeconds),
        storage_key: key,
        storage_provider: "r2",
        size_bytes: blob.size,
        duration_seconds: durationSeconds,
        mime_type: blob.type || `audio/${ext}`,
        status: "uploaded",
      });

      // Mirror it as an audio thought so it lands on the Thoughts screen too.
      await createThought.mutateAsync({
        source: "app_audio",
        recording_id: recording.id,
        text_content: null,
      });

      recorderRef.current?.discard();
      onClose();
    } catch (err) {
      console.error("Failed to save recording:", err);
      setError(humanizeError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndClose = async () => {
    const current = recorderRef.current?.getCurrent();
    if (!current) {
      setError("עצרי את ההקלטה לפני שמירה (כפתור 'סיום').");
      setConfirmingClose(false);
      return;
    }
    setConfirmingClose(false);
    await persistRecording(current.blob, current.durationSeconds);
  };

  const handleDiscardAndClose = () => {
    recorderRef.current?.discard();
    setConfirmingClose(false);
    onClose();
  };

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
              <h3 className="font-semibold text-ink-900">
                {mode === "menu" && "יצירה מהירה"}
                {mode === "thought" && "מחשבה מהירה"}
                {mode === "recording" && "הקלטה מהירה"}
              </h3>
              <button
                onClick={requestClose}
                disabled={saving}
                className="p-1.5 rounded-lg hover:bg-ink-100 disabled:opacity-50"
                aria-label="סגור"
              >
                <X className="w-4 h-4 text-ink-600" />
              </button>
            </div>

            <div className="p-5">
              {confirmingClose ? (
                <CloseConfirmation
                  onSaveAndClose={handleSaveAndClose}
                  onDiscardAndClose={handleDiscardAndClose}
                  onCancel={() => setConfirmingClose(false)}
                />
              ) : mode === "menu" ? (
                <div className="grid grid-cols-2 gap-3">
                  <MenuAction
                    icon={Mic}
                    label="הקלטה מהירה"
                    accent
                    onClick={() => setMode("recording")}
                  />
                  <MenuAction
                    icon={Plus}
                    label="מחשבה מוקלדת"
                    onClick={() => setMode("thought")}
                  />
                  <MenuAction
                    icon={CheckSquare}
                    label="משימה חדשה"
                    onClick={async () => {
                      try {
                        const t = await createTask.mutateAsync({
                          title: "",
                          task_list_id: null,
                          parent_task_id: null,
                          status: "todo",
                          urgency: 3,
                        });
                        onClose();
                        navigate(`/app/tasks?edit=${t.id}`);
                      } catch (err) {
                        console.error("quick task create failed:", err);
                        setError("יצירת משימה נכשלה. נסי שוב.");
                      }
                    }}
                  />
                  <MenuAction
                    icon={Calendar}
                    label="אירוע חדש"
                    onClick={() => {
                      onClose();
                      navigate("/app/calendar");
                    }}
                  />
                  <MenuAction
                    icon={FolderKanban}
                    label="פרויקט חדש"
                    onClick={() => {
                      onClose();
                      navigate("/app/projects");
                    }}
                  />
                </div>
              ) : mode === "thought" ? (
                <div className="space-y-3">
                  <textarea
                    ref={textareaRef}
                    className="field min-h-[120px] resize-none"
                    placeholder="מה עולה לך ברגע זה? Enter מוסיף, Shift+Enter לשורה חדשה..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={saving}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        saveThought();
                      }
                    }}
                  />
                  {error && <p className="text-xs text-danger-600">{error}</p>}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setMode("menu")}
                      className="btn-ghost"
                      disabled={saving}
                    >
                      חזרה
                    </button>
                    <button
                      onClick={saveThought}
                      disabled={!text.trim() || saving}
                      className="btn-accent"
                    >
                      <Send className="w-4 h-4" />
                      <span>{saving ? "שומרת..." : "שמרי"}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* mode === "recording" */
                <RecorderPanel
                  ref={recorderRef}
                  onSave={persistRecording}
                  saving={saving}
                  uploadProgress={uploadProgress}
                  errorText={error}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MenuAction({
  icon: Icon,
  label,
  onClick,
  accent,
}: {
  icon: typeof Mic;
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all hover:-translate-y-0.5",
        accent
          ? "border-primary-200 bg-primary-50 hover:bg-primary-100"
          : "border-ink-200 bg-white hover:bg-ink-50"
      )}
    >
      <Icon className={cn("w-6 h-6", accent ? "text-primary-700" : "text-ink-700")} />
      <span className="text-sm font-medium text-ink-900">{label}</span>
    </button>
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

function defaultRecordingTitle(durationSeconds: number): string {
  const now = new Date();
  const date = now.toLocaleDateString("he-IL", { day: "numeric", month: "long" });
  const time = now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  const m = Math.floor(durationSeconds / 60);
  const s = durationSeconds % 60;
  const dur = m > 0 ? `${m}:${String(s).padStart(2, "0")} דק׳` : `${s} שנ׳`;
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
