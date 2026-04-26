import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Download,
  AlertCircle,
  Loader2,
  Gauge,
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<number>(1);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [speedOpen, setSpeedOpen] = useState(false);
  // True while we're seeking past the end on purpose to coax the browser
  // into computing the real duration of an Opus/WebM stream that reported
  // `Infinity` on metadata. Time-update events during this window are
  // ignored so the seek bar doesn't jump to ~3 hours.
  const probingDurationRef = useRef(false);

  // Web Audio nodes for the live waveform visualizer.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // Keep playbackRate in sync with the speed state.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  // When the src changes, reset everything (and tear down audio graph).
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    // The MediaElementSource is bound to the <audio> element 1:1 — once
    // attached, switching src is fine; we don't recreate the graph here.
  }, [src]);

  // Tear down on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      try {
        sourceNodeRef.current?.disconnect();
        analyserRef.current?.disconnect();
        audioCtxRef.current?.close();
      } catch {
        /* already torn down */
      }
    };
  }, []);

  /** Lazily build the AudioContext + AnalyserNode on first play. */
  function ensureAudioGraph() {
    if (audioCtxRef.current || !audioRef.current) return;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      const ctx = new Ctor();
      const source = ctx.createMediaElementSource(audioRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      sourceNodeRef.current = source;
      analyserRef.current = analyser;
    } catch (err) {
      // Likely a CORS issue (presigned URL without `crossOrigin="anonymous"`
      // or R2 not returning Access-Control-Allow-Origin on the GET). The audio
      // still plays through the <audio> element — just no waveform.
      console.warn("audio analyser unavailable:", err);
    }
  }

  function startVisualizer() {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;

    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    const binCount = analyser.frequencyBinCount;
    const data = new Uint8Array(binCount);

    const draw = () => {
      const audio = audioRef.current;
      if (!audio || audio.paused) {
        rafRef.current = null;
        return;
      }
      analyser.getByteFrequencyData(data);
      const cssWidth = canvas.clientWidth;
      const cssHeight = canvas.clientHeight;
      ctx2d.clearRect(0, 0, cssWidth, cssHeight);

      // Auto-size the bar count by canvas width so the visualizer feels
      // dense on desktop (~1 bar per 6 px) without smearing on mobile.
      const BAR_COUNT = Math.max(
        32,
        Math.min(160, Math.floor(cssWidth / 6))
      );
      const binsPerBar = Math.max(1, Math.floor(binCount / BAR_COUNT));
      const gap = cssWidth >= 600 ? 1 : 2;
      const barWidth = (cssWidth - gap * (BAR_COUNT - 1)) / BAR_COUNT;

      for (let i = 0; i < BAR_COUNT; i++) {
        // Average a few neighboring bins so the bars feel chunky rather than spiky.
        let sum = 0;
        for (let j = 0; j < binsPerBar; j++) {
          sum += data[i * binsPerBar + j] ?? 0;
        }
        const avg = sum / binsPerBar / 255; // 0..1
        const minHeight = 2;
        const barHeight = Math.max(minHeight, avg * cssHeight);
        const x = i * (barWidth + gap);
        const y = cssHeight - barHeight;

        // Vertical gradient: brand yellow at the top, deeper amber at the base.
        const grad = ctx2d.createLinearGradient(0, y, 0, cssHeight);
        grad.addColorStop(0, "#facc15");
        grad.addColorStop(1, "#f59e0b");
        ctx2d.fillStyle = grad;
        ctx2d.fillRect(x, y, barWidth, barHeight);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
  }

  function stopVisualizer() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const canvas = canvasRef.current;
    const ctx2d = canvas?.getContext("2d");
    if (canvas && ctx2d) ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Resize the canvas on first mount to its CSS size.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx2d = canvas.getContext("2d");
    if (ctx2d) ctx2d.scale(dpr, dpr);
  }, []);

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

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      // Build the audio graph + resume the context on first user gesture.
      ensureAudioGraph();
      try {
        if (audioCtxRef.current?.state === "suspended") {
          await audioCtxRef.current.resume();
        }
      } catch {
        /* ignore */
      }
      await a.play();
    } else {
      a.pause();
    }
  };

  const skipBy = (deltaSeconds: number) => {
    const a = audioRef.current;
    if (!a) return;
    // Some recordings (Opus in WebM) report `duration === Infinity` until the
    // stream finishes downloading, so we can't gate seek on isFinite. Just
    // clamp the floor and let the browser handle the upper bound.
    const target = a.currentTime + deltaSeconds;
    if (target < 0) {
      a.currentTime = 0;
    } else if (isFinite(a.duration)) {
      a.currentTime = Math.min(target, a.duration);
    } else {
      a.currentTime = target;
    }
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Number(e.target.value);
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn("space-y-3", className)}>
      {/* crossOrigin lets the AnalyserNode read the buffer; if the response
          doesn't allow it, the audio still plays — only the waveform is blank */}
      <audio
        ref={audioRef}
        src={src}
        crossOrigin="anonymous"
        preload="metadata"
        onPlay={() => {
          setPlaying(true);
          startVisualizer();
        }}
        onPause={() => {
          setPlaying(false);
          stopVisualizer();
        }}
        onEnded={() => {
          setPlaying(false);
          stopVisualizer();
        }}
        onLoadedMetadata={(e) => {
          const a = e.currentTarget as HTMLAudioElement;
          if (isFinite(a.duration)) {
            setDuration(a.duration);
          } else {
            // WebM/Opus typically reports Infinity until the stream finishes
            // downloading. Seek past the end so the browser computes the real
            // duration; we'll clamp the cursor and snap back to 0 in
            // onDurationChange.
            probingDurationRef.current = true;
            try {
              a.currentTime = 1e10;
            } catch {
              /* some browsers throw if seeking on an unseekable stream */
            }
          }
        }}
        onDurationChange={(e) => {
          const a = e.currentTarget as HTMLAudioElement;
          if (isFinite(a.duration)) {
            setDuration(a.duration);
            if (probingDurationRef.current) {
              probingDurationRef.current = false;
              a.currentTime = 0;
              setCurrentTime(0);
            }
          }
        }}
        onTimeUpdate={(e) => {
          if (probingDurationRef.current) return;
          setCurrentTime((e.currentTarget as HTMLAudioElement).currentTime);
        }}
      />

      {/* Waveform visualizer — drawn while playing, blank while paused */}
      <canvas
        ref={canvasRef}
        className="w-full h-12 rounded-md bg-ink-50 block"
        aria-hidden
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
            background: `linear-gradient(to left, #f59e0b 0%, #f59e0b ${progressPct}%, #e5e7eb ${progressPct}%, #e5e7eb 100%)`,
          }}
        />
        <span className="text-xs text-ink-600 tabular-nums w-10">
          {formatTime(duration)}
        </span>
      </div>

      {/* Single transport row: skip / play / skip — with speed + download icons on the right */}
      <div className="flex items-center justify-center gap-2 relative">
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

        {/* Speed icon + popup, and download icon — anchored to the row's leading edge */}
        <div className="absolute end-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {/* Speed */}
          <div className="relative">
            <button
              onClick={() => setSpeedOpen((v) => !v)}
              className={cn(
                "p-2 rounded-xl transition-colors",
                speedOpen
                  ? "bg-ink-900 text-white"
                  : "text-ink-600 hover:bg-ink-100"
              )}
              title={`מהירות ${speed}×`}
              aria-label="מהירות השמעה"
            >
              {/* In RTL flex-row, the first DOM child renders rightmost — so
                  the speed label sits visually to the right of the gauge icon. */}
              <span className="text-[10px] tabular-nums me-0.5">{speed}×</span>
              <Gauge className="w-4 h-4" />
            </button>
            {speedOpen && (
              <>
                {/* Click-away backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setSpeedOpen(false)}
                />
                <div className="absolute z-20 top-full mt-1 end-0 bg-white border border-ink-200 rounded-md shadow-lift p-1 flex flex-col gap-0.5 min-w-[64px]">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSpeed(s);
                        setSpeedOpen(false);
                      }}
                      className={cn(
                        "px-2 py-1 text-xs rounded text-start tabular-nums transition-colors",
                        speed === s
                          ? "bg-primary-100 text-primary-700 font-medium"
                          : "text-ink-700 hover:bg-ink-100"
                      )}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Download — fetches the bytes and saves with the suggested filename */}
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
            className="p-2 rounded-xl text-ink-600 hover:bg-ink-100 disabled:opacity-50"
            title="הורידי הקלטה"
            aria-label="הורידי הקלטה"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {downloadError && (
        <div className="text-[11px] text-danger-600 inline-flex items-center gap-1 justify-center w-full">
          <AlertCircle className="w-3 h-3" />
          {downloadError}
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
