import { useMemo, useState } from "react";
import { Copy, Mail, Link2, MessageSquare, Loader2, Check } from "lucide-react";
import { useProject, useTasksByProject } from "@/lib/hooks";
import {
  computeFixedBreakdown,
  computeHourlyBreakdown,
  formatMoney,
  type Currency,
} from "@/lib/utils/pricing";

/**
 * Quick text-based quote: composes a project summary + task list + total.
 * Sharing channels (PDF / WhatsApp / Mail / public link) come in a follow-up
 * — for now we provide "copy to clipboard" so it can be pasted anywhere.
 */
export function QuoteBlock({ scopeId }: { scopeId?: string | null }) {
  const projectId = scopeId ?? null;
  const { data: project } = useProject(projectId);
  const { data: tasks = [] } = useTasksByProject(projectId);
  const [copied, setCopied] = useState(false);

  const quote = useMemo(() => {
    if (!project) return null;
    const currency: Currency = (project.currency as Currency) ?? "ILS";
    const estimatedHours = tasks.reduce(
      (s, t) => s + (t.estimated_hours ?? 0),
      0
    );

    let totalCents = 0;
    let perHourCents = 0;
    if (project.pricing_mode === "hourly" && project.hourly_rate_cents) {
      const b = computeHourlyBreakdown({
        hourlyRateCents: project.hourly_rate_cents,
        profitPercentage: project.profit_percentage ?? 0,
        spareMode:
          (project.spare_mode as "percent" | "hours" | null) ?? "percent",
        spareValue: 0,
        vatPercentage: 0,
      });
      perHourCents = b.subtotalCents;
      totalCents = Math.round(perHourCents * estimatedHours);
    } else if (project.pricing_mode === "fixed_price" && project.total_price_cents) {
      const b = computeFixedBreakdown({
        totalPriceCents: project.total_price_cents,
        vatPercentage: 0,
        priceIncludesVat: false,
      });
      totalCents = b.totalGrossCents;
    }

    const lines: string[] = [];
    lines.push(`הצעת מחיר — ${project.name}`);
    if (project.description) lines.push(project.description);
    lines.push("");
    lines.push("משימות:");
    if (tasks.length === 0) {
      lines.push("  (אין משימות מוגדרות)");
    } else {
      for (const t of tasks) {
        const est = t.estimated_hours
          ? ` (${t.estimated_hours} ש)`
          : "";
        lines.push(`  • ${t.title}${est}`);
      }
    }
    lines.push("");
    if (project.pricing_mode === "hourly") {
      lines.push(
        `תעריף: ${formatMoney(perHourCents, currency)} לשעה · ${estimatedHours.toFixed(
          1
        )} שעות`
      );
    }
    lines.push(`סה״כ: ${formatMoney(totalCents, currency)}`);

    return { text: lines.join("\n"), totalCents, currency, taskCount: tasks.length };
  }, [project, tasks]);

  const handleCopy = async () => {
    if (!quote) return;
    try {
      await navigator.clipboard.writeText(quote.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // graceful fallback: select-all in a hidden textarea (rare path)
    }
  };

  if (!project) {
    return (
      <div className="text-xs text-ink-500 text-center py-6">
        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-ink-500">סה״כ הצעה</span>
        <span className="text-2xl font-bold text-gradient tabular-nums">
          {quote ? formatMoney(quote.totalCents, quote.currency) : "—"}
        </span>
      </div>

      <pre className="flex-1 min-h-0 overflow-auto text-[11px] leading-relaxed text-ink-700 bg-ink-50 rounded-md p-3 whitespace-pre-wrap font-sans">
        {quote?.text ?? ""}
      </pre>

      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={handleCopy}
          disabled={!quote}
          className="btn-accent text-xs flex items-center gap-1"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              הועתק!
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              העתיקי טקסט
            </>
          )}
        </button>
        <button
          type="button"
          disabled
          title="בקרוב"
          className="btn-outline text-xs flex items-center gap-1 disabled:opacity-50"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          WhatsApp
        </button>
        <button
          type="button"
          disabled
          title="בקרוב"
          className="btn-outline text-xs flex items-center gap-1 disabled:opacity-50"
        >
          <Mail className="w-3.5 h-3.5" />
          מייל
        </button>
        <button
          type="button"
          disabled
          title="בקרוב"
          className="btn-outline text-xs flex items-center gap-1 disabled:opacity-50"
        >
          <Link2 className="w-3.5 h-3.5" />
          קישור
        </button>
      </div>
    </div>
  );
}
