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

/** A display "row" — N consecutive same-speaker utterances joined into one. */
interface Block {
  speaker: number | undefined;
  start: number;
  end: number;
  text: string;
  /** Indexes into the raw `utterances` array that contributed to this block. */
  source: number[];
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
const PROMPTER_HEIGHT_PX = 320;
// Grouping rules — we collapse consecutive same-speaker utterances into one
// row, but if a single uninterrupted block runs longer than this we force-cut
// it into roughly TARGET-second chunks at utterance boundaries so a long
// monologue doesn't end up as one wall of text.
const FORCE_SPLIT_AFTER_S = 15;
const TARGET_CHUNK_S = 10;

export function TranscriptEditor({ recording, audioElement, className }: Props) {
  const utterances = extractUtterances(recording);
  const { data: speakers = [] } = useRecordingSpeakers(recording.id);
  const save = useSaveRecordingTranscriptEdits();

  // Drafts keyed by block index — sparse map of rows the user touched.
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const [savedFlash, setSavedFlash] = useState(false);

  // Audio time tracking for active-row highlighting.
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

  // Compute display blocks from raw utterances.
  const blocks = useMemo(() => groupUtterances(utterances), [utterances]);

  // Drop drafts whose block index no longer exists (e.g. after a save we
  // collapsed N utterances into 1 and the block count dropped).
  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<number, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (Number(k) < blocks.length) next[Number(k)] = v;
      }
      return next;
    });
  }, [blocks.length]);

  // Active block index, derived from currentTime.
  const activeIndex = useMemo(() => {
    let candidate = -1;
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].start <= currentTime) candidate = i;
      else break;
    }
    return candidate;
  }, [currentTime, blocks]);

  // Auto-scroll prompter — same logic as before, just keyed off blocks now.
  const containerRef = useRef<HTMLOListElement | null>(null);
  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);
  const userScrolledAtRef = useRef<number>(0);
  useEffect(() => {
    if (activeIndex < 0) return;
    if (!isPlaying) return;
    if (Date.now() - userScrolledAtRef.current < 4_000) return;
    const row = rowRefs.current[activeIndex];
    const container = containerRef.current;
    if (!row || !container) return;
    const desiredTop =
      row.offsetTop -
      container.clientHeight / 2 +
      row.getBoundingClientRect().height / 2;
    container.scrollTo({ top: desiredTop, behavior: "smooth" });
  }, [activeIndex, isPlaying]);

  // Debounced save. For each dirty BLOCK we have to write back into the
  // underlying utterances array — the first source utterance gets the new
  // edited text, the rest are blanked so the next render's grouping still
  // joins them into one block (just from one populated source instead of N).
  useEffect(() => {
    if (Object.keys(drafts).length === 0) return;
    const handle = window.setTimeout(() => {
      const snapshot = draftsRef.current;
      const blockEdits = Object.entries(snapshot)
        .map(([k, v]) => ({ blockIndex: Number(k), text: v }))
        .filter((e) => e.blockIndex < blocks.length);
      if (blockEdits.length === 0) return;
      const utteranceEdits: { index: number; text: string }[] = [];
      for (const e of blockEdits) {
        const block = blocks[e.blockIndex];
        if (!block) continue;
        for (let i = 0; i < block.source.length; i++) {
          utteranceEdits.push({
            index: block.source[i],
            text: i === 0 ? e.text : "",
          });
        }
      }
      save.mutate(
        { recordingId: recording.id, edits: utteranceEdits },
        {
          onSuccess: () => {
            setDrafts((prev) => {
              const next = { ...prev };
              for (const e of blockEdits) {
                if (next[e.blockIndex] === e.text) delete next[e.blockIndex];
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
  }, [drafts, recording.id, save, blocks]);

  const seekTo = (seconds: number) => {
    if (!audioElement) return;
    try {
      audioElement.currentTime = seconds;
      void audioElement.play().catch(() => {
        /* play may reject if not allowed; ignore. */
      });
    } catch {
      /* unseekable streams; ignore. */
    }
  };

  if (blocks.length === 0) {
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
          userScrolledAtRef.current = Date.now();
        }}
        style={{ maxHeight: PROMPTER_HEIGHT_PX, scrollBehavior: "smooth" }}
        className="relative space-y-1.5 overflow-y-auto pe-1"
      >
        {blocks.map((b, i) => {
          const isActive = i === activeIndex;
          const isPast = i < activeIndex;
          const speakerName =
            typeof b.speaker === "number"
              ? speakerLabels.get(b.speaker) ?? `דובר ${b.speaker + 1}`
              : "—";
          const draft = drafts[i];
          const text = draft !== undefined ? draft : b.text;
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
                  onClick={() => seekTo(b.start)}
                  className={cn(
                    "text-[11px] tabular-nums hover:underline shrink-0",
                    isActive ? "text-primary-800 font-semibold" : "text-primary-700"
                  )}
                  title="קפצי להשמעה מהזמן הזה"
                >
                  {formatTime(b.start)}
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
                rows={Math.max(1, Math.ceil(text.length / 60))}
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

// ─── helpers ──────────────────────────────────────────────────────────────

function extractUtterances(recording: Recording): Utterance[] {
  const json = recording.transcript_json as
    | { transcription?: { utterances?: Utterance[] } }
    | null
    | undefined;
  return json?.transcription?.utterances ?? [];
}

/**
 * Collapse consecutive same-speaker utterances into a single Block, then
 * force-split any block whose duration exceeds FORCE_SPLIT_AFTER_S into
 * roughly TARGET-second chunks at utterance boundaries (so we don't break
 * inside a sentence).
 */
function groupUtterances(utterances: Utterance[]): Block[] {
  if (utterances.length === 0) return [];

  // Pass 1 — merge consecutive same-speaker.
  const raw: Block[] = [];
  let cur: Block | null = null;
  for (let i = 0; i < utterances.length; i++) {
    const u = utterances[i];
    const start = typeof u.start === "number" ? u.start : cur?.end ?? 0;
    const end = typeof u.end === "number" ? u.end : start;
    const text = (u.text ?? "").trim();
    if (cur && cur.speaker === u.speaker) {
      cur.end = end;
      cur.text = cur.text + (cur.text && text ? " " : "") + text;
      cur.source.push(i);
    } else {
      if (cur) raw.push(cur);
      cur = { speaker: u.speaker, start, end, text, source: [i] };
    }
  }
  if (cur) raw.push(cur);

  // Pass 2 — force-split long monologues at utterance boundaries.
  const out: Block[] = [];
  for (const g of raw) {
    if (g.end - g.start <= FORCE_SPLIT_AFTER_S) {
      out.push(g);
      continue;
    }
    let chunk: Block | null = null;
    for (const idx of g.source) {
      const u = utterances[idx];
      const uStart = typeof u.start === "number" ? u.start : chunk?.end ?? g.start;
      const uEnd = typeof u.end === "number" ? u.end : uStart;
      const uText = (u.text ?? "").trim();
      if (chunk && uEnd - chunk.start >= TARGET_CHUNK_S) {
        out.push(chunk);
        chunk = {
          speaker: g.speaker,
          start: uStart,
          end: uEnd,
          text: uText,
          source: [idx],
        };
      } else if (chunk) {
        chunk.end = uEnd;
        chunk.text = chunk.text + (chunk.text && uText ? " " : "") + uText;
        chunk.source.push(idx);
      } else {
        chunk = {
          speaker: g.speaker,
          start: uStart,
          end: uEnd,
          text: uText,
          source: [idx],
        };
      }
    }
    if (chunk) out.push(chunk);
  }

  return out;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
