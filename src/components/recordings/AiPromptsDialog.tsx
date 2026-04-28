import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RotateCcw, Save, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useUserThoughtPreferences,
  useUpdateUserThoughtPreferences,
} from "@/lib/hooks/useUserThoughtPreferences";
import {
  DEFAULT_RECORDING_AI_PROMPTS,
  RECORDING_AI_PROMPT_LABELS,
  type RecordingAiPromptKey,
  type RecordingAiPromptOverrides,
} from "@/lib/ai/recording-prompts";

interface Props {
  open: boolean;
  onClose: () => void;
}

const KEYS = Object.keys(DEFAULT_RECORDING_AI_PROMPTS) as RecordingAiPromptKey[];

export function AiPromptsDialog({ open, onClose }: Props) {
  const { data: prefs } = useUserThoughtPreferences();
  const update = useUpdateUserThoughtPreferences();
  const [draft, setDraft] = useState<RecordingAiPromptOverrides>({});

  // Re-seed from server every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setDraft(prefs?.recording_ai_prompts ?? {});
  }, [open, prefs?.recording_ai_prompts]);

  const onSave = () => {
    update.mutate(
      { recording_ai_prompts: stripEmpty(draft) },
      { onSuccess: () => onClose() }
    );
  };

  const onResetOne = (key: RecordingAiPromptKey) => {
    setDraft((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });
  };

  const onResetAll = () => {
    setDraft({});
  };

  const dirty = JSON.stringify(stripEmpty(draft)) !==
    JSON.stringify(prefs?.recording_ai_prompts ?? {});

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
                <Sparkles className="w-4 h-4 text-primary-600" />
                <h3 className="text-sm font-semibold text-ink-900">
                  הנחיות AI לעיבוד הקלטות
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

            <div className="px-5 py-3 max-h-[calc(100vh-14rem)] overflow-y-auto space-y-3">
              <p className="text-xs text-ink-600 leading-relaxed">
                לכל סקציה ב-AI יש הנחיה ש-Claude מקבל. ניתן לערוך את ההנחיות
                שלך — שדה ריק חוזר לברירת המחדל. השינויים נשמרים פר-משתמש
                (ולא פר-הקלטה).
              </p>

              {KEYS.map((key) => (
                <PromptField
                  key={key}
                  label={RECORDING_AI_PROMPT_LABELS[key]}
                  defaultText={DEFAULT_RECORDING_AI_PROMPTS[key]}
                  value={draft[key] ?? ""}
                  onChange={(v) => setDraft((d) => ({ ...d, [key]: v }))}
                  onReset={() => onResetOne(key)}
                />
              ))}
            </div>

            <div className="px-5 py-3 border-t border-ink-200 flex items-center justify-between gap-2 flex-wrap">
              <button
                type="button"
                onClick={onResetAll}
                className="btn-outline !py-1.5 !px-3 text-sm inline-flex items-center gap-1"
                title="אפס את כל ההנחיות לברירת המחדל"
              >
                <RotateCcw className="w-3 h-3" />
                החזרת הכל לברירת מחדל
              </button>
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
                  onClick={onSave}
                  disabled={!dirty || update.isPending}
                  className="btn-primary !py-1.5 !px-3 text-sm inline-flex items-center gap-1"
                >
                  <Save className="w-3 h-3" />
                  שמירה
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PromptField({
  label,
  defaultText,
  value,
  onChange,
  onReset,
}: {
  label: string;
  defaultText: string;
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  const overridden = value.trim().length > 0;
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 space-y-1.5",
        overridden ? "border-primary-300 bg-primary-50/40" : "border-ink-200"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-ink-800">
          {label}
          {overridden && (
            <span className="ms-2 text-[10px] text-primary-700 font-normal">
              · מותאם
            </span>
          )}
        </div>
        {overridden && (
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] text-ink-500 hover:text-primary-700 inline-flex items-center gap-0.5"
            title="חזור להנחיית ברירת המחדל"
          >
            <RotateCcw className="w-3 h-3" />
            ברירת מחדל
          </button>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.max(3, Math.min(8, Math.ceil((value || defaultText).length / 60)))}
        className="field text-xs resize-y w-full"
        placeholder={defaultText}
        dir="auto"
        // The placeholder shows the default — typing replaces it. Empty
        // textarea = "use default", which we communicate via the label badge.
      />
      <p className="text-[10px] text-ink-400 leading-relaxed">
        השאירי ריק כדי להשתמש בברירת המחדל. השינוי משפיע רק על הרצות AI
        עתידיות, לא על תוצאות שכבר נשמרו.
      </p>
    </div>
  );
}

function stripEmpty(o: RecordingAiPromptOverrides): RecordingAiPromptOverrides {
  const out: RecordingAiPromptOverrides = {};
  for (const k of Object.keys(o) as RecordingAiPromptKey[]) {
    const v = o[k];
    if (typeof v === "string" && v.trim().length > 0) out[k] = v;
  }
  return out;
}
