import { useRef, useState } from "react";
import { Upload, FileAudio, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useFileUpload } from "@/lib/hooks/useFileUpload";
import { useCreateRecording } from "@/lib/hooks/useRecordings";
import type { RecordingSource } from "@/lib/types/domain";

interface Props {
  source?: RecordingSource;
  onUploaded?: (recordingId: string) => void;
  className?: string;
}

const ACCEPTED = "audio/*";
const MAX_BYTES = 500 * 1024 * 1024; // SPEC §8 caps at 3h; 500MB covers MP3 320kbps × 3.5h.

export function RecordingDropZone({ source = "other", onUploaded, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const upload = useFileUpload();
  const createRecording = useCreateRecording();

  const handleFiles = async (files: FileList | null) => {
    setLocalError(null);
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setLocalError("רק קבצי אודיו נתמכים (MP3 / M4A / WebM / WAV).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError("הקובץ גדול מ־500MB.");
      return;
    }

    try {
      const ext = inferExtension(file);
      const keySuffix = `recordings/${stamp()}-${rand()}.${ext}`;

      // useFileUpload picks single PUT or multipart automatically by file size.
      const { key } = await upload.upload(file, {
        keySuffix,
        contentType: file.type || `audio/${ext}`,
      });

      // Persist the row pointing at the R2 object.
      const rec = await createRecording.mutateAsync({
        source,
        title: stripExtension(file.name),
        storage_key: key,
        storage_provider: "r2",
        size_bytes: file.size,
        mime_type: file.type || `audio/${ext}`,
        status: "uploaded",
      });
      onUploaded?.(rec.id);
    } catch (err) {
      setLocalError(humanizeError(err));
    }
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
    upload.state.status === "completing";
  const pct = upload.state.progress;
  const errorText =
    localError ?? (upload.state.status === "failed" ? upload.state.error : null);

  return (
    <div
      className={cn(
        "card p-5 sm:p-6 text-center transition-colors",
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
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {isUploading ? (
        <div className="flex flex-col items-center gap-3">
          <FileAudio className="w-10 h-10 text-primary-600" />
          <div className="text-sm text-ink-700">
            {labelForUploadStatus(upload.state.status)}
            {pct > 0 ? ` ${Math.round(pct)}%` : ""}
          </div>
          <div className="w-full max-w-md h-2 bg-ink-150 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
          {upload.state.uploadId && (
            <p className="text-[11px] text-ink-400">
              העלאה מתבצעת ב-chunks וניתנת להמשך אוטומטי גם אם הדפדפן ייסגר.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              isDragging ? "bg-primary-500 text-white" : "bg-ink-100 text-ink-600"
            )}
          >
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-ink-900">גררי קובץ אודיו לכאן</p>
            <p className="text-xs text-ink-500 mt-1">
              MP3 · M4A · WebM · WAV · עד 500MB
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="btn-outline"
          >
            בחירה מהמחשב
          </button>
        </div>
      )}

      {errorText && (
        <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-danger-600">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{errorText}</span>
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
  if (t.includes("mp4") || t.includes("m4a") || t.includes("aac")) return "m4a";
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
  if (msg.toLowerCase().includes("network")) return "תקלת רשת. בדקי חיבור.";
  return msg || "שגיאה לא צפויה בעת ההעלאה.";
}
