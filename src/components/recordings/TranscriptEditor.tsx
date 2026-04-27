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
  useEffect(() => {
    if (!audioElement) return;
    const onUpdate = () => setCurrentTime(audioElement.currentTime);
    audioElement.addEventListener("timeupdate", onUpdate);
    audioElement.addEventListener("seeked", onUpdate);
    return () => {
      audioElement.removeEventListener("timeupdate", onUpdate);
      audioElement.removeEventListener("seeked", onUpdate);
    };
  }, [audioElement]);

  const speakerLabels = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of speakers) {
      if (s.label?.trim()) map.set(s.speaker_index, s.label.trim());
    }
    return map;
  }, [speakers]);

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
            // Drop the entries we just persisted, but keep any drafts the
            // user has typed since (they'll have a different value than the
            // snapshot we sent).
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
      // Auto-play on click so the user hears immediately what they pointed at.
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

      <ol className="space-y-1.5 max-h-[60vh] overflow-y-auto pe-1">
        {utterances.map((u, i) => {
          const start = typeof u.start === "number" ? u.start : 0;
          const end = typeof u.end === "number" ? u.end : start;
          const isActive = currentTime >= start && currentTime < end;
          const speakerName =
            typeof u.speaker === "number"
              ? speakerLabels.get(u.speaker) ?? `דובר ${u.speaker + 1}`
              : "—";
          const draft = drafts[i];
          const text = draft !== undefined ? draft : u.text ?? "";
          return (
            <li
              key={i}
              className={cn(
                "rounded-md border px-2.5 py-1.5 transition-colors",
                isActive
                  ? "border-primary-300 bg-primary-50"
                  : "border-ink-200 bg-white"
              )}
            >
              <div className="flex items-baseline gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => seekTo(start)}
                  className="text-[11px] tabular-nums text-primary-700 hover:underline shrink-0"
                  title="קפצי להשמעה מהזמן הזה"
                >
                  {formatTime(start)}
                </button>
                <span className="text-[11px] text-ink-500 truncate">
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
                className="w-full bg-transparent text-sm text-ink-900 leading-relaxed resize-none outline-none focus:ring-1 focus:ring-primary-300 rounded-sm"
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
