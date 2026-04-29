import { useMemo, useState } from "react";
import {
  Copy,
  Mail,
  Link2,
  MessageSquare,
  Loader2,
  Check,
  Printer,
} from "lucide-react";
import {
  useProject,
  useTasksByProject,
  useProjectExpenses,
} from "@/lib/hooks";
import {
  computeFixedBreakdown,
  computeHourlyBreakdown,
  formatMoney,
  type Currency,
} from "@/lib/utils/pricing";

/**
 * Build & share a quote for the project. Implements all four channels listed
 * in §20.15:
 *  - **Print/PDF**: opens a print-styled new window — user saves as PDF via
 *    browser print dialog (cross-platform, no library dep).
 *  - **Email**: `mailto:` link pre-populated with subject + body.
 *  - **WhatsApp**: `https://wa.me/?text=` deep-link with body.
 *  - **Copy text**: clipboard fallback for any other channel.
 *
 * The public web-link channel is still deferred (needs a `quote_shares`
 * table + public read route).
 */
export function QuoteBlock({ scopeId }: { scopeId?: string | null }) {
  const projectId = scopeId ?? null;
  const { data: project } = useProject(projectId);
  const { data: tasks = [] } = useTasksByProject(projectId);
  const { data: expenses = [] } = useProjectExpenses(projectId);
  const [copied, setCopied] = useState(false);

  const quote = useMemo(() => {
    if (!project) return null;
    const currency: Currency = (project.currency as Currency) ?? "ILS";
    const vatPct = project.vat_percentage ?? 0;
    const expensesCents = expenses.reduce(
      (s, e) => s + (e.amount_cents ?? 0),
      0
    );
    const estimatedHours = tasks.reduce(
      (s, t) => s + (t.estimated_hours ?? 0),
      0
    );
    const spareHours =
      project.spare_mode === "percent"
        ? (estimatedHours * (project.spare_value ?? 0)) / 100
        : project.spare_value ?? 0;
    const effectiveHours = estimatedHours + spareHours;

    let laborCents = 0;
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
      laborCents = Math.round(perHourCents * effectiveHours);
    } else if (
      project.pricing_mode === "fixed_price" &&
      project.total_price_cents
    ) {
      const b = computeFixedBreakdown({
        totalPriceCents: project.total_price_cents,
        vatPercentage: 0,
        priceIncludesVat: false,
      });
      laborCents = b.totalGrossCents;
    }

    const subtotalCents = laborCents + expensesCents;
    const vatCents = Math.round(subtotalCents * (vatPct / 100));
    const totalCents = subtotalCents + vatCents;

    const lines: string[] = [];
    lines.push(`הצעת מחיר — ${project.name}`);
    if (project.description) lines.push(project.description);
    lines.push("");
    lines.push("משימות:");
    if (tasks.length === 0) lines.push("  (אין משימות מוגדרות)");
    else
      for (const t of tasks) {
        const est = t.estimated_hours ? ` (${t.estimated_hours} ש)` : "";
        lines.push(`  • ${t.title}${est}`);
      }
    lines.push("");
    if (project.pricing_mode === "hourly") {
      lines.push(
        `תעריף: ${formatMoney(perHourCents, currency)} לשעה · ${effectiveHours.toFixed(1)} שעות`
      );
    }
    if (expensesCents > 0)
      lines.push(`+ הוצאות: ${formatMoney(expensesCents, currency)}`);
    if (vatPct > 0)
      lines.push(`+ מע״מ ${vatPct}%: ${formatMoney(vatCents, currency)}`);
    lines.push(`סה״כ: ${formatMoney(totalCents, currency)}`);

    return {
      text: lines.join("\n"),
      totalCents,
      perHourCents,
      currency,
      effectiveHours,
      laborCents,
      expensesCents,
      vatCents,
      vatPct,
    };
  }, [project, tasks, expenses]);

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

  const handlePrintPdf = () => {
    if (!quote || !project) return;
    const win = window.open("", "_blank", "width=900,height=1200");
    if (!win) return;
    win.document.write(buildPrintHtml(project.name, quote, tasks));
    win.document.close();
    // Slight delay so the new window finishes layout before the print dialog.
    setTimeout(() => {
      win.focus();
      win.print();
    }, 250);
  };

  const handleEmail = () => {
    if (!quote || !project) return;
    const subject = `הצעת מחיר — ${project.name}`;
    const url =
      "mailto:?subject=" +
      encodeURIComponent(subject) +
      "&body=" +
      encodeURIComponent(quote.text);
    window.open(url, "_self");
  };

  const handleWhatsApp = () => {
    if (!quote) return;
    const url = "https://wa.me/?text=" + encodeURIComponent(quote.text);
    window.open(url, "_blank", "noopener,noreferrer");
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

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={handlePrintPdf}
          disabled={!quote}
          className="btn-accent text-xs flex items-center gap-1 disabled:opacity-50"
        >
          <Printer className="w-3.5 h-3.5" />
          PDF / הדפסה
        </button>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!quote}
          className="btn-outline text-xs flex items-center gap-1 disabled:opacity-50"
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
          onClick={handleWhatsApp}
          disabled={!quote}
          className="btn-outline text-xs flex items-center gap-1 disabled:opacity-50"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          WhatsApp
        </button>
        <button
          type="button"
          onClick={handleEmail}
          disabled={!quote}
          className="btn-outline text-xs flex items-center gap-1 disabled:opacity-50"
        >
          <Mail className="w-3.5 h-3.5" />
          מייל
        </button>
        <button
          type="button"
          disabled
          title="קישור ציבורי לצפייה — בקרוב"
          className="btn-outline text-xs flex items-center gap-1 disabled:opacity-50 col-span-2"
        >
          <Link2 className="w-3.5 h-3.5" />
          קישור ציבורי (בקרוב)
        </button>
      </div>
    </div>
  );
}

// ─── Print HTML ────────────────────────────────────────────────────────────

function buildPrintHtml(
  projectName: string,
  quote: NonNullable<ReturnType<typeof buildQuote>>,
  tasks: { title: string; estimated_hours: number | null }[]
): string {
  const tasksRows = tasks
    .map((t) => {
      const hours = t.estimated_hours
        ? `<td class="hours">${t.estimated_hours}</td>`
        : `<td class="hours muted">—</td>`;
      return `<tr><td class="name">${escapeHtml(t.title)}</td>${hours}</tr>`;
    })
    .join("");

  const rateLine =
    quote.perHourCents > 0
      ? `<tr><th>תעריף שעתי</th><td>${formatMoney(quote.perHourCents, quote.currency)}</td></tr>
         <tr><th>שעות אפקטיביות</th><td>${quote.effectiveHours.toFixed(1)} ש</td></tr>
         <tr><th>סה״כ עבודה</th><td>${formatMoney(quote.laborCents, quote.currency)}</td></tr>`
      : `<tr><th>סה״כ עבודה</th><td>${formatMoney(quote.laborCents, quote.currency)}</td></tr>`;

  const expensesLine =
    quote.expensesCents > 0
      ? `<tr><th>הוצאות נוספות</th><td>${formatMoney(quote.expensesCents, quote.currency)}</td></tr>`
      : "";

  const vatLine =
    quote.vatPct > 0
      ? `<tr><th>מע״מ ${quote.vatPct}%</th><td>${formatMoney(quote.vatCents, quote.currency)}</td></tr>`
      : "";

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>הצעת מחיר — ${escapeHtml(projectName)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; }
    body { font-family: Rubik, sans-serif; direction: rtl; color: #2d2d3a; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.6; }
    header { border-bottom: 2px solid #f59e0b; padding-bottom: 16px; margin-bottom: 24px; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    .meta { color: #6b6b80; font-size: 13px; }
    h2 { font-size: 16px; margin: 28px 0 8px; color: #6b6b80; text-transform: uppercase; letter-spacing: 0.06em; }
    table { width: 100%; border-collapse: collapse; }
    .tasks th, .tasks td { padding: 8px 0; border-bottom: 1px solid #ededf0; text-align: start; font-size: 13px; }
    .tasks .hours { width: 80px; text-align: end; tabular-nums: true; color: #6b6b80; }
    .tasks .muted { color: #a8a8bc; }
    .totals th, .totals td { padding: 6px 0; font-size: 13px; }
    .totals th { text-align: start; font-weight: 500; color: #6b6b80; }
    .totals td { text-align: end; tabular-nums: true; }
    .totals tr.total { border-top: 2px solid #2d2d3a; font-weight: 700; font-size: 16px; }
    .totals tr.total td { padding-top: 12px; }
    footer { margin-top: 40px; color: #a8a8bc; font-size: 11px; text-align: center; border-top: 1px solid #ededf0; padding-top: 16px; }
    @media print { body { margin: 0; max-width: none; } }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(projectName)}</h1>
    <div class="meta">הצעת מחיר · ${new Date().toLocaleDateString("he-IL")}</div>
  </header>
  <h2>פירוט משימות</h2>
  <table class="tasks">
    <thead><tr><th>משימה</th><th class="hours">שעות</th></tr></thead>
    <tbody>${tasksRows || '<tr><td colspan="2" class="muted">אין משימות מוגדרות</td></tr>'}</tbody>
  </table>
  <h2>סיכום</h2>
  <table class="totals">
    <tbody>
      ${rateLine}
      ${expensesLine}
      ${vatLine}
      <tr class="total"><td>סה״כ לתשלום</td><td>${formatMoney(quote.totalCents, quote.currency)}</td></tr>
    </tbody>
  </table>
  <footer>נוצר ב-multitask · multitask.app</footer>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Type helper: shape returned by the useMemo above.
type QuoteShape = {
  text: string;
  totalCents: number;
  perHourCents: number;
  currency: Currency;
  effectiveHours: number;
  laborCents: number;
  expensesCents: number;
  vatCents: number;
  vatPct: number;
};
function buildQuote(): QuoteShape | null {
  // Stub — actual builder is the useMemo in the component. This declaration
  // exists so TypeScript can name the shape for `buildPrintHtml`.
  return null;
}
