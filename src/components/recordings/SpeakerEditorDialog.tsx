import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, Play, Pause, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useRecordingSpeakers,
  useUpsertRecordingSpeakerLabel,
  useSpeakerLabelSuggestions,
  useRecordingAudioUrl,
} from "@/lib/hooks/useRecordings";
import type { Recording } from "@/lib/types/domain";

interface Props {
  recording: Recording;
  open: boolean;
  onClose: () => void;
}

interface Utterance {
  speaker?: number;
  start?: number;
  end?: number;
  text?: string;
}

/** Always-on suggestion for the recording owner. Shows first in the chip row. */
const SELF_SUGGESTION = "אני";

export function SpeakerEditorDialog({ recording, open, onClose }: Props) {
  const { data: speakers = [] } = useRecordingSpeakers(recording.id);
  const { data: pastLabels = [] } = useSpeakerLabelSuggestions(recording.project_id);
  const upsert = useUpsertRecordingSpeakerLabel();
  const { data: url } = useRecordingAudioUrl(open ? recording : undefined);

  // Speaker indices that actually appear in this recording's transcript_json.
  const indices = useMemo(() => {
    const json = recording.transcript_json as
      | { transcription?: { utterances?: Utterance[] } }
      | null;
    const list = json?.transcription?.utterances ?? [];
    const set = new Set<number>();
    for (const u of list) if (typeof u.speaker === "number") set.add(u.speaker);
    return Array.from(set).sort((a, b) => a - b);
  }, [recording.transcript_json]);

  // First-utterance start/end per speaker so the snippet button has a target.
  const snippetWindow = useMemo(() => {
    const json = recording.transcript_json as
      | { transcription?: { utterances?: Utterance[] } }
      | null;
    const list = json?.transcription?.utterances ?? [];
    const out: Record<number, { start: number; end: number }> = {};
    for (const u of list) {
      if (typeof u.speaker !== "number") continue;
      if (out[u.speaker]) continue;
      const start = typeof u.start === "number" ? u.start : 0;
      const end = typeof u.end === "number" ? u.end : start + 4;
      out[u.speaker] = { start, end };
    }
    return out;
  }, [recording.transcript_json]);

  // Local label drafts keyed by speaker_index. Reset on open so changes the
  // user abandoned earlier don't leak between sessions.
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  useEffect(() => {
    if (!open) return;
    const next: Record<number, string> = {};
    for (const idx of indices) {
      const existing = speakers.find((s) => s.speaker_index === idx);
      next[idx] = existing?.label ?? "";
    }
    setDrafts(next);
  }, [open, indices, speakers]);

  const onSave = async () => {
    for (const idx of indices) {
      const label = drafts[idx]?.trim();
      const existing = speakers.find((s) => s.speaker_index === idx);
      if (!label && !existing?.label) continue; // no-op
      if (label === (existing?.label ?? "")) continue; // unchanged
      await upsert.mutateAsync({
        recordingId: recording.id,
        speakerIndex: idx,
        label: label ?? "",
      });
    }
    onClose();
  };

  // Suggestions = always "אני" first + dedup of past labels.
  const suggestions = useMemo(() => {
    const seen = new Set<string>([SELF_SUGGESTION]);
    const out = [SELF_SUGGESTION];
    for (const l of pastLabels) {
      if (!seen.has(l)) {
        out.push(l);
        seen.add(l);
      }
    }
    return out;
  }, [pastLabels]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-lift w-full max-w-lg my-8 overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Mic className="w-4 h-4 text-primary-600" />
                <h3 className="text-sm font-semibold text-ink-900">
                  עריכת דוברים
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-ink-100"
                type="button"
              >
                <X className="w-4 h-4 text-ink-600" />
              </button>
            </div>

            <div className="px-5 py-3 space-y-3 max-h-[calc(100vh-12rem)] overflow-y-auto">
              <p className="text-xs text-ink-600 leading-relaxed">
                לכל דובר יש כפתור האזנה לקטע קצר ואחריו תיבת שם. ההצעות
                שמופיעות נלקחות מתוך דוברים ששמרת בעבר באותו פרויקט (תמיד
                גם "אני"). אחרי שמירה, כל התמלול מתעדכן עם השמות החדשים.
              </p>

              {indices.length === 0 ? (
                <p className="text-xs text-ink-500">
                  לא נמצאו דוברים ב-transcript_json. כנראה שההקלטה תומללה
                  לפני העדכון, או ש-Gladia לא זיהה דובר.
                </p>
              ) : (
                indices.map((idx) => (
                  <SpeakerRow
                    key={idx}
                    speakerIndex={idx}
                    audioUrl={url ?? null}
                    snippet={snippetWindow[idx]}
                    value={drafts[idx] ?? ""}
                    onChange={(v) =>
                      setDrafts((d) => ({ ...d, [idx]: v }))
                    }
                    suggestions={suggestions}
                  />
                ))
              )}
            </div>

            <div className="px-5 py-3 border-t border-ink-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-outline !py-1.5 !px-3 text-sm"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={upsert.isPending || indices.length === 0}
                className="btn-primary !py-1.5 !px-3 text-sm inline-flex items-center gap-1.5"
              >
                {upsert.isPending && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                <Save className="w-3.5 h-3.5" />
                שמירה
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SpeakerRow({
  speakerIndex,
  audioUrl,
  snippet,
  value,
  onChange,
  suggestions,
}: {
  speakerIndex: number;
  audioUrl: string | null;
  snippet: { start: number; end: number } | undefined;
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // Auto-stop when the snippet's end time is reached. The native
  // <audio> element doesn't have built-in clip-bounds, so we tick on
  // timeupdate and pause when we cross `snippet.end`.
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !snippet) return;
    const onUpdate = () => {
      if (a.currentTime >= snippet.end) {
        a.pause();
        a.currentTime = snippet.start;
        setPlaying(false);
      }
    };
    a.addEventListener("timeupdate", onUpdate);
    return () => a.removeEventListener("timeupdate", onUpdate);
  }, [snippet]);

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a || !snippet) return;
    if (a.paused) {
      try {
        a.currentTime = snippet.start;
        await a.play();
        setPlaying(true);
      } catch {
        /* play may reject; let the user try again */
      }
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="rounded-md border border-ink-200 bg-white px-3 py-2 space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!audioUrl || !snippet}
          className={cn(
            "p-1.5 rounded-full shrink-0",
            playing
              ? "bg-primary-500 text-white"
              : "bg-ink-100 text-ink-700 hover:bg-ink-200",
            (!audioUrl || !snippet) && "opacity-50 cursor-not-allowed"
          )}
          title="האזנה לקטע של הדובר"
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <span className="text-[11px] text-ink-500 shrink-0">דובר {speakerIndex + 1}</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="שם הדובר"
          className="field !py-1 text-sm flex-1 min-w-0"
          dir="auto"
        />
      </div>
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
        />
      )}
      <div className="flex flex-wrap gap-1">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={cn(
              "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
              value === s
                ? "border-primary-300 bg-primary-50 text-primary-800"
                : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
