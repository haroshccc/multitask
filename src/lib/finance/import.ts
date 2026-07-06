/**
 * Best-effort parser for a pasted credit-card statement. Each line becomes a
 * row {date, title, amount, note}; every field stays editable in the UI, so
 * the parser only needs to be a helpful starting point, not perfect.
 */
import { toDateKey } from "@/lib/finance/calc";

export interface ParsedCreditRow {
  date: string; // yyyy-mm-dd (local) or "" if not detected
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
    .filter((r) => r.title || r.amount != null || r.date);
}

function parseLine(line: string): ParsedCreditRow {
  let work = ` ${line} `;
  const totalNums = (work.match(NUM_RE) ?? []).length;

  // 1) date — pick the strongest VALID date candidate. A "." separator without
  //    a year is weak (it collides with decimal amounts like 45.90), so only
  //    use it when there is another number left to serve as the amount.
  let date = "";
  let bestScore = -1;
  let bestMatch: RegExpMatchArray | null = null;
  for (const dm of work.matchAll(DATE_RE)) {
    if (!normalizeDate(dm)) continue;
    const hasYear = dm[4] ? 2 : 0;
    const slashSep = dm[2] !== "." ? 1 : 0;
    const score = hasYear + slashSep;
    if (score === 0 && totalNums <= 1) continue; // lone decimal → it's the amount
    if (score > bestScore) {
      bestScore = score;
      bestMatch = dm;
    }
  }
  if (bestMatch && bestMatch.index != null) {
    date = normalizeDate(bestMatch);
    work = work.slice(0, bestMatch.index) + "  " + work.slice(bestMatch.index + bestMatch[0].length);
  }

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
  return { date, title, amount, note };
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
