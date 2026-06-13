import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Square, Check, AlertTriangle, Loader2, ArrowRight } from "lucide-react";
import { useFileUpload } from "@/lib/hooks/useFileUpload";
import { useCreateRecording } from "@/lib/hooks/useRecordings";
import { cn } from "@/lib/utils/cn";

/**
 * One-tap "quick record" widget screen.
 *
 * Wired as a PWA manifest shortcut (/app/record): opening it immediately
 * requests the microphone and starts recording. Tapping "סיום" stops the
 * recording, uploads it to storage, creates the recording row, and bounces
 * to the Recordings list. If the browser blocks auto-start (no user
 * gesture), we fall back to a big tap-to-start button.
 */
type Phase = "starting" | "recording" | "uploading" | "done" | "error";

export function QuickRecord() {
  const navigate = useNavigate();
  const upload = useFileUpload();
  const createRecording = useCreateRecording();

  const [phase, setPhase] = useState<Phase>("starting");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const mimeRef = useRef<string>("audio/webm");
  // Guards React 18 StrictMode double-invocation of effects in dev.
  const startedRef = useRef(false);

  const stopTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const persist = useCallback(
    async (blob: Blob, durationSeconds: number) => {
      setPhase("uploading");
      try {
        const ext = blob.type.includes("mp4") ? "m4a" : "webm";
        const keySuffix = `recordings/${stamp()}-${rand()}.${ext}`;
        const { key } = await upload.upload(blob, {
          keySuffix,
          contentType: blob.type || `audio/${ext}`,
        });
        await createRecording.mutateAsync({
          source: "meeting",
          title: defaultTitle(durationSeconds),
          storage_key: key,
          storage_provider: "r2",
          size_bytes: blob.size,
          duration_seconds: durationSeconds,
          mime_type: blob.type || `audio/${ext}`,
          status: "uploaded",
        });
        setPhase("done");
        // Brief success beat, then jump to the recordings list.
        window.setTimeout(() => navigate("/app/recordings", { replace: true }), 900);
      } catch (err) {
        setError(humanizeError(err));
        setPhase("error");
      }
    },
    [upload, createRecording, navigate]
  );

  const start = useCallback(async () => {
    setError(null);
    setSeconds(0);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      mimeRef.current = mime;
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      });
      recorder.start();
      setPhase("recording");
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      console.error("Microphone access failed:", err);
      setError("לא ניתן לגשת למיקרופון. אשרי גישה ונסי שוב.");
      setPhase("error");
    }
  }, []);

  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    stopTimer();
    if (!recorder || recorder.state === "inactive") return;
    const duration = seconds;
    recorder.addEventListener(
      "stop",
      () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        cleanupStream();
        void persist(blob, duration);
      },
      { once: true }
    );
    recorder.stop();
  }, [seconds, persist]);

  // Auto-start on mount.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void start();
    return () => {
      stopTimer();
      cleanupStream();
      const r = mediaRecorderRef.current;
      if (r && r.state !== "inactive") r.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-full flex flex-col items-center justify-center gap-8 p-6 text-center">
      <button
        onClick={() => navigate("/app/recordings", { replace: true })}
        className="absolute top-4 start-4 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"
      >
        <ArrowRight className="w-4 h-4" />
        להקלטות
      </button>

      <header className="text-center">
        <h1 className="text-2xl font-bold text-ink-900">הקלטת פגישה / שיחה</h1>
        <p className="text-sm text-ink-500 mt-1">ההקלטה תישמר במסך ההקלטות</p>
      </header>

      <div
        className={cn(
          "w-32 h-32 rounded-full flex items-center justify-center transition-all",
          phase === "recording"
            ? "bg-gradient-to-br from-rose-500 to-rose-600 animate-pulse shadow-lift"
            : phase === "done"
            ? "bg-emerald-500"
            : phase === "error"
            ? "bg-ink-200"
            : "bg-ink-100"
        )}
      >
        {phase === "uploading" ? (
          <Loader2 className="w-12 h-12 text-ink-500 animate-spin" />
        ) : phase === "done" ? (
          <Check className="w-14 h-14 text-white" />
        ) : phase === "error" ? (
          <AlertTriangle className="w-12 h-12 text-amber-600" />
        ) : (
          <Mic className={cn("w-14 h-14", phase === "recording" ? "text-white" : "text-ink-500")} />
        )}
      </div>

      <div className="font-mono text-4xl text-ink-900 tabular-nums">{formatTime(seconds)}</div>

      <div className="min-h-[60px] flex items-center">
        {phase === "starting" && <p className="text-ink-500">מבקשת גישה למיקרופון…</p>}
        {phase === "recording" && (
          <button onClick={stop} className="btn-primary text-lg px-8 py-4">
            <Square className="w-5 h-5" />
            סיום ושמירה
          </button>
        )}
        {phase === "uploading" && <p className="text-ink-500">מעלה את ההקלטה…</p>}
        {phase === "done" && <p className="text-emerald-600 font-medium">נשמר! מעבירה להקלטות…</p>}
        {phase === "error" && (
          <div className="flex flex-col items-center gap-3">
            {error && <p className="text-sm text-danger-600 max-w-xs">{error}</p>}
            <button onClick={start} className="btn-accent">
              <Mic className="w-4 h-4" />
              התחל הקלטה
            </button>
          </div>
        )}
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

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function defaultTitle(durationSeconds: number): string {
  const now = new Date();
  const date = now.toLocaleDateString("he-IL", { day: "numeric", month: "long" });
  const time = now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  const m = Math.floor(durationSeconds / 60);
  const s = durationSeconds % 60;
  const dur = m > 0 ? `${m}:${String(s).padStart(2, "0")} דק׳` : `${s} שנ׳`;
  return `הקלטת פגישה ${date} ${time} (${dur})`;
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
