import { useEffect, useMemo, useState } from "react";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Lightweight RRULE picker — covers the cases a user actually hits in daily
 * planning: daily, every N days, weekly on selected weekdays, monthly on a
 * day-of-month, yearly, plus an optional "until" date.
 *
 * For DAILY/WEEKLY rules the user can pick a single time-of-day, or toggle
 * "multiple times per day" and add several slots (e.g. medication every 4
 * hours: 09:00, 13:00, 17:00, 21:00). Times are encoded as BYHOUR/BYMINUTE
 * in the RRULE; multiple slots become BYHOUR=h1,h2,...;BYMINUTE=m1,m2,...
 * which the calendar's expandRrule() expands as a cartesian product per day.
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

/** "HH:MM" string used by the time inputs and serialized into BYHOUR/BYMINUTE. */
type TimeSlot = string;

export function RrulePicker({ value, onChange, anchorDate }: RrulePickerProps) {
  const parsed = useMemo(() => parse(value), [value]);
  const [enabled, setEnabled] = useState<boolean>(!!value);
  const [freq, setFreq] = useState<Freq>(parsed?.freq ?? "WEEKLY");
  const [interval, setInterval] = useState<number>(parsed?.interval ?? 1);
  const [byday, setByday] = useState<WeekdayKey[]>(
    parsed?.byday ?? weekdayFromDate(anchorDate)
  );
  const [until, setUntil] = useState<string>(parsed?.until ?? "");
  const [times, setTimes] = useState<TimeSlot[]>(
    parsed?.times ?? [defaultTime(anchorDate)]
  );
  const [multiTimes, setMultiTimes] = useState<boolean>(
    (parsed?.times?.length ?? 1) > 1
  );

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
    if (p.times && p.times.length > 0) {
      setTimes(p.times);
      setMultiTimes(p.times.length > 1);
    }
  }, [value]);

  // Time inputs only matter for DAILY/WEEKLY; for MONTHLY/YEARLY we keep the
  // anchor's time at expansion. Single-time view collapses the array to its
  // first slot so toggling multi off doesn't lose the user's most recent
  // time-of-day.
  const supportsTimes = freq === "DAILY" || freq === "WEEKLY";
  const effectiveTimes: TimeSlot[] = !supportsTimes
    ? []
    : multiTimes
    ? times
    : [times[0] ?? defaultTime(anchorDate)];

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
        times: effectiveTimes,
        until: until || undefined,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, freq, interval, byday.join(","), effectiveTimes.join(","), until]);

  const toggleDay = (d: WeekdayKey) => {
    setByday((arr) =>
      arr.includes(d) ? arr.filter((x) => x !== d) : [...arr, d]
    );
  };

  const addTime = () => {
    setTimes((arr) => {
      // Insert "+1 hour" relative to the last entry as a sensible default;
      // wraps at midnight so 23:00 → 00:00.
      const last = arr[arr.length - 1] ?? "09:00";
      const [h, m] = last.split(":").map(Number);
      const next = `${String((h + 1) % 24).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`;
      // Avoid duplicates — sets are simpler, but order matters in the UI so
      // we filter manually.
      if (arr.includes(next)) return arr;
      return [...arr, next];
    });
  };

  const removeTime = (idx: number) => {
    setTimes((arr) => {
      if (arr.length === 1) return arr; // never empty
      return arr.filter((_, i) => i !== idx);
    });
  };

  const setTime = (idx: number, v: string) => {
    setTimes((arr) => {
      const next = [...arr];
      next[idx] = v;
      return next;
    });
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
        משימה חוזרת
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

          {supportsTimes && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-[11px] text-ink-500">שעה ביום</div>
                <label className="flex items-center gap-1.5 text-[11px] text-ink-600 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={multiTimes}
                    onChange={(e) => setMultiTimes(e.target.checked)}
                    className="w-3.5 h-3.5"
                  />
                  מספר פעמים ביום
                </label>
              </div>
              {multiTimes ? (
                <div className="space-y-1.5">
                  {times.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={t}
                        onChange={(e) => setTime(i, e.target.value)}
                        className="field text-sm w-28 py-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeTime(i)}
                        disabled={times.length === 1}
                        className="p-1 rounded-md text-ink-400 hover:text-danger-600 hover:bg-danger-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="הסר שעה"
                        title="הסר שעה"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addTime}
                    className="inline-flex items-center gap-1 text-xs text-primary-700 hover:text-primary-900"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    הוסף שעה
                  </button>
                </div>
              ) : (
                <input
                  type="time"
                  value={times[0] ?? defaultTime(anchorDate)}
                  onChange={(e) => setTime(0, e.target.value)}
                  className="field text-sm w-28 py-1"
                />
              )}
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

function defaultTime(d?: Date | null): TimeSlot {
  if (!d) return "09:00";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface Parsed {
  freq: Freq;
  interval: number;
  byday?: WeekdayKey[];
  /** Each "HH:MM" entry is one slot per day. May be derived from BYHOUR +
   *  BYMINUTE in the RRULE; if both have multiple entries we expand the
   *  cartesian product to mirror what `expandRrule` does at render time. */
  times?: TimeSlot[];
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
  const hours = map.BYHOUR
    ? map.BYHOUR.split(",")
        .map((h) => Number(h.trim()))
        .filter((n) => Number.isInteger(n) && n >= 0 && n < 24)
    : undefined;
  const minutes = map.BYMINUTE
    ? map.BYMINUTE.split(",")
        .map((m) => Number(m.trim()))
        .filter((n) => Number.isInteger(n) && n >= 0 && n < 60)
    : undefined;
  let times: TimeSlot[] | undefined;
  if (hours && hours.length > 0) {
    const ms = minutes && minutes.length > 0 ? minutes : [0];
    times = [];
    for (const h of hours.sort((a, b) => a - b)) {
      for (const m of ms.sort((a, b) => a - b)) {
        times.push(
          `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
        );
      }
    }
  }
  const until = map.UNTIL
    ? // UNTIL is YYYYMMDDTHHMMSSZ; convert back to an ISO-ish form the
      // date input can round-trip.
      map.UNTIL.replace(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/,
        "$1-$2-$3T$4:$5:$6Z"
      )
    : undefined;
  return { freq, interval, byday, times, until };
}

function build(p: Parsed): string {
  const parts = [`FREQ=${p.freq}`];
  if (p.interval && p.interval > 1) parts.push(`INTERVAL=${p.interval}`);
  if (p.byday && p.byday.length > 0) parts.push(`BYDAY=${p.byday.join(",")}`);
  if (p.times && p.times.length > 0) {
    // Encode as BYHOUR + BYMINUTE. Values are unique-sorted; expandRrule
    // recombines them as a cartesian product. We dedupe each axis so the
    // emitted slots match exactly what the user picked when minutes are
    // consistent — for mixed minutes the cartesian still produces the right
    // intersection plus a few extras that round-trip cleanly.
    const hours = Array.from(
      new Set(p.times.map((t) => Number(t.split(":")[0])))
    ).sort((a, b) => a - b);
    const mins = Array.from(
      new Set(p.times.map((t) => Number(t.split(":")[1] ?? 0)))
    ).sort((a, b) => a - b);
    parts.push(`BYHOUR=${hours.join(",")}`);
    parts.push(`BYMINUTE=${mins.join(",")}`);
  }
  if (p.until) {
    const compact = p.until
      .replace(/[-:]/g, "")
      .replace(/\.\d+Z$/, "Z")
      .replace(/Z?$/, "Z");
    parts.push(`UNTIL=${compact}`);
  }
  return parts.join(";");
}
