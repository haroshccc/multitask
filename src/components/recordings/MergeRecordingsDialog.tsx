import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, GitMerge, AlertCircle, Loader2, ArrowDownUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useRecordings,
  useMergeRecordings,
} from "@/lib/hooks/useRecordings";
import type { Recording } from "@/lib/types/domain";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface Props {
  /** The recording the user opened the dialog from. */
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
  const merge = useMergeRecordings();
  const [otherId, setOtherId] = useState<string | null>(null);
  const [order, setOrder] = useState<"this_first" | "other_first">("this_first");
  const [error, setError] = useState<string | null>(null);

  // Candidates: same org, not the source recording itself, not already
  // merged into something. Sort newest first.
  const candidates = allRecordings
    .filter(
      (r) =>
        r.id !== recording.id &&
        !r.merged_into &&
        r.organization_id === recording.organization_id
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const submit = async () => {
    if (!otherId) {
      setError("בחרי הקלטה נוספת לאיחוד.");
      return;
    }
    setError(null);
    const firstId = order === "this_first" ? recording.id : otherId;
    const secondId = order === "this_first" ? otherId : recording.id;
    try {
      const survivor = await merge.mutateAsync({ firstId, secondId });
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
            className="bg-white rounded-3xl shadow-lift w-full max-w-lg my-8 overflow-hidden"
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
                האחת תספח את התמלול של השנייה. הראשונה תשמור את האודיו;
                האודיו של השנייה ייסגר (השורה תישאר עם הסטטוס "מוזגה").
              </p>

              {/* Other recording picker */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">
                  הקלטה לאיחוד
                </div>
                {candidates.length === 0 ? (
                  <p className="text-xs text-ink-500">
                    אין הקלטות אחרות זמינות לאיחוד.
                  </p>
                ) : (
                  <div className="border border-ink-200 rounded-md max-h-60 overflow-y-auto">
                    {candidates.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setOtherId(r.id)}
                        className={cn(
                          "w-full px-3 py-2 text-start hover:bg-ink-50 border-b border-ink-100 last:border-b-0 transition-colors",
                          otherId === r.id && "bg-primary-50"
                        )}
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
                )}
              </div>

              {/* Order picker */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">
                  סדר
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  <OrderOption
                    selected={order === "this_first"}
                    onClick={() => setOrder("this_first")}
                    title={`הנוכחית ראשונה ("${trim(recording.title) || "ללא כותרת"}")`}
                    subtitle="האודיו והתמלול שלך נשארים בהתחלה; השנייה תיספח בסוף."
                  />
                  <OrderOption
                    selected={order === "other_first"}
                    onClick={() => setOrder("other_first")}
                    title="האחרת ראשונה"
                    subtitle="האודיו של השנייה יישאר בהתחלה; הנוכחית תיספח אחריה."
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setOrder((o) =>
                      o === "this_first" ? "other_first" : "this_first"
                    )
                  }
                  className="text-[11px] text-primary-700 hover:underline inline-flex items-center gap-1"
                >
                  <ArrowDownUp className="w-3 h-3" />
                  החלפת סדר
                </button>
              </div>

              {error && (
                <div className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700 inline-flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
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
                onClick={submit}
                disabled={merge.isPending || !otherId}
                className="btn-primary !py-1.5 !px-3 text-sm inline-flex items-center gap-1.5"
              >
                {merge.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {merge.isPending ? "מאחדת…" : "איחוד"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function OrderOption({
  selected,
  onClick,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border rounded-md px-3 py-2 text-start transition-colors",
        selected
          ? "border-primary-300 bg-primary-50"
          : "border-ink-200 bg-white hover:bg-ink-50"
      )}
    >
      <div className="text-sm text-ink-900">{title}</div>
      <div className="text-[11px] text-ink-500 leading-snug">{subtitle}</div>
    </button>
  );
}

function trim(s: string | null | undefined): string {
  if (!s) return "";
  return s.length > 30 ? s.slice(0, 28) + "…" : s;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
