import { useRef, useState } from "react";
import { Upload, FileAudio, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useUploadRecordingWithProgress } from "@/lib/hooks/useRecordings";
import type { RecordingSource } from "@/lib/types/domain";

interface Props {
  source?: RecordingSource;
  onUploaded?: (recordingId: string) => void;
  className?: string;
}

const ACCEPTED_TYPES = "audio/*";
const MAX_BYTES = 500 * 1024 * 1024; // 500MB cap (UI hint; SPEC §8 supports up to 3h)

export function RecordingDropZone({
  source = "other",
  onUploaded,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const upload = useUploadRecordingWithProgress();

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
      const rec = await upload.start({
        blob: file,
        source,
        title: stripExtension(file.name),
        filename: file.name,
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

  const isUploading = upload.isUploading;
  const pct = upload.progress != null ? Math.round(upload.progress * 100) : null;
  const errorText = localError ?? (upload.error ? humanizeError(upload.error) : null);

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
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {isUploading ? (
        <div className="flex flex-col items-center gap-3">
          <FileAudio className="w-10 h-10 text-primary-600" />
          <div className="text-sm text-ink-700">
            מעלה ל-Cloudflare R2…{pct != null ? ` ${pct}%` : ""}
          </div>
          <div className="w-full max-w-md h-2 bg-ink-150 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all duration-150"
              style={{ width: `${pct ?? 0}%` }}
            />
          </div>
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
            <p className="text-sm font-medium text-ink-900">
              גררי קובץ אודיו לכאן
            </p>
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

function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function humanizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("no_active_org")) return "אין לך ארגון פעיל. צרי או הצטרפי לאחד.";
  if (msg.includes("invalid_jwt") || msg.includes("missing_auth"))
    return "ההתחברות פגה. רעני את הדף ונסי שוב.";
  if (msg.toLowerCase().includes("network")) return "תקלת רשת. בדקי חיבור.";
  return msg || "שגיאה לא צפויה בעת ההעלאה.";
}
