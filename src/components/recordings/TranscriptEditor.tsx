import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useRecordingSpeakers,
  useSaveRecordingTranscriptEdits,
} from "@/lib/hooks/useRecordings";
import type { Recording } from "@/lib/types/domain";

interface Utterance {
  speaker?: number;
  start?: number;
  end?: number;
  text?: string;
}

interface Props {
  recording: Recording;
  /**
   * Live <audio> element from the parent's AudioPlayer. Used for click-to-seek
   * + highlighting the row currently being played.
   */
  audioElement: HTMLAudioElement | null;
  className?: string;
}

const SAVE_DEBOUNCE_MS = 800;

// Pixel height of the prompter window. Rough guideline = ~5 average rows.
// Inactive rows are compact, active row grows; the window centers on the
// active row so neighbors fade in/out as audio progresses.
const PROMPTER_HEIGHT_PX = 320;

export function TranscriptEditor({ recording, audioElement, className }: Props) {
  const utterances = extractUtterances(recording);
  const { data: speakers = [] } = useRecordingSpeakers(recording.id);
  const save = useSaveRecordingTranscriptEdits();

  // Per-row text under edit. The map is sparse — only rows the user touched.
  // Once an edit lands successfully, the row drops out of `drafts` and reads
  // its text from the (now-fresh) `recording.transcript_json` again.
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const [savedFlash, setSavedFlash] = useState(false);

  // Highlight whichever utterance the audio is currently inside. We listen
  // directly on the element so we don't need to lift state into the parent.
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  useEffect(() => {
    if (!audioElement) return;
    const onUpdate = () => setCurrentTime(audioElement.currentTime);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    audioElement.addEventListener("timeupdate", onUpdate);
    audioElement.addEventListener("seeked", onUpdate);
    audioElement.addEventListener("play", onPlay);
    audioElement.addEventListener("pause", onPause);
    audioElement.addEventListener("ended", onPause);
    return () => {
      audioElement.removeEventListener("timeupdate", onUpdate);
      audioElement.removeEventListener("seeked", onUpdate);
      audioElement.removeEventListener("play", onPlay);
      audioElement.removeEventListener("pause", onPause);
      audioElement.removeEventListener("ended", onPause);
    };
  }, [audioElement]);

  const speakerLabels = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of speakers) {
      if (s.label?.trim()) map.set(s.speaker_index, s.label.trim());
    }
    return map;
  }, [speakers]);

  // Active row index, computed from currentTime. -1 when nothing matches
  // (e.g. before the first utterance starts or in a silence between rows).
  // We fall back to the last row whose start ≤ currentTime, so silences keep
  // the previous row highlighted instead of clearing the prompter.
  const activeIndex = useMemo(() => {
    let candidate = -1;
    for (let i = 0; i < utterances.length; i++) {
      const start = typeof utterances[i].start === "number" ? utterances[i].start! : 0;
      if (start <= currentTime) candidate = i;
      else break;
    }
    return candidate;
  }, [currentTime, utterances]);

  // Auto-scroll the prompter so the active row is centered. We scroll
  // imperatively rather than via CSS so we can ignore user-initiated scrolls
  // (so manual review during pause doesn't fight the prompter).
  const containerRef = useRef<HTMLOListElement | null>(null);
  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);
  const userScrolledAtRef = useRef<number>(0);
  useEffect(() => {
    if (activeIndex < 0) return;
    if (!isPlaying) return; // pause = let the user scroll freely
    // If the user manually scrolled in the last 4s, pause auto-follow so
    // we don't yank the view back while they're reviewing.
    if (Date.now() - userScrolledAtRef.current < 4_000) return;
    const row = rowRefs.current[activeIndex];
    const container = containerRef.current;
    if (!row || !container) return;
    const rowRect = row.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const desiredTop =
      row.offsetTop -
      container.clientHeight / 2 +
      rowRect.height / 2;
    container.scrollTo({ top: desiredTop, behavior: "smooth" });
    void containerRect; // silence unused; left for future debug
  }, [activeIndex, isPlaying]);

  // Debounced save — collect every dirty draft and flush together.
  useEffect(() => {
    if (Object.keys(drafts).length === 0) return;
    const handle = window.setTimeout(() => {
      const snapshot = draftsRef.current;
      const edits = Object.entries(snapshot).map(([k, v]) => ({
        index: Number(k),
        text: v,
      }));
      if (edits.length === 0) return;
      save.mutate(
        { recordingId: recording.id, edits },
        {
          onSuccess: () => {
            setDrafts((prev) => {
              const next = { ...prev };
              for (const { index, text } of edits) {
                if (next[index] === text) delete next[index];
              }
              return next;
            });
            setSavedFlash(true);
            window.setTimeout(() => setSavedFlash(false), 1500);
          },
        }
      );
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [drafts, recording.id, save]);

  const seekTo = (seconds: number) => {
    if (!audioElement) return;
    try {
      audioElement.currentTime = seconds;
      void audioElement.play().catch(() => {
        /* play may reject if not allowed; ignore — user can hit play. */
      });
    } catch {
      /* some browsers throw on unseekable streams; ignore. */
    }
  };

  if (utterances.length === 0) {
    return (
      <section
        className={cn(
          "rounded-md border border-ink-200 bg-ink-50 px-3 py-3 space-y-2",
          className
        )}
      >
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-700">
          <Sparkles className="w-3.5 h-3.5 text-primary-600" />
          תמלול
        </div>
        <p className="text-xs text-ink-700 leading-relaxed whitespace-pre-wrap">
          {recording.transcript_text || "אין טקסט תמלול."}
        </p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "rounded-md border border-ink-200 bg-ink-50 px-3 py-3 space-y-2",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-ink-700">
          <Sparkles className="w-3.5 h-3.5 text-primary-600" />
          תמלול
          {recording.speakers_count
            ? ` · ${recording.speakers_count} דוברים`
            : null}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-ink-500">
          {save.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
          {save.isPending && "שומרת…"}
          {!save.isPending && savedFlash && (
            <span className="inline-flex items-center gap-0.5 text-primary-600">
              <Check className="w-3 h-3" />
              נשמר
            </span>
          )}
          {!save.isPending && !savedFlash && (
            <span>לחיצה על שעה תקפיץ את ההשמעה.</span>
          )}
        </div>
      </div>

      <ol
        ref={containerRef}
        onScroll={() => {
          // Note: smooth scrollTo() also fires onScroll. We can't perfectly
          // distinguish, but a 4s window is short enough that manual scrolls
          // still pause auto-follow without pinning the prompter forever.
          userScrolledAtRef.current = Date.now();
        }}
        style={{ maxHeight: PROMPTER_HEIGHT_PX, scrollBehavior: "smooth" }}
        className="relative space-y-1.5 overflow-y-auto pe-1"
      >
        {utterances.map((u, i) => {
          const start = typeof u.start === "number" ? u.start : 0;
          const isActive = i === activeIndex;
          const isPast = i < activeIndex;
          const speakerName =
            typeof u.speaker === "number"
              ? speakerLabels.get(u.speaker) ?? `דובר ${u.speaker + 1}`
              : "—";
          const draft = drafts[i];
          const text = draft !== undefined ? draft : u.text ?? "";
          return (
            <li
              key={i}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              className={cn(
                "rounded-md border px-2.5 py-1.5 transition-all duration-200",
                isActive
                  ? "border-primary-400 bg-primary-100 shadow-sm"
                  : isPast
                  ? "border-ink-200 bg-white opacity-70"
                  : "border-ink-200 bg-white"
              )}
            >
              <div className="flex items-baseline gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => seekTo(start)}
                  className={cn(
                    "text-[11px] tabular-nums hover:underline shrink-0",
                    isActive ? "text-primary-800 font-semibold" : "text-primary-700"
                  )}
                  title="קפצי להשמעה מהזמן הזה"
                >
                  {formatTime(start)}
                </button>
                <span
                  className={cn(
                    "text-[11px] truncate",
                    isActive ? "text-ink-700 font-medium" : "text-ink-500"
                  )}
                >
                  {speakerName}
                </span>
              </div>
              <textarea
                value={text}
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [i]: e.target.value }))
                }
                rows={Math.max(1, Math.ceil(text.length / 80))}
                dir="auto"
                className={cn(
                  "w-full bg-transparent leading-relaxed resize-none outline-none focus:ring-1 focus:ring-primary-300 rounded-sm transition-[font-size,font-weight] duration-200",
                  isActive
                    ? "text-base text-ink-900 font-medium"
                    : "text-sm text-ink-800"
                )}
              />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function extractUtterances(recording: Recording): Utterance[] {
  const json = recording.transcript_json as
    | { transcription?: { utterances?: Utterance[] } }
    | null
    | undefined;
  return json?.transcription?.utterances ?? [];
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
