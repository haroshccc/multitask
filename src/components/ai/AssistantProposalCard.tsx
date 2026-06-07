import { useState } from "react";
import { Check, X, Pencil, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { PendingToolCall } from "@/lib/hooks/useAssistant";

/**
 * Renders one proposed tool call as an approve / edit / dismiss card. The user
 * can tweak the raw JSON arguments before approving (simple textarea — power
 * users edit, most just approve). Only tools that require approval render as
 * action cards; informational tool calls render as a subtle note.
 */
export function AssistantProposalCard({
  call,
  onApprove,
  onDismiss,
}: {
  call: PendingToolCall;
  onApprove: (id: string, editedInput?: Record<string, unknown>) => void;
  onDismiss: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => JSON.stringify(call.input, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);

  // Informational (no-approval) calls — render compactly, no actions.
  if (!call.requiresApproval) {
    return null;
  }

  const title = call.label ?? call.name;

  if (call.state === "done") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>{call.resultText ?? `${title} בוצע`}</span>
      </div>
    );
  }
  if (call.state === "dismissed") {
    return (
      <div className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-400 flex items-center gap-2">
        <X className="w-4 h-4 shrink-0" />
        <span>{title} — בוטל</span>
      </div>
    );
  }
  if (call.state === "deferred") {
    return (
      <div className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-400 flex items-center gap-2">
        <Loader2 className="w-4 h-4 shrink-0" />
        <span>{title} — ממתין, אענה קודם לשאלתך</span>
      </div>
    );
  }
  if (call.state === "error") {
    return (
      <div className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>{call.resultText ?? "שגיאה"}</span>
      </div>
    );
  }

  const running = call.state === "running";

  const handleApprove = () => {
    if (editing) {
      try {
        const parsed = JSON.parse(draft);
        setParseError(null);
        onApprove(call.id, parsed);
      } catch {
        setParseError("JSON לא תקין");
        return;
      }
    } else {
      onApprove(call.id);
    }
  };

  return (
    <div className="rounded-lg border border-primary-200 bg-primary-50/60 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink-900">{title}</span>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          disabled={running}
          className="p-1 rounded-md text-ink-400 hover:text-ink-900 hover:bg-white/70"
          title="ערוך פרטים"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={Math.min(14, draft.split("\n").length + 1)}
          dir="ltr"
          className="field text-xs font-mono w-full"
        />
      ) : (
        <ProposalSummary input={call.input} />
      )}
      {parseError && <p className="text-xs text-danger-600">{parseError}</p>}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onDismiss(call.id)}
          disabled={running}
          className="btn-ghost text-xs gap-1"
        >
          <X className="w-3.5 h-3.5" /> דחה
        </button>
        <button
          type="button"
          onClick={handleApprove}
          disabled={running}
          className="btn-dark text-xs gap-1"
        >
          {running ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          {running ? "מבצע..." : "אשר"}
        </button>
      </div>
    </div>
  );
}

/** A friendly, read-only summary of a tool's proposed arguments (Hebrew-ish
 *  key labels for the common food fields; falls back to key: value). */
function ProposalSummary({ input }: { input: Record<string, unknown> }) {
  const LABELS: Record<string, string> = {
    name: "שם",
    category: "קטגוריה",
    units: "יחידות",
    ingredients: "מצרכים",
    meal_times: "זמני ארוחה",
    notes: "הערות",
    servings: "מנות",
  };
  return (
    <div className="text-xs text-ink-700 space-y-1">
      {Object.entries(input).map(([k, v]) => (
        <div key={k} className="flex gap-1.5">
          <span className="text-ink-400 shrink-0">{LABELS[k] ?? k}:</span>
          <span className={cn("min-w-0 break-words whitespace-pre-line")}>
            {k === "units" && Array.isArray(v) ? renderUnits(v) : renderValue(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Formats the `units` array with Hebrew nutrition labels (one line per unit)
 *  so the card reads "100 גרם · 350 קל׳ · חלבון 12ג׳ · ..." instead of a raw
 *  "גרם 100 350 12 1.5 70 true" value dump. */
function renderUnits(units: unknown[]): string {
  return units
    .map((u) => {
      if (!u || typeof u !== "object") return String(u);
      const o = u as Record<string, unknown>;
      const num = (x: unknown) => (x == null || x === "" ? null : String(x));
      const amount = num(o.amount);
      const name = (o.unit_name as string) || "יחידה";
      const parts: string[] = [amount ? `${amount} ${name}` : name];
      if (num(o.calories) != null) parts.push(`${o.calories} קל׳`);
      if (num(o.protein_g) != null) parts.push(`חלבון ${o.protein_g}ג׳`);
      if (num(o.fat_g) != null) parts.push(`שומן ${o.fat_g}ג׳`);
      if (num(o.carbs_g) != null) parts.push(`פחמ׳ ${o.carbs_g}ג׳`);
      if (o.is_default) parts.push("ברירת מחדל");
      return parts.join(" · ");
    })
    .join("\n");
}

function renderValue(v: unknown): string {
  if (v == null) return "—";
  if (Array.isArray(v)) {
    return v
      .map((item) =>
        item && typeof item === "object"
          ? Object.values(item as Record<string, unknown>)
              .filter((x) => x != null && x !== "")
              .join(" ")
          : String(item)
      )
      .join(", ");
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
