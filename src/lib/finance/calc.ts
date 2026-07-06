/**
 * Finance computations — budget remaining, per-period division, and the
 * red/green signal. See docs/finance-module-spec.md §3.3.
 *
 * Cycle model: budgets always operate on a *monthly* cycle for display and
 * closing. A yearly budget simply contributes amount/12 as its monthly
 * allocation (§"yearly divides into 12, then to day/week").
 */
import {
  startOfMonth,
  endOfMonth,
  getDaysInMonth,
  getDate,
  parseISO,
} from "date-fns";
import type {
  FinanceBudgetVersion,
  FinanceOccurrence,
  RemainderUnit,
} from "@/lib/types/finance";

export type DivisionColor = "green" | "red" | "neutral";

/**
 * The version in effect as of `asOf`. When several versions share the same
 * effective_from (e.g. right after an amount edit, the old version is closed
 * and a new open one is inserted on the same day) we prefer the still-open one
 * and, failing that, the most recently created — so the newest amount wins.
 */
export function activeVersion(
  versions: FinanceBudgetVersion[],
  asOf: Date = new Date()
): FinanceBudgetVersion | null {
  const cmp = (a: FinanceBudgetVersion, b: FinanceBudgetVersion) => {
    const aOpen = a.effective_to ? 0 : 1;
    const bOpen = b.effective_to ? 0 : 1;
    if (aOpen !== bOpen) return bOpen - aOpen; // open version first
    if (a.effective_from !== b.effective_from) return a.effective_from < b.effective_from ? 1 : -1;
    return a.created_at < b.created_at ? 1 : -1; // newest first
  };
  const key = toDateKey(asOf);
  const started = versions
    .filter((v) => v.effective_from <= key)
    .filter((v) => !v.effective_to || v.effective_to >= key)
    .sort(cmp);
  // fall back to the most recent version even if its window has lapsed
  return started[0] ?? versions.slice().sort(cmp)[0] ?? null;
}

/** Monthly allocation for a version (yearly → /12). */
export function monthlyAllocation(version: FinanceBudgetVersion | null): number {
  if (!version) return 0;
  return version.period === "yearly" ? version.amount / 12 : version.amount;
}

/** Sum of occurrences charged to the budget within the given month. */
export function chargedInMonth(
  occurrences: FinanceOccurrence[],
  asOf: Date = new Date()
): number {
  const start = toDateKey(startOfMonth(asOf));
  const end = toDateKey(endOfMonth(asOf));
  return occurrences
    .filter((o) => o.budget_charged && o.due_date >= start && o.due_date <= end)
    .reduce((sum, o) => sum + Number(o.amount), 0);
}

export interface BudgetMonthSnapshot {
  allocation: number; // effective monthly allocation (incl. carryover)
  charged: number;
  remaining: number;
  daysInMonth: number;
  daysRemaining: number;
  weeksInMonth: number;
  weeksRemaining: number;
}

export function budgetMonthSnapshot(
  version: FinanceBudgetVersion | null,
  occurrences: FinanceOccurrence[],
  asOf: Date = new Date(),
  carryoverAdjustment = 0
): BudgetMonthSnapshot {
  const allocation = monthlyAllocation(version) + carryoverAdjustment;
  const charged = chargedInMonth(occurrences, asOf);
  const remaining = allocation - charged;
  const daysInMonth = getDaysInMonth(asOf);
  const daysRemaining = Math.max(1, daysInMonth - getDate(asOf) + 1); // incl. today
  const weeksInMonth = daysInMonth / 7;
  const weeksRemaining = daysRemaining / 7;
  return {
    allocation,
    charged,
    remaining,
    daysInMonth,
    daysRemaining,
    weeksInMonth,
    weeksRemaining,
  };
}

export interface DivisionView {
  unit: RemainderUnit;
  value: number; // current dynamic value (remaining ÷ remaining units)
  baseline: number; // allocation ÷ total units (mathematical baseline)
  color: DivisionColor;
}

/** Compute the current value, baseline and color for one remainder unit. */
export function divisionView(
  unit: RemainderUnit,
  snap: BudgetMonthSnapshot
): DivisionView {
  let value: number;
  let baseline: number;
  switch (unit) {
    case "day":
      value = snap.remaining / snap.daysRemaining;
      baseline = snap.allocation / snap.daysInMonth;
      break;
    case "week":
      value = snap.remaining / snap.weeksRemaining;
      baseline = snap.allocation / snap.weeksInMonth;
      break;
    case "month":
    default:
      value = snap.remaining;
      baseline = snap.allocation;
      break;
  }

  let color: DivisionColor;
  if (unit === "month") {
    // For the whole-month view the rate comparison is meaningless (remaining is
    // always ≤ allocation once anything is charged). Signal by sign instead.
    color = snap.remaining < 0 ? "red" : "neutral";
  } else {
    // green = on/under pace. Note `value >= baseline` is algebraically
    // `remaining >= allocation * (daysRemaining / daysInMonth)` — i.e. you have
    // at least the on-pace expected balance left for the days that remain.
    color = value < 0 ? "red" : value >= baseline ? "green" : "red";
  }
  return { unit, value, baseline, color };
}

// ---- Account helpers ---------------------------------------------------------

export function accountBalance(
  openingBalance: number,
  transactions: { amount: number }[]
): number {
  return transactions.reduce((sum, t) => sum + Number(t.amount), openingBalance);
}

// ---- Formatting --------------------------------------------------------------

const ils = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});
const ilsPrecise = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 1,
});

export function formatMoney(n: number, precise = false): string {
  if (!Number.isFinite(n)) return "—";
  return (precise ? ilsPrecise : ils).format(n);
}

export const TEXT_COLOR: Record<DivisionColor, string> = {
  green: "text-success-600",
  red: "text-danger-600",
  neutral: "text-ink-900",
};

// ---- Date utils --------------------------------------------------------------

/** Local yyyy-mm-dd (no UTC shift). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthKey(d: Date = new Date()): string {
  return toDateKey(startOfMonth(d));
}

export function parseDateKey(key: string): Date {
  return parseISO(key);
}

/**
 * Credit billing cycle for a date: runs from the 2nd of a month to the 1st of
 * the next. The 1st belongs to the previous cycle. Returns a sortable key
 * (the cycle's start date) and a display label like "2.7.2025 – 1.8.2025".
 */
export function billingCycle(dateKey: string): { key: string; label: string } {
  const d = parseDateKey(dateKey);
  const start =
    d.getDate() >= 2
      ? new Date(d.getFullYear(), d.getMonth(), 2)
      : new Date(d.getFullYear(), d.getMonth() - 1, 2);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const fmt = (x: Date) => `${x.getDate()}.${x.getMonth() + 1}.${x.getFullYear()}`;
  return { key: toDateKey(start), label: `${fmt(start)} – ${fmt(end)}` };
}
