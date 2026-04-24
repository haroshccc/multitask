import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Lightweight RRULE picker — covers the cases a user actually hits in daily
 * planning: daily, every N days, weekly on selected weekdays, monthly on a
 * day-of-month, yearly, plus an optional "until" date.
 *
 * Round-trips through an RFC 5545 RRULE string (the format Google Calendar
 * and the `recurrence_rule` column already speak). Outputs `null` when
 * recurrence is off.
 */

type Freq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

const WEEKDAY_KEYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
type WeekdayKey = (typeof WEEKDAY_KEYS)[number];
const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  SU: "א",
  MO: "ב",
  TU: "ג",
  WE: "ד",
  TH: "ה",
  FR: "ו",
  SA: "ש",
};

interface RrulePickerProps {
  value: string | null;
  onChange: (rrule: string | null) => void;
  /** Anchor date (starts_at for events / due_at for tasks), used to seed the
   *  initial weekday / day-of-month / month. Not required, we pull sensible
   *  defaults if missing. */
  anchorDate?: Date | null;
}

export function RrulePicker({ value, onChange, anchorDate }: RrulePickerProps) {
  const parsed = useMemo(() => parse(value), [value]);
  const [enabled, setEnabled] = useState<boolean>(!!value);
  const [freq, setFreq] = useState<Freq>(parsed?.freq ?? "WEEKLY");
  const [interval, setInterval] = useState<number>(parsed?.interval ?? 1);
  const [byday, setByday] = useState<WeekdayKey[]>(
    parsed?.byday ?? weekdayFromDate(anchorDate)
  );
  const [until, setUntil] = useState<string>(parsed?.until ?? "");

  // Stay in sync if parent value changes externally.
  useEffect(() => {
    if (value == null) {
      setEnabled(false);
      return;
    }
    const p = parse(value);
    if (!p) return;
    setEnabled(true);
    setFreq(p.freq);
    setInterval(p.interval);
    if (p.byday) setByday(p.byday);
    if (p.until) setUntil(p.until);
  }, [value]);

  // Emit RRULE whenever any control changes.
  useEffect(() => {
    if (!enabled) {
      onChange(null);
      return;
    }
    onChange(
      build({
        freq,
        interval: Math.max(1, interval || 1),
        byday: freq === "WEEKLY" ? byday : undefined,
        until: until || undefined,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, freq, interval, byday.join(","), until]);

  const toggleDay = (d: WeekdayKey) => {
    setByday((arr) =>
      arr.includes(d) ? arr.filter((x) => x !== d) : [...arr, d]
    );
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-ink-700 select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="w-4 h-4"
        />
        אירוע חוזר
      </label>

      {enabled && (
        <div className="space-y-3 p-3 border border-ink-200 rounded-md bg-ink-50/40">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-ink-500">חוזר כל</span>
            <input
              type="number"
              min={1}
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value) || 1)}
              className="field text-sm w-16 py-1"
            />
            <select
              value={freq}
              onChange={(e) => setFreq(e.target.value as Freq)}
              className="field text-sm w-28 py-1"
            >
              <option value="DAILY">ימים</option>
              <option value="WEEKLY">שבועות</option>
              <option value="MONTHLY">חודשים</option>
              <option value="YEARLY">שנים</option>
            </select>
          </div>

          {freq === "WEEKLY" && (
            <div>
              <div className="text-[11px] text-ink-500 mb-1">בימים</div>
              <div className="inline-flex rounded-md border border-ink-200 overflow-hidden bg-white">
                {WEEKDAY_KEYS.map((d) => {
                  const active = byday.includes(d);
                  return (
                    <button
                      key={d}
                      onClick={() => toggleDay(d)}
                      className={cn(
                        "px-2 py-1 text-xs font-medium border-e border-ink-200 last:border-e-0",
                        active
                          ? "bg-ink-900 text-white"
                          : "bg-white text-ink-700 hover:bg-ink-50"
                      )}
                      type="button"
                    >
                      {WEEKDAY_LABELS[d]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="text-[11px] text-ink-500 mb-1">עד תאריך (לא חובה)</div>
            <input
              type="date"
              value={until.slice(0, 10)}
              onChange={(e) =>
                setUntil(e.target.value ? e.target.value + "T00:00:00Z" : "")
              }
              className="field text-sm"
            />
          </div>

          <div className="text-[11px] text-ink-500">
            RRULE: <code className="text-ink-700">{value || "—"}</code>
          </div>
        </div>
      )}
    </div>
  );
}

function weekdayFromDate(d?: Date | null): WeekdayKey[] {
  if (!d) return ["SU"];
  return [WEEKDAY_KEYS[d.getDay()]];
}

interface Parsed {
  freq: Freq;
  interval: number;
  byday?: WeekdayKey[];
  until?: string;
}

function parse(s: string | null | undefined): Parsed | null {
  if (!s) return null;
  const clean = s.replace(/^RRULE:/i, "");
  const parts = clean.split(";");
  const map: Record<string, string> = {};
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (k && v) map[k.toUpperCase()] = v;
  }
  const freq = (map.FREQ as Freq) ?? null;
  if (!freq || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return null;
  const interval = map.INTERVAL ? Number(map.INTERVAL) : 1;
  const byday = map.BYDAY
    ? map.BYDAY.split(",").filter((d): d is WeekdayKey =>
        (WEEKDAY_KEYS as readonly string[]).includes(d)
      )
    : undefined;
  const until = map.UNTIL
    ? // UNTIL is YYYYMMDDTHHMMSSZ; convert back to an ISO-ish form the
      // date input can round-trip.
      map.UNTIL.replace(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/,
        "$1-$2-$3T$4:$5:$6Z"
      )
    : undefined;
  return { freq, interval, byday, until };
}

function build(p: Parsed): string {
  const parts = [`FREQ=${p.freq}`];
  if (p.interval && p.interval > 1) parts.push(`INTERVAL=${p.interval}`);
  if (p.byday && p.byday.length > 0) parts.push(`BYDAY=${p.byday.join(",")}`);
  if (p.until) {
    const compact = p.until
      .replace(/[-:]/g, "")
      .replace(/\.\d+Z$/, "Z")
      .replace(/Z?$/, "Z");
    parts.push(`UNTIL=${compact}`);
  }
  return parts.join(";");
}
