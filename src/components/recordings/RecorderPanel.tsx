import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Mic, Pause, Play, Square, Trash2, Send, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface RecorderPanelHandle {
  /** True while there is recorded audio (or live recording) that the parent should warn about losing. */
  hasUnsaved(): boolean;
  /** Snapshot of the finalized blob (after Stop). null if recording is still live or empty. */
  getCurrent(): { blob: Blob; durationSeconds: number } | null;
  /** Stops + discards everything, returns the panel to "idle". Called from the parent's close-confirmation. */
  discard(): void;
}

type RecState = "idle" | "recording" | "paused" | "stopped";

interface Props {
  /** Called when the user clicks "save". Parent is responsible for uploading + closing. */
  onSave: (blob: Blob, durationSeconds: number) => void | Promise<void>;
  /** Notify the parent so it can register a beforeunload guard, change UI, etc. */
  onDirtyChange?: (dirty: boolean) => void;
  /** When true, controls are disabled and a busy indicator is shown. */
  saving?: boolean;
  /** 0-100 while uploading; null otherwise. */
  uploadProgress?: number | null;
  /** Error from the parent's save flow. Cleared by the parent. */
  errorText?: string | null;
  className?: string;
}

const supportsPause =
  typeof MediaRecorder !== "undefined" &&
  typeof MediaRecorder.prototype.pause === "function" &&
  typeof MediaRecorder.prototype.resume === "function";

export const RecorderPanel = forwardRef<RecorderPanelHandle, Props>(function RecorderPanel(
  { onSave, onDirtyChange, saving = false, uploadProgress = null, errorText = null, className },
  ref
) {
  const [state, setState] = useState<RecState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<number | null>(null);
  const mimeRef = useRef<string>("audio/webm");

  // Keep parent informed about dirty state so it can confirm on close.
  useEffect(() => {
    const dirty = state !== "idle";
    onDirtyChange?.(dirty);
  }, [state, onDirtyChange]);

  // beforeunload guard while there's something at stake.
  useEffect(() => {
    if (state === "idle") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state]);

  const cleanupResources = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const r = recorderRef.current;
    if (r && r.state !== "inactive") {
      try {
        r.stop();
      } catch {
        /* already stopped */
      }
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Cleanup if the panel unmounts mid-recording.
  useEffect(() => () => cleanupResources(), [cleanupResources]);

  const startTimer = () => {
    if (timerRef.current != null) return;
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  };
  const pauseTimer = () => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStart = async () => {
    setMicError(null);
    setSeconds(0);
    chunksRef.current = [];
    blobRef.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      mimeRef.current = mime;
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      });
      recorder.addEventListener("stop", () => {
        blobRef.current = new Blob(chunksRef.current, { type: mime });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      });
      recorder.start(1000); // emit a chunk every second so we never lose >1s on crash
      setState("recording");
      startTimer();
    } catch (err) {
      console.error("microphone access denied:", err);
      setMicError("לא ניתן לגשת למיקרופון. אשרי גישה בדפדפן ונסי שוב.");
      setState("idle");
    }
  };

  const handlePause = () => {
    const r = recorderRef.current;
    if (!r || r.state !== "recording") return;
    r.pause();
    pauseTimer();
    setState("paused");
  };

  const handleResume = () => {
    const r = recorderRef.current;
    if (!r || r.state !== "paused") return;
    r.resume();
    startTimer();
    setState("recording");
  };

  const handleStop = () => {
    const r = recorderRef.current;
    pauseTimer();
    if (r && r.state !== "inactive") {
      r.stop(); // triggers the "stop" listener which builds blobRef.current
    }
    setState("stopped");
  };

  const handleDiscard = () => {
    cleanupResources();
    chunksRef.current = [];
    blobRef.current = null;
    setSeconds(0);
    setState("idle");
  };

  const handleSaveClick = async () => {
    if (!blobRef.current || saving) return;
    await onSave(blobRef.current, seconds);
  };

  useImperativeHandle(
    ref,
    (): RecorderPanelHandle => ({
      hasUnsaved: () => state !== "idle",
      getCurrent: () =>
        blobRef.current ? { blob: blobRef.current, durationSeconds: seconds } : null,
      discard: handleDiscard,
    }),
    [state, seconds]
  );

  // -------- Render --------

  const showPauseControl = supportsPause;
  const isLive = state === "recording" || state === "paused";

  return (
    <div className={cn("flex flex-col items-center gap-5 py-4", className)}>
      {/* Visual indicator */}
      <div
        className={cn(
          "w-28 h-28 rounded-full flex items-center justify-center transition-all",
          state === "recording" &&
            "bg-gradient-to-br from-danger-500 to-danger-600 animate-pulse shadow-lift",
          state === "paused" && "bg-amber-500 shadow-lift",
          state === "stopped" && "bg-emerald-500 shadow-lift",
          state === "idle" && "bg-ink-100"
        )}
      >
        {state === "paused" ? (
          <Pause className="w-12 h-12 text-white" />
        ) : (
          <Mic
            className={cn(
              "w-12 h-12",
              state === "idle" ? "text-ink-500" : "text-white"
            )}
          />
        )}
      </div>

      {/* Timer */}
      <div className="font-mono text-3xl text-ink-900 tabular-nums">
        {formatTime(seconds)}
        {state === "paused" && (
          <span className="ms-2 text-base font-sans text-amber-600">(השהיה)</span>
        )}
      </div>

      {/* Controls */}
      {saving ? (
        <div className="flex flex-col items-center gap-2 w-full max-w-md">
          <p className="text-sm text-ink-700">
            שומרת ומעלה ל-Cloudflare R2…
            {uploadProgress != null && uploadProgress > 0
              ? ` ${Math.round(uploadProgress)}%`
              : ""}
          </p>
          <div className="w-full h-2 bg-ink-150 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all duration-150"
              style={{ width: `${uploadProgress ?? 0}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {state === "idle" && (
            <button onClick={handleStart} className="btn-primary">
              <Mic className="w-4 h-4" />
              התחילי הקלטה
            </button>
          )}

          {isLive && (
            <>
              {showPauseControl &&
                (state === "recording" ? (
                  <button onClick={handlePause} className="btn-outline">
                    <Pause className="w-4 h-4" />
                    השהי
                  </button>
                ) : (
                  <button onClick={handleResume} className="btn-accent">
                    <Play className="w-4 h-4" />
                    המשיכי
                  </button>
                ))}
              <button onClick={handleStop} className="btn-dark">
                <Square className="w-4 h-4" />
                סיום
              </button>
            </>
          )}

          {state === "stopped" && (
            <>
              <button
                onClick={handleDiscard}
                className="btn-outline text-danger-700 border-danger-300 hover:bg-danger-50"
              >
                <Trash2 className="w-4 h-4" />
                מחקי
              </button>
              <button onClick={handleSaveClick} className="btn-primary">
                <Send className="w-4 h-4" />
                שמרי
              </button>
            </>
          )}
        </div>
      )}

      {/* Errors */}
      {(micError || errorText) && (
        <div className="inline-flex items-center gap-1.5 text-xs text-danger-600">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{micError ?? errorText}</span>
        </div>
      )}

      {/* Helper text */}
      {state === "idle" && !saving && (
        <p className="text-xs text-ink-500 text-center max-w-xs">
          לחצי כדי להתחיל. אפשר להשהות, להמשיך, ולסיים — ההקלטה אחת רציפה.
        </p>
      )}
      {state === "stopped" && !saving && (
        <p className="text-xs text-ink-500">
          ההקלטה מוכנה. שמרי כדי להעלות, או מחקי לזרוק.
        </p>
      )}
    </div>
  );
});

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
