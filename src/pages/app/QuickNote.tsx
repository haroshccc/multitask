import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Mic, Keyboard, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useOrgScope } from "@/lib/hooks/useOrgScope";
import { useCreateThought } from "@/lib/hooks/useThoughts";
import {
  useCreateRecording,
  useTriggerRecordingProcessing,
} from "@/lib/hooks/useRecordings";
import { useFileUpload } from "@/lib/hooks/useFileUpload";
import { useUserThoughtPreferences } from "@/lib/hooks/useUserThoughtPreferences";
import {
  RecorderPanel,
  type RecorderPanelHandle,
} from "@/components/recordings/RecorderPanel";

/**
 * Focused full-screen "quick note" surface (/app/note), wired as a PWA
 * shortcut so it gets its own home-screen icon. Lets you either type a note
 * or record a short voice note — both land on the Thoughts screen.
 *
 * (Meeting/call recordings live on /app/record and land in Recordings.)
 */
type Mode = "text" | "recording";

export function QuickNote() {
  const navigate = useNavigate();
  const scope = useOrgScope();
  const createThought = useCreateThought();
  const createRecording = useCreateRecording();
  const triggerRecording = useTriggerRecordingProcessing();
  const upload = useFileUpload();
  const { data: thoughtPrefs } = useUserThoughtPreferences();
  const autoTranscribe = thoughtPrefs?.auto_transcribe_recorded_thoughts ?? false;
  const recorderRef = useRef<RecorderPanelHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "text") setTimeout(() => textareaRef.current?.focus(), 60);
  }, [mode]);

  const saveText = async () => {
    if (!text.trim() || !scope.enabled) return;
    setSaving(true);
    setError(null);
    try {
      await createThought.mutateAsync({
        source: "app_text",
        text_content: text.trim(),
      });
      navigate("/app/thoughts", { replace: true });
    } catch (err) {
      console.error("Failed to save note:", err);
      setError(humanizeError(err));
      setSaving(false);
    }
  };

  const persistRecording = async (blob: Blob, durationSeconds: number) => {
    if (!scope.enabled) return;
    setSaving(true);
    setError(null);
    try {
      const ext = inferExtension(blob);
      const keySuffix = `recordings/${stamp()}-${rand()}.${ext}`;
      const { key } = await upload.upload(blob, {
        keySuffix,
        contentType: blob.type || `audio/${ext}`,
      });
      const recording = await createRecording.mutateAsync({
        source: "thought",
        title: noteTitle(durationSeconds),
        storage_key: key,
        storage_provider: "r2",
        size_bytes: blob.size,
        duration_seconds: durationSeconds,
        mime_type: blob.type || `audio/${ext}`,
        status: "uploaded",
      });
      // Mirror as an audio thought so it lands on the Thoughts screen.
      await createThought.mutateAsync({
        source: "app_audio",
        recording_id: recording.id,
        text_content: null,
      });
      if (autoTranscribe) triggerRecording.mutate(recording.id);
      recorderRef.current?.discard();
      navigate("/app/thoughts", { replace: true });
    } catch (err) {
      console.error("Failed to save voice note:", err);
      setError(humanizeError(err));
      setSaving(false);
    }
  };

  const uploadProgress =
    upload.state.status === "single-upload" ||
    upload.state.status === "multipart-uploading" ||
    upload.state.status === "completing"
      ? upload.state.progress
      : null;

  return (
    <div className="relative h-full flex flex-col max-w-lg mx-auto w-full p-4 sm:p-6" dir="rtl">
      <button
        onClick={() => navigate("/app/thoughts", { replace: true })}
        className="absolute top-3 start-3 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"
      >
        <ArrowRight className="w-4 h-4" />
        למחשבות
      </button>

      <header className="text-center mb-4 mt-8">
        <h1 className="text-2xl font-bold text-ink-900">הערה מהירה</h1>
        <p className="text-sm text-ink-500 mt-1">כתבי או הקליטי — נשמר במחשבות</p>
      </header>

      {/* Mode toggle */}
      <div className="inline-flex self-center rounded-xl border border-ink-200 overflow-hidden mb-4">
        <ModeTab
          active={mode === "text"}
          onClick={() => setMode("text")}
          icon={<Keyboard className="w-4 h-4" />}
          label="כתיבה"
        />
        <ModeTab
          active={mode === "recording"}
          onClick={() => setMode("recording")}
          icon={<Mic className="w-4 h-4" />}
          label="הקלטה"
        />
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {mode === "text" ? (
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            <textarea
              ref={textareaRef}
              className="field flex-1 min-h-[160px] resize-none"
              placeholder="מה עולה לך ברגע זה? Enter שומר, Shift+Enter לשורה חדשה…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={saving}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void saveText();
                }
              }}
            />
            {error && <p className="text-xs text-danger-600">{error}</p>}
            <button
              onClick={saveText}
              disabled={!text.trim() || saving}
              className="btn-primary self-end"
            >
              <Send className="w-4 h-4" />
              {saving ? "שומרת…" : "שמרי"}
            </button>
          </div>
        ) : (
          <RecorderPanel
            ref={recorderRef}
            onSave={persistRecording}
            saving={saving}
            uploadProgress={uploadProgress}
            errorText={error}
          />
        )}
      </div>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors",
        active ? "bg-ink-900 text-white" : "bg-white text-ink-600 hover:bg-ink-50"
      )}
    >
      {icon}
      {label}
    </button>
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
function noteTitle(durationSeconds: number): string {
  const now = new Date();
  const date = now.toLocaleDateString("he-IL", { day: "numeric", month: "long" });
  const time = now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  const m = Math.floor(durationSeconds / 60);
  const s = durationSeconds % 60;
  const dur = m > 0 ? `${m}:${String(s).padStart(2, "0")} דק׳` : `${s} שנ׳`;
  return `הערה קולית ${date} ${time} (${dur})`;
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
