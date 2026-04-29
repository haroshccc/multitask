export type Currency = "ILS" | "USD" | "EUR";

const CURRENCY_LOCALE: Record<Currency, string> = {
  ILS: "he-IL",
  USD: "en-US",
  EUR: "de-DE",
};

export function formatMoney(cents: number, currency: Currency = "ILS"): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function parseDecimalToCents(input: string): number {
  const cleaned = input.replace(/[^\d.,-]/g, "").replace(/,/g, "");
  const n = parseFloat(cleaned);
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function centsToDecimalString(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

export interface HourlyBreakdown {
  baseCents: number;
  profitPct: number;
  profitAddCents: number;
  spareAddCents: number;
  subtotalCents: number;
  vatPct: number;
  vatAddCents: number;
  totalCents: number;
}

export function computeHourlyBreakdown(args: {
  hourlyRateCents: number;
  profitPercentage: number;
  spareMode: "percent" | "hours";
  spareValue: number;
  vatPercentage: number;
}): HourlyBreakdown {
  const base = Math.max(0, args.hourlyRateCents);
  const profitPct = Math.max(0, args.profitPercentage);
  const profitAdd = Math.round((base * profitPct) / 100);
  const afterProfit = base + profitAdd;
  const spareAdd =
    args.spareMode === "percent"
      ? Math.round((afterProfit * Math.max(0, args.spareValue)) / 100)
      : 0;
  const subtotal = afterProfit + spareAdd;
  const vatPct = Math.max(0, args.vatPercentage);
  const vatAdd = Math.round((subtotal * vatPct) / 100);
  return {
    baseCents: base,
    profitPct,
    profitAddCents: profitAdd,
    spareAddCents: spareAdd,
    subtotalCents: subtotal,
    vatPct,
    vatAddCents: vatAdd,
    totalCents: subtotal + vatAdd,
  };
}

export interface FixedBreakdown {
  totalNetCents: number;
  vatPct: number;
  vatAddCents: number;
  totalGrossCents: number;
}

export function computeFixedBreakdown(args: {
  totalPriceCents: number;
  vatPercentage: number;
  priceIncludesVat: boolean;
}): FixedBreakdown {
  const vatPct = Math.max(0, args.vatPercentage);
  const total = Math.max(0, args.totalPriceCents);
  if (args.priceIncludesVat) {
    const net = Math.round((total * 100) / (100 + vatPct));
    return {
      totalNetCents: net,
      vatPct,
      vatAddCents: total - net,
      totalGrossCents: total,
    };
  }
  const vatAdd = Math.round((total * vatPct) / 100);
  return {
    totalNetCents: total,
    vatPct,
    vatAddCents: vatAdd,
    totalGrossCents: total + vatAdd,
  };
}
