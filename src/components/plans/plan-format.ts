import { PLAN_HORIZONS } from "@/lib/types/plans";

/** "YYYY-MM-DD" → "DD/MM/YYYY" (or "" when null). */
export function formatPlanDate(d: string | null | undefined): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

/** Compact range label for a plan card / header. */
export function formatPlanRange(
  start: string | null,
  end: string | null
): string {
  if (start && end) return `${formatPlanDate(start)} – ${formatPlanDate(end)}`;
  if (start) return `מ־${formatPlanDate(start)}`;
  if (end) return `עד ${formatPlanDate(end)}`;
  return "ללא טווח";
}

/** Add N months to a "YYYY-MM-DD", returning the same format. */
export function addMonthsToDate(start: string, months: number): string {
  const [y, m, d] = start.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1 + months, d ?? 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function horizonLabel(id: string | null | undefined): string {
  if (!id) return "";
  return PLAN_HORIZONS.find((h) => h.id === id)?.label ?? id;
}

/** Today as "YYYY-MM-DD" (local). */
export function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
