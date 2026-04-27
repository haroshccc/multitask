import { useEffect, useRef, useState } from "react";
import { Upload, FileAudio, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useFileUpload } from "@/lib/hooks/useFileUpload";
import { useCreateRecording } from "@/lib/hooks/useRecordings";
import type { RecordingSource } from "@/lib/types/domain";

interface Props {
  source?: RecordingSource;
  onUploaded?: (recordingId: string) => void;
  className?: string;
}

const ACCEPTED = "audio/*,video/*";
const MAX_BYTES = 500 * 1024 * 1024; // SPEC §8 caps at 3h; 500MB covers MP3 320kbps × 3.5h.

export function RecordingDropZone({ source = "other", onUploaded, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  // Batch counters — populated when the user picks/drops more than one file.
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchIndex, setBatchIndex] = useState(0);
  const upload = useFileUpload();
  const createRecording = useCreateRecording();

  const handleFiles = async (filesList: FileList | null) => {
    setLocalError(null);
    if (!filesList || filesList.length === 0) return;
    const incoming = Array.from(filesList);

    // Validate every file up-front so we don't mid-upload abort with a bad
    // file in slot 5 of 10.
    const valid: File[] = [];
    const validationErrors: string[] = [];
    for (const f of incoming) {
      if (!f.type.startsWith("audio/") && !f.type.startsWith("video/")) {
        validationErrors.push(`"${f.name}" אינו אודיו/וידאו`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        validationErrors.push(`"${f.name}" גדול מ־500MB`);
        continue;
      }
      valid.push(f);
    }

    if (valid.length === 0) {
      setLocalError(validationErrors.join(" · "));
      return;
    }

    setBatchTotal(valid.length);
    setBatchIndex(0);

    let firstUploadedId: string | null = null;
    const uploadErrors: string[] = [...validationErrors];

    for (let i = 0; i < valid.length; i++) {
      setBatchIndex(i + 1);
      const file = valid[i];
      try {
        const ext = inferExtension(file);
        const keySuffix = `recordings/${stamp()}-${rand()}.${ext}`;
        const { key } = await upload.upload(file, {
          keySuffix,
          contentType: file.type || `audio/${ext}`,
        });
        const rec = await createRecording.mutateAsync({
          source,
          title: stripExtension(file.name),
          storage_key: key,
          storage_provider: "r2",
          size_bytes: file.size,
          mime_type: file.type || `audio/${ext}`,
          status: "uploaded",
        });
        if (!firstUploadedId) firstUploadedId = rec.id;
      } catch (err) {
        uploadErrors.push(`"${file.name}": ${humanizeError(err)}`);
      }
    }

    setBatchTotal(0);
    setBatchIndex(0);

    if (uploadErrors.length > 0) {
      setLocalError(uploadErrors.join(" · "));
    }
    // Land the user on the first newly-uploaded recording so they can fan
    // through the rest in upload order. Successful files persist their rows
    // before we get here, so the list re-renders with all of them regardless.
    if (firstUploadedId) onUploaded?.(firstUploadedId);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const isUploading =
    upload.state.status === "single-upload" ||
    upload.state.status === "multipart-open" ||
    upload.state.status === "multipart-uploading" ||
    upload.state.status === "completing" ||
    batchTotal > 0;
  const pct = upload.state.progress;
  const errorText =
    localError ?? (upload.state.status === "failed" ? upload.state.error : null);

  // Stuck-detector. When we sit in `completing` for a long time, surface a
  // hint to the user so they don't think the page froze; after the cap they
  // can manually cancel and try again instead of waiting for the timeout.
  const [completingDots, setCompletingDots] = useState(0);
  useEffect(() => {
    if (upload.state.status !== "completing") {
      setCompletingDots(0);
      return;
    }
    const id = window.setInterval(() => {
      setCompletingDots((d) => d + 1);
    }, 1500);
    return () => window.clearInterval(id);
  }, [upload.state.status]);
  const stuckSeconds = completingDots * 1.5;
  const showStuckHint = upload.state.status === "completing" && stuckSeconds > 8;

  return (
    <div
      className={cn(
        "card p-4 flex flex-col items-center justify-center text-center transition-colors",
        isDragging && "border-primary-500 bg-primary-50",
        isUploading && "opacity-90",
        className
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          // Reset so the same file(s) can be re-picked after a failure.
          e.target.value = "";
        }}
      />

      {isUploading ? (
        <div className="flex flex-col items-center gap-2 w-full">
          <FileAudio className="w-8 h-8 text-primary-600" />
          <div className="text-xs text-ink-700">
            {batchTotal > 1 && (
              <span className="text-primary-700 font-medium">
                קובץ {batchIndex} מתוך {batchTotal} ·{" "}
              </span>
            )}
            {labelForUploadStatus(upload.state.status)}
            {pct > 0 ? ` ${Math.round(pct)}%` : ""}
          </div>
          <div className="w-full max-w-md h-1.5 bg-ink-150 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
          {showStuckHint && (
            <div className="flex flex-col items-center gap-2 mt-1">
              <p className="text-[11px] text-ink-500 leading-snug max-w-xs">
                R2 מסיים לאחד את החתיכות. לקבצי וידאו גדולים זה יכול לקחת
                כמה עשרות שניות. אם זה לא ממשיך — אפשר לבטל ולהעלות שוב.
              </p>
              <button
                type="button"
                onClick={() => {
                  void upload.cancel();
                  setBatchTotal(0);
                  setBatchIndex(0);
                  setLocalError("ההעלאה בוטלה. נסי שוב.");
                }}
                className="btn-outline !py-0.5 !px-2 !text-[11px] inline-flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                ביטול ונסי שוב
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2.5">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              isDragging ? "bg-primary-500 text-white" : "bg-ink-100 text-ink-600"
            )}
          >
            <Upload className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-ink-900">
            גררי קובץ אודיו או וידאו
          </p>
          <p className="text-xs text-ink-500 -mt-1">
            אפשר גם כמה ביחד · MP3 · M4A · MP4 · MOV · WebM · WAV · עד 500MB
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="btn-outline !py-1.5 !px-3"
          >
            בחירה מהמחשב
          </button>
        </div>
      )}

      {errorText && (
        <div className="mt-3 inline-flex items-start gap-1.5 text-xs text-danger-600 max-w-full text-start">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="break-words">{errorText}</span>
        </div>
      )}
    </div>
  );
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function rand() {
  return Math.random().toString(36).slice(2, 8);
}

function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function inferExtension(file: File): string {
  const m = file.name.match(/\.([a-z0-9]+)$/i);
  if (m) return m[1].toLowerCase();
  const t = file.type.toLowerCase();
  if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
  if (t.startsWith("video/mp4")) return "mp4";
  if (t.includes("mp4") || t.includes("m4a") || t.includes("aac")) return "m4a";
  if (t.includes("quicktime") || t.includes("mov")) return "mov";
  if (t.includes("webm")) return "webm";
  if (t.includes("ogg") || t.includes("opus")) return "ogg";
  if (t.includes("wav")) return "wav";
  if (t.includes("flac")) return "flac";
  return "bin";
}

function labelForUploadStatus(status: string): string {
  switch (status) {
    case "single-upload":
      return "מעלה ל-R2…";
    case "multipart-open":
      return "מתחילה העלאה מרובת חלקים…";
    case "multipart-uploading":
      return "מעלה chunks…";
    case "completing":
      return "מסיימת…";
    default:
      return "מעלה…";
  }
}

function humanizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("no_active_org")) return "אין לך ארגון פעיל. צרי או הצטרפי לאחד.";
  if (msg.includes("not_authenticated") || msg.includes("invalid_jwt")) {
    return "ההתחברות פגה. רעני את הדף ונסי שוב.";
  }
  if (msg.includes("_timeout:")) {
    return "ההעלאה לקחה יותר מדי זמן. נסי שוב — לקבצי וידאו גדולים זה יכול לקרות.";
  }
  if (msg.toLowerCase().includes("network")) return "תקלת רשת. בדקי חיבור.";
  return msg || "שגיאה לא צפויה בעת ההעלאה.";
}
