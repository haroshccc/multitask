import { useRef, useState } from "react";
import { Upload, FileAudio, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useFileUpload } from "@/lib/hooks/useFileUpload";
import { useCreateRecording } from "@/lib/hooks/useRecordings";
import { useRecordingsPageCtx } from "./context";

const ACCEPTED = "audio/*,video/*";
const MAX_BYTES = 500 * 1024 * 1024;

/**
 * Narrow tall upload widget — icon + button at the bottom. Drop-zone
 * behavior is preserved (drag a file onto the column to upload), but
 * the visual is icon-first since the column is only ~100px wide.
 */
export function UploadTallWidget() {
  const ctx = useRecordingsPageCtx();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const upload = useFileUpload();
  const createRecording = useCreateRecording();

  const handleFiles = async (filesList: FileList | null) => {
    setErrorText(null);
    if (!filesList || filesList.length === 0) return;
    const files = Array.from(filesList);

    let firstId: string | null = null;
    for (const file of files) {
      if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
        setErrorText(`"${file.name}" אינו אודיו/וידאו`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setErrorText(`"${file.name}" גדול מ־500MB`);
        continue;
      }
      try {
        const ext = inferExtension(file);
        const keySuffix = `recordings/${stamp()}-${rand()}.${ext}`;
        const { key } = await upload.upload(file, {
          keySuffix,
          contentType: file.type || `audio/${ext}`,
        });
        const rec = await createRecording.mutateAsync({
          source: "other",
          project_id: null,
          title: stripExtension(file.name),
          storage_key: key,
          storage_provider: "r2",
          size_bytes: file.size,
          mime_type: file.type || `audio/${ext}`,
          status: "uploaded",
        });
        if (!firstId) firstId = rec.id;
      } catch (err) {
        setErrorText(err instanceof Error ? err.message : "שגיאה בהעלאה");
      }
    }
    if (firstId) ctx.onUploaded(firstId);
  };

  const isUploading =
    upload.state.status === "single-upload" ||
    upload.state.status === "multipart-uploading" ||
    upload.state.status === "completing";
  const pct = upload.state.progress;

  return (
    <div
      className={cn(
        "card h-full w-full p-2 flex flex-col items-center justify-between gap-2 text-center transition-colors",
        isDragging && "border-primary-500 bg-primary-50",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {isUploading ? (
        <>
          <FileAudio className="w-7 h-7 text-primary-600 mt-1" />
          <p className="text-[10px] text-ink-700">
            מעלה {pct > 0 ? `${Math.round(pct)}%` : ""}
          </p>
          <div className="w-full h-1 bg-ink-150 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                isDragging
                  ? "bg-primary-500 text-white"
                  : "bg-ink-100 text-ink-600",
              )}
            >
              <Upload className="w-4 h-4" />
            </div>
            <p className="text-[11px] font-semibold text-ink-900 leading-tight">
              העלאת
              <br />
              קובץ
            </p>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="btn-outline !py-1.5 !px-2 !text-[11px] w-full justify-center"
          >
            בחירה
          </button>
        </>
      )}

      {errorText && (
        <p className="inline-flex items-center gap-1 text-[10px] text-danger-600 break-words text-start">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{errorText}</span>
        </p>
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
