import { useEffect, useMemo, useRef, useState } from "react";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Lightweight RRULE picker — covers the cases a user actually hits in daily
 * planning: daily, every N days, weekly on selected weekdays, monthly on a
 * day-of-month, yearly, plus an optional "until" date.
 *
 * For DAILY/WEEKLY rules the user can pick a single time-of-day, or toggle
 * "multiple times per day" and add several slots (e.g. 08:00, 13:30, 21:15).
 * Multi-slot mode emits a custom BYSLOT=hh:mm,hh:mm,... param so arbitrary
 * tuples round-trip without the cartesian expansion that BYHOUR×BYMINUTE
 * would force. Single-slot mode keeps the standard BYHOUR/BYMINUTE form for
 * backward compatibility with existing data.
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

/** "HH:MM" string used by the time inputs. Single-slot recurrences serialize
 *  to BYHOUR+BYMINUTE; multi-slot recurrences use the custom BYSLOT list. */
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
  // hasTime: whether the user wants a specific time attached to the rule.
  // Defaults to false (no specific time) so new recurring tasks don't
  // force a time on the user. Set to true only when existing data has one.
  const [hasTime, setHasTime] = useState<boolean>(
    !!(parsed?.times && parsed.times.length > 0)
  );
  const [times, setTimes] = useState<TimeSlot[]>(
    parsed?.times?.length ? parsed.times : [defaultTime(anchorDate)]
  );
  const [multiTimes, setMultiTimes] = useState<boolean>(
    (parsed?.times?.length ?? 1) > 1
  );

  // Tracks the last RRULE string we emitted so the sync effect can skip
  // echoes — prevents the parent round-tripping our own value back and
  // expanding the BYHOUR×BYMINUTE cartesian product into extra slots.
  const lastEmittedRef = useRef<string | null | undefined>(undefined);

  // Stay in sync if parent value changes externally.
  useEffect(() => {
    // Skip if this is just the parent echoing back what we emitted.
    if (lastEmittedRef.current !== undefined && value === lastEmittedRef.current) {
      return;
    }
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
      setHasTime(true);
      setTimes(p.times);
      setMultiTimes(p.times.length > 1);
    } else {
      setHasTime(false);
    }
  }, [value]);

  // Time inputs only matter for DAILY/WEEKLY; for MONTHLY/YEARLY we keep the
  // anchor's time at expansion. Single-time view collapses the array to its
  // first slot so toggling multi off doesn't lose the user's most recent
  // time-of-day.
  const supportsTimes = freq === "DAILY" || freq === "WEEKLY";
  // effectiveTimes is empty when the user hasn't opted into a specific time,
  // which causes build() to omit BYHOUR/BYMINUTE from the RRULE entirely.
  const effectiveTimes: TimeSlot[] = !supportsTimes || !hasTime
    ? []
    : multiTimes
    ? times
    : [times[0] ?? defaultTime(anchorDate)];

  // Emit RRULE whenever any control changes.
  useEffect(() => {
    if (!enabled) {
      lastEmittedRef.current = null;
      onChange(null);
      return;
    }
    const next = build({
      freq,
      interval: Math.max(1, interval || 1),
      byday: freq === "WEEKLY" ? byday : undefined,
      times: effectiveTimes,
      until: until || undefined,
    });
    lastEmittedRef.current = next;
    onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, freq, interval, byday.join(","), hasTime, effectiveTimes.join(","), until]);

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
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] text-ink-600 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasTime}
                  onChange={(e) => setHasTime(e.target.checked)}
                  className="w-3.5 h-3.5"
                />
                שעה ספציפית ביום
              </label>
              {hasTime && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[11px] text-ink-500">שעה</div>
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
  /** Each "HH:MM" entry is one slot per day. Comes from BYSLOT verbatim, or
   *  from the BYHOUR×BYMINUTE cartesian expansion (legacy data path). */
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
  // BYSLOT (custom) — explicit "hh:mm,hh:mm,..." list. Wins over BYHOUR/
  // BYMINUTE because it preserves arbitrary tuples without cartesian noise.
  const slotList = map.BYSLOT
    ? map.BYSLOT.split(",")
        .map((s) => {
          const [h, m] = s.trim().split(":").map(Number);
          return { h, m: m ?? 0 };
        })
        .filter(
          ({ h, m }) =>
            Number.isInteger(h) &&
            h >= 0 &&
            h < 24 &&
            Number.isInteger(m) &&
            m >= 0 &&
            m < 60
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
  if (slotList && slotList.length > 0) {
    times = slotList
      .sort((a, b) => a.h - b.h || a.m - b.m)
      .map(
        ({ h, m }) =>
          `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
      );
  } else if (hours && hours.length > 0) {
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
    // Dedupe + sort the slot list. Single slot uses standard BYHOUR/BYMINUTE
    // for RFC 5545 compatibility; multi-slot uses the custom BYSLOT extension
    // so arbitrary times like (08:00, 13:30, 21:15) round-trip without the
    // cartesian expansion BYHOUR×BYMINUTE would force.
    const seen = new Set<string>();
    const slots: Array<{ h: number; m: number }> = [];
    for (const t of p.times) {
      const [hStr, mStr] = t.split(":");
      const h = Number(hStr);
      const m = Number(mStr ?? 0);
      const key = `${h}:${m}`;
      if (seen.has(key)) continue;
      seen.add(key);
      slots.push({ h, m });
    }
    slots.sort((a, b) => a.h - b.h || a.m - b.m);
    if (slots.length === 1) {
      parts.push(`BYHOUR=${slots[0].h}`);
      parts.push(`BYMINUTE=${slots[0].m}`);
    } else {
      parts.push(
        `BYSLOT=${slots
          .map(
            ({ h, m }) =>
              `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
          )
          .join(",")}`
      );
    }
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
