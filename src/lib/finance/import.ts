/**
 * Best-effort parser for a pasted credit-card statement. Each line becomes a
 * row {chargeDate, withdrawDate, title, amount, note}; every field stays
 * editable in the UI, so the parser only needs to be a helpful starting point.
 *
 * A line may hold one OR two dates. The earlier is the charge date, the later
 * is the account-deduction date. With a single date, the deduction date
 * defaults to the same day. Both dates are stripped from the text so they never
 * leak into the note.
 */
import { toDateKey } from "@/lib/finance/calc";

export interface ParsedCreditRow {
  chargeDate: string; // yyyy-mm-dd (local) or ""
  withdrawDate: string; // >= chargeDate, defaults to chargeDate
  title: string;
  amount: number | null;
  note: string;
}

const DATE_RE = /(\d{1,2})([/.\-])(\d{1,2})(?:[/.\-](\d{2,4}))?/g;
// money-like: 1,234.56 / 1234.56 / plain integer (fallback)
const NUM_RE = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+\.\d+|-?\d+/g;

export function parseCreditText(text: string): ParsedCreditRow[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseLine)
    .filter((r) => r.title || r.amount != null || r.chargeDate);
}

function parseLine(line: string): ParsedCreditRow {
  let work = ` ${line} `;
  const totalNums = (work.match(NUM_RE) ?? []).length;

  // 1) collect every VALID date. A "." separator without a year is weak (it
  //    collides with decimal amounts like 45.90), so only accept it when there
  //    is another number left to serve as the amount.
  const found: { date: string; start: number; end: number }[] = [];
  for (const dm of work.matchAll(DATE_RE)) {
    const nd = normalizeDate(dm);
    if (!nd) continue;
    const hasYear = dm[4] ? 2 : 0;
    const slashSep = dm[2] !== "." ? 1 : 0;
    if (hasYear + slashSep === 0 && totalNums <= 1) continue; // lone decimal → amount
    if (dm.index != null) found.push({ date: nd, start: dm.index, end: dm.index + dm[0].length });
  }

  // strip all detected dates from the text (right-to-left to keep indices valid)
  for (const s of [...found].sort((a, b) => b.start - a.start)) {
    work = work.slice(0, s.start) + "  " + work.slice(s.end);
  }

  // earlier date = charge, later = deduction; single date → both the same
  const dates = [...new Set(found.map((f) => f.date))].sort();
  const chargeDate = dates[0] ?? "";
  const withdrawDate = dates.length > 1 ? dates[dates.length - 1] : chargeDate;

  // 2) amount — prefer a money-like number (has . or ,), else the last number
  let amount: number | null = null;
  const nums = [...work.matchAll(NUM_RE)];
  if (nums.length) {
    const money = nums.filter((m) => /[.,]/.test(m[0]));
    const pool = money.length ? money : nums;
    const chosen = pool[pool.length - 1];
    amount = parseAmount(chosen[0]);
    if (chosen.index != null) {
      work = work.slice(0, chosen.index) + "  " + work.slice(chosen.index + chosen[0].length);
    }
  }

  // 3) whatever remains → title (+ note from any trailing segment)
  const rest = work
    .split(/\t|;|\||,|\s{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  const title = rest.shift() ?? "";
  const note = rest.join(" · ");
  return { chargeDate, withdrawDate, title, amount, note };
}

function normalizeDate(m: RegExpMatchArray): string {
  const d = Number(m[1]);
  const mo = Number(m[3]);
  let y = m[4] ? Number(m[4]) : new Date().getFullYear();
  if (y < 100) y += 2000;
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return "";
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return "";
  return toDateKey(dt);
}

function parseAmount(raw: string): number | null {
  const n = Number(raw.replace(/[^\d.-]/g, "").replace(/(?!^)-/g, ""));
  return Number.isFinite(n) && n !== 0 ? Math.abs(n) : Number.isFinite(n) ? n : null;
}
