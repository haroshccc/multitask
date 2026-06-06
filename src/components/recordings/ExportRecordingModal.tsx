import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Loader2, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Recording } from "@/lib/types/domain";
import type { RecordingAiOutput } from "@/lib/services/recordings";
import { useRecordingFreeTextHistory } from "@/lib/hooks/useRecordings";
import {
  generateExport,
  downloadBlob,
  type ExportFormat,
  type ExportInclude,
} from "@/lib/recordings/export";

interface Props {
  open: boolean;
  onClose: () => void;
  recording: Recording;
  /** The current (possibly edited) AI output draft from AiInsights. */
  aiOutput: RecordingAiOutput;
}

type IncludeKey = keyof ExportInclude;

const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: "docx", label: "Word (DOCX)" },
  { value: "pdf", label: "PDF" },
  { value: "pptx", label: "PowerPoint (PPTX)" },
];

export function ExportRecordingModal({
  open,
  onClose,
  recording,
  aiOutput,
}: Props) {
  const { data: history = [] } = useRecordingFreeTextHistory(recording.id);

  const hasTranscript = useMemo(() => {
    if ((recording.transcript_text ?? "").trim()) return true;
    const json = recording.transcript_json as
      | { transcription?: { utterances?: unknown[] } }
      | null;
    return Boolean(json?.transcription?.utterances?.length);
  }, [recording.transcript_text, recording.transcript_json]);

  // Which content sections are actually available for this recording.
  const available = useMemo<Record<IncludeKey, boolean>>(
    () => ({
      meta: true,
      shortSummary: !!aiOutput.short_summary.trim(),
      longSummary: !!aiOutput.long_summary.trim(),
      tasks: aiOutput.tasks.length > 0,
      events: aiOutput.events.length > 0,
      whatsapp: !!aiOutput.whatsapp_message.trim(),
      email: !!(aiOutput.email.subject.trim() || aiOutput.email.body.trim()),
      transcript: hasTranscript,
    }),
    [aiOutput, hasTranscript],
  );

  const [include, setInclude] = useState<ExportInclude>(() =>
    defaultInclude(available),
  );
  const [qaSelected, setQaSelected] = useState<Set<number>>(new Set());
  const [format, setFormat] = useState<ExportFormat>("docx");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed selection whenever the dialog opens for a (possibly new) recording.
  useEffect(() => {
    if (!open) return;
    setInclude(defaultInclude(available));
    setQaSelected(new Set());
    setError(null);
    setBusy(false);
  }, [open, recording.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key: IncludeKey) =>
    setInclude((s) => ({ ...s, [key]: !s[key] }));

  const toggleQa = (idx: number) =>
    setQaSelected((s) => {
      const next = new Set(s);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });

  const anySelected =
    (Object.keys(include) as IncludeKey[]).some(
      (k) => k !== "meta" && include[k],
    ) || qaSelected.size > 0;

  const onExport = async () => {
    setBusy(true);
    setError(null);
    try {
      const qaEntries = history.filter((_, i) => qaSelected.has(i));
      const { blob, fileName } = await generateExport(
        { recording, aiOutput, qaEntries, include },
        format,
      );
      downloadBlob(blob, fileName);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
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
                <FileText className="w-4 h-4 text-primary-600" />
                <h3 className="text-sm font-semibold text-ink-900">
                  ייצוא הקלטה למסמך
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

            <div className="px-5 py-3 max-h-[calc(100vh-16rem)] overflow-y-auto space-y-4">
              {/* Content selection */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-ink-700">
                  מה לכלול
                </div>
                <CheckRow
                  label="כותרת ופרטים"
                  checked={include.meta}
                  onToggle={() => toggle("meta")}
                />
                <CheckRow
                  label="סיכום קצר"
                  checked={include.shortSummary}
                  disabled={!available.shortSummary}
                  onToggle={() => toggle("shortSummary")}
                />
                <CheckRow
                  label="סיכום מפורט"
                  checked={include.longSummary}
                  disabled={!available.longSummary}
                  onToggle={() => toggle("longSummary")}
                />
                <CheckRow
                  label="משימות"
                  checked={include.tasks}
                  disabled={!available.tasks}
                  onToggle={() => toggle("tasks")}
                />
                <CheckRow
                  label="אירועים"
                  checked={include.events}
                  disabled={!available.events}
                  onToggle={() => toggle("events")}
                />
                <CheckRow
                  label="הודעת WhatsApp"
                  checked={include.whatsapp}
                  disabled={!available.whatsapp}
                  onToggle={() => toggle("whatsapp")}
                />
                <CheckRow
                  label="מייל"
                  checked={include.email}
                  disabled={!available.email}
                  onToggle={() => toggle("email")}
                />
                <CheckRow
                  label="תמלול מלא"
                  checked={include.transcript}
                  disabled={!available.transcript}
                  onToggle={() => toggle("transcript")}
                />
              </div>

              {/* Free-text Q&A */}
              {history.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-ink-700">
                    שאלות חופשיות ({history.length})
                  </div>
                  {history.map((qa, idx) => (
                    <CheckRow
                      key={idx}
                      label={qa.question.trim() || `שאלה ${idx + 1}`}
                      checked={qaSelected.has(idx)}
                      onToggle={() => toggleQa(idx)}
                    />
                  ))}
                </div>
              )}

              {/* Format */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-ink-700">פורמט</div>
                <div className="inline-flex rounded-lg border border-ink-200 overflow-hidden">
                  {FORMAT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormat(opt.value)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium transition-colors",
                        format === opt.value
                          ? "bg-primary-600 text-white"
                          : "bg-white text-ink-600 hover:bg-ink-50",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700 inline-flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span className="break-words">{error}</span>
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
                onClick={onExport}
                disabled={busy || !anySelected}
                className="btn-primary !py-1.5 !px-3 text-sm inline-flex items-center gap-1"
                title={!anySelected ? "בחרי לפחות תוכן אחד לייצוא" : ""}
              >
                {busy ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                הורדה
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function defaultInclude(
  available: Record<IncludeKey, boolean>,
): ExportInclude {
  return {
    meta: true,
    shortSummary: available.shortSummary,
    longSummary: available.longSummary,
    tasks: available.tasks,
    events: available.events,
    whatsapp: false,
    email: false,
    transcript: available.transcript,
  };
}

function CheckRow({
  label,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-2 text-xs rounded-md px-2 py-1.5 cursor-pointer select-none",
        disabled
          ? "opacity-40 cursor-not-allowed"
          : "hover:bg-ink-50 text-ink-800",
      )}
    >
      <input
        type="checkbox"
        checked={checked && !disabled}
        disabled={disabled}
        onChange={onToggle}
        className="accent-primary-600 w-3.5 h-3.5 shrink-0"
      />
      <span className="truncate">{label}</span>
    </label>
  );
}
