import { AlertCircle, Sparkles, Link2 } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { useRecordingAudioUrl } from "@/lib/hooks/useRecordings";
import { AudioPlayer } from "@/components/recordings/AudioPlayer";
import { RecordingLinkagePanel } from "@/components/recordings/RecordingLinkagePanel";
import type { Recording } from "@/lib/types/domain";

interface Props {
  recording: Recording;
}

export function RecordingPlayer({ recording }: Props) {
  const { data: url, isLoading, error } = useRecordingAudioUrl(recording);

  const downloadFilename = buildDownloadFilename(recording);

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
        ) : (
          <AudioPlayer
            src={url}
            isLoading={isLoading}
            hasError={!!error}
            downloadFilename={downloadFilename}
          />
        )}
      </div>

      {/* Linkage section — replaces the old meta grid */}
      <section className="rounded-md bg-ink-50 px-3 py-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-700">
          <Link2 className="w-3.5 h-3.5 text-ink-500" />
          שיוך
        </div>
        <RecordingLinkagePanel recording={recording} />
      </section>

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

function buildDownloadFilename(recording: Recording): string {
  // Take the extension from storage_key tail, fallback by mime.
  const keyTail = recording.storage_key.split("/").pop() ?? "";
  const ext =
    keyTail.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ??
    extFromMime(recording.mime_type);
  const stem = (recording.title?.trim() || "recording")
    .replace(/[\\/:*?"<>|]/g, "-")
    .slice(0, 80);
  return `${stem}.${ext}`;
}

function extFromMime(t: string): string {
  const s = (t ?? "").toLowerCase();
  if (s.includes("mpeg") || s.includes("mp3")) return "mp3";
  if (s.includes("mp4") || s.includes("m4a") || s.includes("aac")) return "m4a";
  if (s.includes("webm")) return "webm";
  if (s.includes("ogg") || s.includes("opus")) return "ogg";
  if (s.includes("wav")) return "wav";
  return "audio";
}
