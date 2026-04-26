import { Mic, Phone, Users, FileAudio, Clock, HardDrive } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils/cn";
import type { Recording, RecordingSource, RecordingStatus } from "@/lib/types/domain";

interface Props {
  recording: Recording;
  isActive: boolean;
  onSelect: () => void;
}

export function RecordingCard({ recording, isActive, onSelect }: Props) {
  const SourceIcon = sourceIcon(recording.source);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-start rounded-lg border bg-white px-3 py-3 transition-all",
        "hover:border-ink-400 hover:shadow-soft",
        isActive
          ? "border-primary-500 bg-primary-50 shadow-soft"
          : "border-ink-300"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "shrink-0 w-9 h-9 rounded-md flex items-center justify-center",
            isActive ? "bg-primary-500 text-white" : "bg-ink-100 text-ink-600"
          )}
        >
          <SourceIcon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm text-ink-900 truncate">
              {recording.title || "ללא כותרת"}
            </p>
            <StatusBadge status={recording.status} />
          </div>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-ink-500">
            <span>{format(new Date(recording.created_at), "d בMMM, HH:mm", { locale: he })}</span>
            {recording.duration_seconds != null && (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(recording.duration_seconds)}
              </span>
            )}
            {recording.size_bytes > 0 && (
              <span className="inline-flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                {formatBytes(recording.size_bytes)}
              </span>
            )}
            {recording.storage_provider === "supabase" && (
              <span className="text-ink-400">legacy</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function sourceIcon(source: RecordingSource) {
  switch (source) {
    case "thought":
      return Mic;
    case "call":
      return Phone;
    case "meeting":
      return Users;
    default:
      return FileAudio;
  }
}

function StatusBadge({ status }: { status: RecordingStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "shrink-0 inline-flex items-center rounded-xs px-1.5 py-0.5 text-[10px] font-medium",
        meta.className
      )}
    >
      {meta.label}
    </span>
  );
}

const STATUS_META: Record<RecordingStatus, { label: string; className: string }> = {
  recording: { label: "מקליטה", className: "bg-danger-100 text-danger-700" },
  uploaded: { label: "הועלתה", className: "bg-ink-150 text-ink-700" },
  transcribing: { label: "מתמללת", className: "bg-primary-100 text-primary-700" },
  extracting: { label: "מחלצת", className: "bg-primary-100 text-primary-700" },
  ready: { label: "מוכנה", className: "bg-emerald-100 text-emerald-700" },
  error: { label: "שגיאה", className: "bg-danger-100 text-danger-700" },
};

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)} שנ׳`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}:${String(s).padStart(2, "0")}`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}:${String(mm).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}
