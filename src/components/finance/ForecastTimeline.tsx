/**
 * Forecast (spec §3 overview): upcoming account withdrawals that haven't been
 * paid yet, grouped by date with a running total. Charged-but-not-withdrawn
 * items are flagged distinctly from purely future-dated ones.
 */
import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { Money } from "./finance-bits";
import { toDateKey } from "@/lib/finance/calc";
import type { FinanceOccurrence, FinanceExpense } from "@/lib/types/finance";

export function ForecastTimeline({
  occurrences,
  expenses,
}: {
  occurrences: FinanceOccurrence[];
  expenses: FinanceExpense[];
}) {
  const today = toDateKey(new Date());
  const titleOf = useMemo(
    () => new Map(expenses.map((e) => [e.id, e.title])),
    [expenses]
  );

  const groups = useMemo(() => {
    const upcoming = occurrences
      .filter((o) => !o.withdrawn && (o.withdrawal_date ?? o.due_date) >= today)
      .sort((a, b) =>
        (a.withdrawal_date ?? a.due_date) < (b.withdrawal_date ?? b.due_date) ? -1 : 1
      );
    const byDate = new Map<string, FinanceOccurrence[]>();
    for (const o of upcoming) {
      const key = o.withdrawal_date ?? o.due_date;
      const arr = byDate.get(key) ?? [];
      arr.push(o);
      byDate.set(key, arr);
    }
    let running = 0;
    return [...byDate.entries()].slice(0, 12).map(([date, occs]) => {
      const sum = occs.reduce((s, o) => s + Number(o.amount), 0);
      running += sum;
      return { date, occs, sum, running };
    });
  }, [occurrences, today]);

  if (groups.length === 0) {
    return (
      <p className="px-1 py-4 text-center text-sm text-ink-400">
        אין ירידות עתידיות צפויות
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.date}>
          <div className="mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-600">
              <CalendarClock className="h-3.5 w-3.5 text-ink-400" />
              <span dir="ltr">{g.date}</span>
            </span>
            <span className="text-xs text-ink-400">
              מצטבר <Money value={g.running} />
            </span>
          </div>
          <div className="space-y-0.5">
            {g.occs.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between rounded px-2 py-1 text-sm odd:bg-ink-50"
              >
                <span className="truncate text-ink-700">
                  {titleOf.get(o.expense_id) ?? "—"}
                  {!o.budget_charged && (
                    <span className="ms-1.5 text-[11px] text-sky-500">(טרם חויב)</span>
                  )}
                </span>
                <Money value={-Number(o.amount)} className="text-ink-700" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
