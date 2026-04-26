import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Download,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Props {
  /** Presigned URL for the audio. Comes from useRecordingAudioUrl. */
  src: string | null | undefined;
  isLoading?: boolean;
  hasError?: boolean;
  /** Filename to suggest for the download. */
  downloadFilename?: string;
  className?: string;
}

async function downloadFromUrl(url: string, suggestedName: string) {
  // Cross-origin presigned URLs ignore the <a download> filename and the
  // browser plays the media instead of saving it. Pull the bytes ourselves and
  // anchor a blob URL so the download dialog respects the suggested name.
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download_failed_${res.status}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Free the blob URL after the click handler runs.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const SKIP_SECONDS = 10;

export function AudioPlayer({
  src,
  isLoading = false,
  hasError = false,
  downloadFilename,
  className,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<number>(1);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Keep playbackRate in sync with the speed state.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  // When the src changes, reset everything.
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  if (isLoading) {
    return (
      <div className={cn("rounded-md bg-ink-50 px-3 py-3 text-sm text-ink-500 inline-flex items-center gap-2", className)}>
        <Loader2 className="w-4 h-4 animate-spin" />
        מביאה את הלינק…
      </div>
    );
  }
  if (hasError || !src) {
    return (
      <div className={cn("rounded-md border border-danger-200 bg-danger-50 px-3 py-3 text-sm text-danger-700 inline-flex items-center gap-2", className)}>
        <AlertCircle className="w-4 h-4" />
        לא הצלחתי להביא את האודיו. נסי לבחור שוב.
      </div>
    );
  }

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play();
    else a.pause();
  };

  const skipBy = (deltaSeconds: number) => {
    const a = audioRef.current;
    if (!a || !isFinite(a.duration)) return;
    a.currentTime = clamp(a.currentTime + deltaSeconds, 0, a.duration);
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Number(e.target.value);
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn("space-y-3", className)}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => {
          const d = (e.currentTarget as HTMLAudioElement).duration;
          if (isFinite(d)) setDuration(d);
        }}
        onTimeUpdate={(e) => setCurrentTime((e.currentTarget as HTMLAudioElement).currentTime)}
      />

      {/* Seek bar */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-ink-600 tabular-nums w-10 text-end">
          {formatTime(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={onSeek}
          disabled={!duration}
          aria-label="מיקום בהקלטה"
          className="flex-1 accent-primary-500"
          style={{
            background: `linear-gradient(to left, var(--tw-gradient-from, #f59e0b) 0%, var(--tw-gradient-from, #f59e0b) ${progressPct}%, #e5e7eb ${progressPct}%, #e5e7eb 100%)`,
          }}
        />
        <span className="text-xs text-ink-600 tabular-nums w-10">
          {formatTime(duration)}
        </span>
      </div>

      {/* Transport controls */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => skipBy(-SKIP_SECONDS)}
          className="btn-ghost"
          title="חזור 10 שניות"
          aria-label="חזור 10 שניות"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-xs">10</span>
        </button>

        <button
          onClick={togglePlay}
          className="btn-primary !px-5 !py-3"
          aria-label={playing ? "השהי" : "נגני"}
        >
          {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>

        <button
          onClick={() => skipBy(SKIP_SECONDS)}
          className="btn-ghost"
          title="קדימה 10 שניות"
          aria-label="קדימה 10 שניות"
        >
          <span className="text-xs">10</span>
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Speed + download row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-ink-400 ms-1">
            מהירות
          </span>
          <div className="flex items-center gap-1 rounded-md bg-ink-50 p-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cn(
                  "px-2 py-0.5 text-[11px] rounded transition-colors tabular-nums",
                  speed === s
                    ? "bg-white text-ink-900 shadow-soft font-medium"
                    : "text-ink-600 hover:text-ink-900"
                )}
                title={`מהירות ${s}×`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        {/* Download — fetches the bytes and saves with the suggested filename */}
        <div className="flex items-center gap-2">
          {downloadError && (
            <span className="text-[11px] text-danger-600 inline-flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {downloadError}
            </span>
          )}
          <button
            onClick={async () => {
              setDownloadError(null);
              setDownloading(true);
              try {
                await downloadFromUrl(src, downloadFilename ?? "recording");
              } catch (err) {
                setDownloadError("הורדה נכשלה");
                console.error("download failed:", err);
              } finally {
                setDownloading(false);
              }
            }}
            disabled={downloading}
            className="btn-outline !py-1.5 !px-3"
            title="הורד את ההקלטה"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="text-xs">{downloading ? "מורידה…" : "הורידי"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function formatTime(seconds: number) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
