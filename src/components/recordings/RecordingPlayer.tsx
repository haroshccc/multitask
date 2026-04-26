import { AlertCircle, Loader2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { useRecordingAudioUrl } from "@/lib/hooks/useRecordings";
import type { Recording } from "@/lib/types/domain";

interface Props {
  recording: Recording;
}

export function RecordingPlayer({ recording }: Props) {
  const { data: url, isLoading, error } = useRecordingAudioUrl(recording);

  return (
    <div className="card p-5 space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-ink-900">
          {recording.title || "ללא כותרת"}
        </h2>
        <p className="text-xs text-ink-500 mt-0.5">
          הועלתה {format(new Date(recording.created_at), "d בMMM yyyy, HH:mm", { locale: he })}
        </p>
      </header>

      <div>
        {recording.audio_archived ? (
          <div className="rounded-md border border-ink-300 bg-ink-50 px-3 py-3 text-sm text-ink-600 inline-flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-ink-400" />
            האודיו של הקלטה זו נמחק לפי מדיניות retention. המטא-דאטה נשמר.
          </div>
        ) : isLoading ? (
          <div className="rounded-md bg-ink-50 px-3 py-3 text-sm text-ink-500 inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            מביאה את הלינק…
          </div>
        ) : error || !url ? (
          <div className="rounded-md border border-danger-200 bg-danger-50 px-3 py-3 text-sm text-danger-700 inline-flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            לא הצלחתי להביא את האודיו. נסי לבחור שוב.
          </div>
        ) : (
          /* Native audio element — RTL-safe and a11y-friendly */
          <audio controls preload="metadata" src={url} className="w-full" />
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <Meta label="סטטוס" value={statusLabel(recording.status)} />
        <Meta label="מקור" value={sourceLabel(recording.source)} />
        <Meta label="אחסון" value={recording.storage_provider === "r2" ? "Cloudflare R2" : "Supabase Storage"} />
        <Meta label="MIME" value={recording.mime_type} />
      </div>

      {/* Phase 6ג placeholder — transcription + speaker tagging + extracted tasks */}
      <section className="rounded-md border border-dashed border-ink-300 bg-ink-50 px-3 py-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-700">
          <Sparkles className="w-3.5 h-3.5 text-primary-600" />
          תמלול וסיכום AI
        </div>
        <p className="mt-1 text-xs text-ink-500 leading-relaxed">
          חיבור Gladia (תמלול עברית + הפרדת דוברים) ו-Claude Haiku (סיכום וחילוץ
          משימות) מתוכננים לפאזה הבאה. כרגע הסטטוס נשאר{" "}
          <span className="font-medium text-ink-700">"הועלתה"</span> ואפשר להאזין.
        </p>
      </section>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-md bg-ink-50 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-400">{label}</div>
      <div className="text-xs text-ink-800 mt-0.5 truncate">{value ?? "—"}</div>
    </div>
  );
}

function statusLabel(status: Recording["status"]): string {
  switch (status) {
    case "recording":
      return "מקליטה";
    case "uploaded":
      return "הועלתה";
    case "transcribing":
      return "מתמללת";
    case "extracting":
      return "מחלצת משימות";
    case "ready":
      return "מוכנה";
    case "error":
      return "שגיאה";
  }
}

function sourceLabel(source: Recording["source"]): string {
  switch (source) {
    case "thought":
      return "מחשבה";
    case "call":
      return "שיחה";
    case "meeting":
      return "פגישה";
    default:
      return "אחר";
  }
}
