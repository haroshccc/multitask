import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import {
  PLAN_STATUSES,
  PLAN_STATUS_META,
  type PlanStatus,
} from "@/lib/types/plans";

/** A pill that cycles through the four plan statuses on click. */
export function PlanStatusChip({
  value,
  onChange,
  disabled,
}: {
  value: PlanStatus | null;
  onChange: (v: PlanStatus) => void;
  disabled?: boolean;
}) {
  const cur = value ?? "notstarted";
  const meta = PLAN_STATUS_META[cur];
  const next = () => {
    const idx = PLAN_STATUSES.indexOf(cur);
    onChange(PLAN_STATUSES[(idx + 1) % PLAN_STATUSES.length]);
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={next}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap transition-colors",
        meta.className,
        disabled ? "opacity-60 cursor-default" : "hover:brightness-95"
      )}
      title="לחצי כדי לשנות סטטוס"
    >
      <span className="leading-none">{meta.symbol}</span>
      <span>{meta.label}</span>
    </button>
  );
}

/** Borderless inline text editor that commits on blur / Enter. Used in the
 *  plan table cells; intentionally has nothing to do with the sensitive
 *  task-save path (TaskRow/commitTitle). */
export function PlanInlineText({
  value,
  onCommit,
  placeholder,
  className,
  multiline,
  disabled,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef(value);
  useEffect(() => {
    // keep in sync when the underlying value changes externally
    if (ref.current !== value) {
      ref.current = value;
      setDraft(value);
    }
  }, [value]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  if (multiline) {
    return (
      <textarea
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        placeholder={placeholder}
        rows={2}
        className={cn(
          "w-full resize-y bg-transparent rounded-md px-2 py-1 text-sm text-ink-800 placeholder:text-ink-300",
          "border border-transparent hover:border-ink-200 focus:border-primary-400 focus:bg-white outline-none",
          className
        )}
      />
    );
  }

  return (
    <input
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder={placeholder}
      className={cn(
        "w-full bg-transparent rounded-md px-2 py-1 text-sm text-ink-800 placeholder:text-ink-300",
        "border border-transparent hover:border-ink-200 focus:border-primary-400 focus:bg-white outline-none",
        className
      )}
    />
  );
}
