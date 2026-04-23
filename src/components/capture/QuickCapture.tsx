import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Send, X, Plus, CheckSquare, Calendar, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useNavigate } from "react-router-dom";
import { useCreateThought } from "@/lib/hooks/useThoughts";
import { useCreateRecording, useUploadRecordingBlob, useTriggerRecordingProcessing } from "@/lib/hooks/useRecordings";
import { useCreateTask } from "@/lib/hooks/useTasks";
import { useOrgScope } from "@/lib/hooks/useOrgScope";

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
  const uploadBlob = useUploadRecordingBlob();
  const triggerProcessing = useTriggerRecordingProcessing();
  const createTask = useCreateTask();

  const [mode, setMode] = useState<Mode>("menu");
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "thought") {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open, mode]);

  useEffect(() => {
    if (!open) {
      setMode("menu");
      setText("");
      setIsRecording(false);
      setSeconds(0);
      setSaving(false);
      setError(null);
      audioChunksRef.current = [];
      audioBlobRef.current = null;
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const startRecording = async () => {
    setError(null);
    setMode("recording");
    setSeconds(0);
    audioChunksRef.current = [];
    audioBlobRef.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      });
      recorder.addEventListener("stop", () => {
        audioBlobRef.current = new Blob(audioChunksRef.current, { type: mime });
        stream.getTracks().forEach((t) => t.stop());
      });
      recorder.start();
      setIsRecording(true);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      console.error("Microphone access denied:", err);
      setError("לא ניתן לגשת למיקרופון. אנא אשרי גישה ונסי שוב.");
      setMode("menu");
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

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

  const saveRecording = async () => {
    if (!audioBlobRef.current || !scope.enabled) return;
    setSaving(true);
    setError(null);
    try {
      // Build a stable storage path under the org/user.
      const ext = audioBlobRef.current.type.includes("mp4") ? "mp4" : "webm";
      const storagePath = `${scope.organizationId}/${scope.userId}/${Date.now()}.${ext}`;

      // Create recording row first (status='uploaded').
      const recording = await createRecording.mutateAsync({
        source: "thought",
        storage_path: storagePath,
        size_bytes: audioBlobRef.current.size,
        duration_seconds: seconds,
        mime_type: audioBlobRef.current.type,
        status: "uploaded",
      });

      // Upload the blob to Storage.
      await uploadBlob.mutateAsync({
        storagePath,
        blob: audioBlobRef.current,
      });

      // Create a linked thought so it lands on the Thoughts screen immediately.
      await createThought.mutateAsync({
        source: "app_audio",
        recording_id: recording.id,
        text_content: null,
      });

      // Kick off processing (transcription + extraction). Currently a stub.
      await triggerProcessing.mutateAsync(recording.id);

      onClose();
    } catch (err) {
      console.error("Failed to save recording:", err);
      setError("שמירת ההקלטה נכשלה. נסי שוב.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
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
                {mode === "recording" && (isRecording ? "מקליטה..." : "הקלטה")}
              </h3>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100">
                <X className="w-4 h-4 text-ink-600" />
              </button>
            </div>

            <div className="p-5">
              {mode === "menu" && (
                <div className="grid grid-cols-2 gap-3">
                  <MenuAction
                    icon={Mic}
                    label="הקלטה מהירה"
                    accent
                    onClick={startRecording}
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
                          task_list_id: null, // defaults to "לא משויכות"
                          parent_task_id: null,
                          status: "todo",
                          urgency: 3,
                        });
                        onClose();
                        // Take the user to the Tasks screen with the new task
                        // pre-opened in the edit modal; there they can set
                        // title, pick a list, etc.
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
              )}

              {mode === "thought" && (
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
              )}

              {mode === "recording" && (
                <div className="flex flex-col items-center gap-6 py-6">
                  <div
                    className={cn(
                      "w-24 h-24 rounded-full flex items-center justify-center transition-all",
                      isRecording
                        ? "bg-gradient-to-br from-danger-500 to-danger-600 animate-pulse shadow-lift"
                        : "bg-ink-100"
                    )}
                  >
                    <Mic className={cn("w-10 h-10", isRecording ? "text-white" : "text-ink-500")} />
                  </div>
                  <div className="font-mono text-3xl text-ink-900 tabular-nums">
                    {formatTime(seconds)}
                  </div>
                  {isRecording ? (
                    <button onClick={stopRecording} className="btn-primary">
                      <Square className="w-4 h-4" />
                      סיום הקלטה
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setMode("menu")} className="btn-ghost" disabled={saving}>
                        בטל
                      </button>
                      <button onClick={startRecording} className="btn-accent" disabled={saving}>
                        <Mic className="w-4 h-4" />
                        הקלטה חדשה
                      </button>
                      <button
                        onClick={saveRecording}
                        disabled={!audioBlobRef.current || saving}
                        className="btn-primary"
                      >
                        <Send className="w-4 h-4" />
                        {saving ? "מעלה..." : "שמרי"}
                      </button>
                    </div>
                  )}
                  {error && <p className="text-xs text-danger-600 text-center">{error}</p>}
                  {!isRecording && (
                    <p className="text-xs text-ink-500 text-center max-w-xs">
                      האודיו יעלה ל-Supabase Storage ויישמר כמחשבה. תמלול וחילוץ משימות יופעלו
                      כשה-AI יחובר.
                    </p>
                  )}
                </div>
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

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
