import { useRef, useState, useEffect } from "react";
import { Mic, Send } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ThoughtComposerProps {
  onSubmit: (text: string) => Promise<void> | void;
  /** Optional stub for "record audio" — disabled until real recording wiring lands. */
  onRecordRequest?: () => void;
  disabled?: boolean;
}

/**
 * Top-of-screen textarea for the Thoughts view. Enter (without Shift) saves;
 * Shift+Enter inserts a newline. The textarea auto-focuses on mount and
 * re-focuses after a save so the user can keep typing.
 */
export function ThoughtComposer({
  onSubmit,
  onRecordRequest,
  disabled,
}: ThoughtComposerProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea up to a reasonable cap.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  }, [text]);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting || disabled) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setText("");
      // Return focus so the user keeps typing without a click.
      ref.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="card px-3 py-2">
      <textarea
        ref={ref}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="מה עובר לך בראש?"
        disabled={disabled || submitting}
        className={cn(
          "w-full resize-none bg-transparent border-0 outline-none text-ink-900 placeholder:text-ink-400 text-sm leading-relaxed min-h-[72px]"
        )}
        rows={3}
      />
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-ink-100 mt-1">
        <button
          type="button"
          onClick={onRecordRequest}
          disabled={!onRecordRequest}
          className={cn(
            "inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors",
            onRecordRequest
              ? "text-ink-600 hover:bg-ink-100"
              : "text-ink-300 cursor-not-allowed"
          )}
          title={
            onRecordRequest
              ? "הקלטה מהירה"
              : "הקלטה זמינה דרך כפתור המיקרופון הגלובלי"
          }
        >
          <Mic className="w-3.5 h-3.5" />
          הקלטה
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-ink-400 hidden sm:inline">
            Enter לשמירה · Shift+Enter לשורה חדשה
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim() || submitting || disabled}
            className={cn(
              "inline-flex items-center gap-1 text-sm font-medium px-3 py-1 rounded-md transition-colors",
              text.trim() && !submitting
                ? "bg-primary-500 text-white hover:bg-primary-600"
                : "bg-ink-100 text-ink-400 cursor-not-allowed"
            )}
          >
            <Send className="w-3.5 h-3.5" />
            שלח
          </button>
        </div>
      </div>
    </div>
  );
}
