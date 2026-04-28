import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  GitMerge,
  AlertCircle,
  Loader2,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
} from "lucide-react";
import {
  useRecordings,
  useMergeRecordingsMany,
  useRecordingAudioUrl,
} from "@/lib/hooks/useRecordings";
import type { Recording } from "@/lib/types/domain";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface Props {
  /** The recording the user opened the dialog from — seeded as item #1. */
  recording: Recording;
  open: boolean;
  onClose: () => void;
  /** Called with the merged recording's id when the merge succeeds. */
  onMerged?: (recordingId: string) => void;
}

export function MergeRecordingsDialog({
  recording,
  open,
  onClose,
  onMerged,
}: Props) {
  const { data: allRecordings = [] } = useRecordings();
  const merge = useMergeRecordingsMany();
  // Ordered list of selected recording IDs. Seeds with the dialog opener.
  const [orderedIds, setOrderedIds] = useState<string[]>([recording.id]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset whenever the source recording changes (or on each fresh open).
  useEffect(() => {
    if (open) {
      setOrderedIds([recording.id]);
      setError(null);
      setPickerOpen(false);
    }
  }, [open, recording.id]);

  const recordingsById = useMemo(() => {
    const m = new Map<string, Recording>();
    for (const r of allRecordings) m.set(r.id, r);
    return m;
  }, [allRecordings]);

  // Picker candidates: same org, not merged elsewhere, not already in our list.
  const candidates = useMemo(
    () =>
      allRecordings
        .filter(
          (r) =>
            !orderedIds.includes(r.id) &&
            !r.merged_into &&
            r.organization_id === recording.organization_id
        )
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
    [allRecordings, orderedIds, recording.organization_id]
  );

  const move = (index: number, delta: -1 | 1) => {
    setOrderedIds((ids) => {
      const next = ids.slice();
      const j = index + delta;
      if (j < 0 || j >= next.length) return ids;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const removeAt = (index: number) =>
    setOrderedIds((ids) => ids.filter((_, i) => i !== index));

  const submit = async () => {
    if (orderedIds.length < 2) {
      setError("בחרי לפחות 2 הקלטות לאיחוד.");
      return;
    }
    setError(null);
    try {
      const survivor = await merge.mutateAsync(orderedIds);
      onMerged?.(survivor.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

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
            className="bg-white rounded-3xl shadow-lift w-full max-w-2xl my-8 overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <GitMerge className="w-4 h-4 text-primary-600" />
                <h3 className="text-sm font-semibold text-ink-900">
                  איחוד הקלטות
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

            <div className="p-5 space-y-4 max-h-[calc(100vh-12rem)] overflow-y-auto">
              <p className="text-xs text-ink-600 leading-relaxed">
                סדרי את ההקלטות לפי הסדר שתרצי שיופיעו בהקלטה המאוחדת. הראשונה
                תשמור את האודיו וסופחות אליה כל השאר. אפשרות לשמוע כל הקלטה
                לפני האישור.
              </p>

              {/* Ordered list */}
              <ol className="space-y-2">
                {orderedIds.map((id, i) => {
                  const r = recordingsById.get(id);
                  if (!r) return null;
                  return (
                    <li
                      key={id}
                      className="rounded-md border border-ink-200 bg-white px-3 py-2 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-800 text-[11px] font-semibold inline-flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-ink-900 truncate">
                            {r.title || "ללא כותרת"}
                          </div>
                          <div className="text-[11px] text-ink-500">
                            {format(new Date(r.created_at), "d בMMM, HH:mm", {
                              locale: he,
                            })}
                            {r.duration_seconds
                              ? ` · ${formatDuration(r.duration_seconds)}`
                              : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <ArrowBtn
                            disabled={i === 0}
                            onClick={() => move(i, -1)}
                            title="העברה למעלה"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </ArrowBtn>
                          <ArrowBtn
                            disabled={i === orderedIds.length - 1}
                            onClick={() => move(i, 1)}
                            title="העברה למטה"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </ArrowBtn>
                          {orderedIds.length > 1 && (
                            <ArrowBtn
                              onClick={() => removeAt(i)}
                              title="הסרה מהאיחוד"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-danger-600" />
                            </ArrowBtn>
                          )}
                        </div>
                      </div>
                      <InlineAudioPreview recording={r} />
                    </li>
                  );
                })}
              </ol>

              {/* Add another */}
              {candidates.length > 0 && !pickerOpen && (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="btn-outline !py-1.5 !px-3 text-sm inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  הוספת הקלטה לאיחוד
                </button>
              )}

              {pickerOpen && (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">
                    בחרי הקלטה להוספה
                  </div>
                  <div className="border border-ink-200 rounded-md max-h-60 overflow-y-auto">
                    {candidates.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setOrderedIds((ids) => [...ids, r.id]);
                          setPickerOpen(false);
                        }}
                        className="w-full px-3 py-2 text-start hover:bg-ink-50 border-b border-ink-100 last:border-b-0 transition-colors"
                      >
                        <div className="text-sm text-ink-900 truncate">
                          {r.title || "ללא כותרת"}
                        </div>
                        <div className="text-[11px] text-ink-500">
                          {format(new Date(r.created_at), "d בMMM, HH:mm", {
                            locale: he,
                          })}
                          {r.duration_seconds
                            ? ` · ${formatDuration(r.duration_seconds)}`
                            : null}
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(false)}
                    className="text-[11px] text-ink-500 hover:underline"
                  >
                    סגירה בלי להוסיף
                  </button>
                </div>
              )}

              {error && (
                <div className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700 inline-flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-ink-200 flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] text-ink-500">
                {orderedIds.length < 2
                  ? "צריך לפחות 2 הקלטות"
                  : `יאוחדו ${orderedIds.length} הקלטות. השאר יקבלו "מוזגה".`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-outline !py-1.5 !px-3 text-sm"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={merge.isPending || orderedIds.length < 2}
                  className="btn-primary !py-1.5 !px-3 text-sm inline-flex items-center gap-1.5"
                >
                  {merge.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  {merge.isPending ? "מאחדת…" : "איחוד"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ArrowBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="p-1 rounded hover:bg-ink-100 disabled:opacity-30 disabled:cursor-not-allowed"
      title={title}
    >
      {children}
    </button>
  );
}

/**
 * Tiny inline audio preview — uses the native `<audio controls>` so we don't
 * have to embed the full waveform / speed-picker AudioPlayer for every row in
 * a long list. Lazy-loads the presigned URL the first time the user expands
 * the row's playback.
 */
function InlineAudioPreview({ recording }: { recording: Recording }) {
  const [enabled, setEnabled] = useState(false);
  const { data: url } = useRecordingAudioUrl(enabled ? recording : undefined);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (recording.audio_archived) {
    return (
      <div className="text-[11px] text-ink-500">
        האודיו של ההקלטה הזאת אורכב — אפשר עדיין לאחד את התמלול.
      </div>
    );
  }
  if (!enabled) {
    return (
      <button
        type="button"
        onClick={() => setEnabled(true)}
        className="text-[11px] text-primary-700 hover:underline"
      >
        האזנה להקלטה
      </button>
    );
  }
  return (
    <audio
      ref={audioRef}
      src={url ?? undefined}
      controls
      preload="metadata"
      className="w-full h-8"
    />
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
