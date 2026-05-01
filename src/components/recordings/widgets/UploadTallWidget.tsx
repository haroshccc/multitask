import { useEffect, useRef, useState } from "react";
import { Upload, AlertCircle, Loader2, X } from "lucide-react";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 640,
  );
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return isMobile;
}
import { cn } from "@/lib/utils/cn";
import { useFileUpload } from "@/lib/hooks/useFileUpload";
import { useCreateRecording } from "@/lib/hooks/useRecordings";
import { useRecordingsPageCtx } from "./context";

const ACCEPTED = "audio/*,video/*";
const MAX_BYTES = 500 * 1024 * 1024;

/**
 * Compact horizontal upload banner — fits in the recordings page's
 * single-row top strip (h=1). The whole card is a drop zone AND a click
 * target that opens the file picker. Layout mirrors QuickRecordTallWidget
 * for visual consistency: leading icon, label in the middle, action pill
 * on the left.
 *
 * Full upload flow (validation, multi-file, progress) is preserved — just
 * surfaced compactly. Errors render as a small banner below.
 */
export function UploadTallWidget() {
  const ctx = useRecordingsPageCtx();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchIndex, setBatchIndex] = useState(0);
  const upload = useFileUpload();
  const createRecording = useCreateRecording();

  const isUploading =
    upload.state.status === "single-upload" ||
    upload.state.status === "multipart-open" ||
    upload.state.status === "multipart-uploading" ||
    upload.state.status === "completing" ||
    batchTotal > 0;

  // Stuck-detector for `completing` state — same UX as the full DropZone.
  const [completingDots, setCompletingDots] = useState(0);
  useEffect(() => {
    if (upload.state.status !== "completing") {
      setCompletingDots(0);
      return;
    }
    const id = window.setInterval(() => setCompletingDots((d) => d + 1), 1500);
    return () => window.clearInterval(id);
  }, [upload.state.status]);
  const showStuckHint =
    upload.state.status === "completing" && completingDots * 1.5 > 8;

  const handleFiles = async (filesList: FileList | null) => {
    setLocalError(null);
    if (!filesList || filesList.length === 0) return;
    const incoming = Array.from(filesList);
    const valid: File[] = [];
    const errors: string[] = [];
    for (const f of incoming) {
      if (!f.type.startsWith("audio/") && !f.type.startsWith("video/")) {
        errors.push(`"${f.name}" אינו אודיו/וידאו`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        errors.push(`"${f.name}" גדול מ־500MB`);
        continue;
      }
      valid.push(f);
    }
    if (valid.length === 0) {
      setLocalError(errors.join(" · "));
      return;
    }
    setBatchTotal(valid.length);
    setBatchIndex(0);
    let firstId: string | null = null;
    for (let i = 0; i < valid.length; i++) {
      setBatchIndex(i + 1);
      const file = valid[i];
      try {
        const ext = inferExt(file);
        const keySuffix = `recordings/${stamp()}-${rand()}.${ext}`;
        const { key } = await upload.upload(file, {
          keySuffix,
          contentType: file.type || `audio/${ext}`,
        });
        const rec = await createRecording.mutateAsync({
          source: "other",
          title: stripExt(file.name),
          storage_key: key,
          storage_provider: "r2",
          size_bytes: file.size,
          mime_type: file.type || `audio/${ext}`,
          status: "uploaded",
        });
        if (!firstId) firstId = rec.id;
      } catch (err) {
        errors.push(`"${file.name}": ${humanError(err)}`);
      }
    }
    setBatchTotal(0);
    setBatchIndex(0);
    if (errors.length) setLocalError(errors.join(" · "));
    if (firstId) ctx.onUploaded(firstId);
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
  const openPicker = () => inputRef.current?.click();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="h-full flex flex-col">
        <button
          type="button"
          onClick={openPicker}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "card h-full w-full flex items-center justify-center gap-2",
            isDragging && "border-primary-500 bg-primary-50",
            isUploading && "opacity-90",
          )}
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
          <span
            className={cn(
              "w-7 h-7 shrink-0 rounded-full flex items-center justify-center",
              isDragging ? "bg-primary-500 text-white" : "bg-ink-100 text-ink-600",
            )}
          >
            {isUploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
          </span>
          <span className="text-sm font-semibold text-ink-900">
            {isUploading ? `${Math.round(upload.state.progress)}%` : "העלאה"}
          </span>
        </button>
        {localError && (
          <div className="mt-1 inline-flex items-start gap-1 text-[10px] text-danger-600">
            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="break-words truncate">{localError}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <button
        type="button"
        onClick={openPicker}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "card h-full w-full px-3",
          "flex items-center gap-3",
          "transition-all hover:-translate-y-0.5 hover:shadow-lift",
          isDragging && "border-primary-500 bg-primary-50",
          isUploading && "opacity-90"
        )}
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

        <span
          className={cn(
            "w-9 h-9 shrink-0 rounded-full flex items-center justify-center",
            isDragging ? "bg-primary-500 text-white" : "bg-ink-100 text-ink-600"
          )}
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
        </span>

        <span className="flex-1 min-w-0 text-start">
          {isUploading ? (
            <>
              <span className="block text-sm font-semibold text-ink-900 truncate">
                {batchTotal > 1
                  ? `קובץ ${batchIndex} מתוך ${batchTotal}`
                  : labelForStatus(upload.state.status)}
              </span>
              <span className="block text-[11px] text-ink-500 truncate">
                {Math.round(upload.state.progress)}%
              </span>
            </>
          ) : (
            <>
              <span className="block text-sm font-semibold text-ink-900 truncate">
                גררי קובץ או לחצי
              </span>
              <span className="block text-[11px] text-ink-500 truncate">
                MP3 · M4A · MP4 · MOV · WebM · WAV · עד 500MB
              </span>
            </>
          )}
        </span>

        <span className="btn-outline !py-1.5 !px-3 pointer-events-none shrink-0 text-xs">
          בחירה
        </span>
      </button>

      {/* Progress bar — slides under the card while uploading. */}
      {isUploading && (
        <div className="h-0.5 mt-1 bg-ink-150 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 transition-all duration-150"
            style={{ width: `${upload.state.progress}%` }}
          />
        </div>
      )}

      {showStuckHint && (
        <div className="text-[10px] text-ink-500 mt-1 inline-flex items-center gap-1">
          R2 מסיים אחסון…
          <button
            type="button"
            onClick={() => {
              void upload.cancel();
              setBatchTotal(0);
              setBatchIndex(0);
              setLocalError("ההעלאה בוטלה. נסי שוב.");
            }}
            className="text-primary-700 hover:underline inline-flex items-center gap-0.5"
          >
            <X className="w-3 h-3" />
            ביטול
          </button>
        </div>
      )}

      {localError && (
        <div className="mt-1 inline-flex items-start gap-1 text-[11px] text-danger-600">
          <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
          <span className="break-words">{localError}</span>
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
function stripExt(name: string) {
  return name.replace(/\.[^.]+$/, "");
}
function inferExt(file: File): string {
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
  return "bin";
}
function labelForStatus(s: string): string {
  switch (s) {
    case "single-upload":
      return "מעלה…";
    case "multipart-open":
      return "מתחילה…";
    case "multipart-uploading":
      return "מעלה chunks…";
    case "completing":
      return "מסיימת…";
    default:
      return "מעלה…";
  }
}
function humanError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("no_active_org")) return "אין ארגון פעיל";
  if (msg.includes("not_authenticated") || msg.includes("invalid_jwt"))
    return "ההתחברות פגה";
  if (msg.includes("_timeout:")) return "ההעלאה ארוכה מדי";
  if (msg.toLowerCase().includes("network")) return "תקלת רשת";
  return msg || "שגיאה";
}
