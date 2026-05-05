import { useEffect, useMemo, useState } from "react";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Lightweight RRULE picker — covers the cases a user actually hits in daily
 * planning: daily, every N days, weekly on selected weekdays, monthly on a
 * day-of-month, yearly, plus an optional "until" date.
 *
 * For DAILY/WEEKLY rules the user can pick a single time-of-day, or toggle
 * "multiple times per day". Multi-time mode uses an explicit HOURS × MINUTES
 * grid: the user selects which hours to fire and which minute-offsets within
 * each hour. This maps directly to BYHOUR/BYMINUTE in the RRULE — which the
 * calendar's expandRrule() expands as a cartesian product — so there is no
 * round-trip information loss.
 *
 * Round-trips through an RFC 5545 RRULE string. Outputs `null` when off.
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
  anchorDate?: Date | null;
}

type TimeSlot = string; // "HH:MM"

export function RrulePicker({ value, onChange, anchorDate }: RrulePickerProps) {
  const parsed = useMemo(() => parse(value), [value]);
  const [enabled, setEnabled] = useState<boolean>(!!value);
  const [freq, setFreq] = useState<Freq>(parsed?.freq ?? "WEEKLY");
  const [interval, setInterval] = useState<number>(parsed?.interval ?? 1);
  const [byday, setByday] = useState<WeekdayKey[]>(
    parsed?.byday ?? weekdayFromDate(anchorDate)
  );
  const [until, setUntil] = useState<string>(parsed?.until ?? "");

  // Single-time mode: one explicit "HH:MM" slot.
  const [singleTime, setSingleTime] = useState<string>(
    parsed?.times?.[0] ?? defaultTime(anchorDate)
  );

  // Multi-time mode: explicit hours × minute-offsets grid.
  // Stored as two sorted number arrays so they always match BYHOUR/BYMINUTE
  // semantics — the calendar fires at EVERY combination.
  const [gridHours, setGridHours] = useState<number[]>(() => {
    if (parsed?.times && parsed.times.length > 0) {
      return [
        ...new Set(parsed.times.map((t) => parseInt(t.split(":")[0]))),
      ].sort((a, b) => a - b);
    }
    return [anchorDate ? anchorDate.getHours() : 9];
  });
  const [gridMinutes, setGridMinutes] = useState<number[]>(() => {
    if (parsed?.times && parsed.times.length > 1) {
      return [
        ...new Set(parsed.times.map((t) => parseInt(t.split(":")[1] ?? "0"))),
      ].sort((a, b) => a - b);
    }
    return [0];
  });
  const [multiTimes, setMultiTimes] = useState<boolean>(
    (parsed?.times?.length ?? 1) > 1
  );

  // Inline "add hour" flow.
  const [addingHour, setAddingHour] = useState(false);
  const [newHourDraft, setNewHourDraft] = useState("");

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
      const hrs = [
        ...new Set(p.times.map((t) => parseInt(t.split(":")[0]))),
      ].sort((a, b) => a - b);
      const mins = [
        ...new Set(p.times.map((t) => parseInt(t.split(":")[1] ?? "0"))),
      ].sort((a, b) => a - b);
      if (p.times.length === 1) {
        setSingleTime(p.times[0]);
        setMultiTimes(false);
      } else {
        setGridHours(hrs);
        setGridMinutes(mins);
        setMultiTimes(true);
      }
    }
  }, [value]);

  const supportsTimes = freq === "DAILY" || freq === "WEEKLY";

  // Derive the flat time-slot list that goes into build().
  const effectiveTimes: TimeSlot[] = !supportsTimes
    ? []
    : multiTimes
    ? gridHours.flatMap((h) =>
        gridMinutes.map(
          (m) =>
            `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
        )
      )
    : [singleTime];

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

  // --- Multi-time grid management ---
  const commitNewHour = (raw: string) => {
    // Accept either "HH:MM" (from time input) or a bare number string.
    const h = parseInt(raw.split(":")[0]);
    if (!isNaN(h) && h >= 0 && h < 24 && !gridHours.includes(h)) {
      setGridHours((prev) => [...prev, h].sort((a, b) => a - b));
    }
    setAddingHour(false);
    setNewHourDraft("");
  };

  const removeHour = (h: number) => {
    if (gridHours.length === 1) return;
    setGridHours((prev) => prev.filter((x) => x !== h));
  };

  const toggleMinute = (m: number) => {
    if (gridMinutes.includes(m)) {
      if (gridMinutes.length === 1) return;
      setGridMinutes((prev) => prev.filter((x) => x !== m));
    } else {
      setGridMinutes((prev) => [...prev, m].sort((a, b) => a - b));
    }
  };

  // When enabling multi-time mode, seed the grid from the current single time.
  const handleMultiTimesChange = (v: boolean) => {
    if (v && !multiTimes) {
      const h = parseInt(singleTime.split(":")[0]);
      const m = parseInt(singleTime.split(":")[1] ?? "0");
      setGridHours(isNaN(h) ? [9] : [h]);
      setGridMinutes(isNaN(m) ? [0] : [m]);
    }
    setMultiTimes(v);
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
                    onChange={(e) => handleMultiTimesChange(e.target.checked)}
                    className="w-3.5 h-3.5"
                  />
                  מספר פעמים ביום
                </label>
              </div>

              {multiTimes ? (
                <div className="space-y-2">
                  {/* Active hours */}
                  <div>
                    <div className="text-[10px] text-ink-400 mb-1">שעות</div>
                    <div className="flex flex-wrap items-center gap-1">
                      {gridHours.map((h) => (
                        <span
                          key={h}
                          className="inline-flex items-center gap-1 text-xs bg-ink-100 rounded-md px-2 py-0.5 font-mono"
                        >
                          {String(h).padStart(2, "0")}
                          <button
                            type="button"
                            onClick={() => removeHour(h)}
                            disabled={gridHours.length === 1}
                            className="text-ink-400 hover:text-danger-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label={`הסר שעה ${h}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {addingHour ? (
                        <input
                          type="time"
                          value={newHourDraft}
                          onChange={(e) => setNewHourDraft(e.target.value)}
                          onBlur={() => commitNewHour(newHourDraft)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitNewHour(newHourDraft);
                            if (e.key === "Escape") {
                              setAddingHour(false);
                              setNewHourDraft("");
                            }
                          }}
                          className="field text-sm w-28 py-0.5"
                          // eslint-disable-next-line jsx-a11y/no-autofocus
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAddingHour(true)}
                          className="inline-flex items-center gap-0.5 text-xs text-primary-700 hover:text-primary-900"
                        >
                          <Plus className="w-3 h-3" />
                          שעה
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Minute offsets */}
                  <div>
                    <div className="text-[10px] text-ink-400 mb-1">
                      דקות (לכל שעה)
                    </div>
                    <div className="inline-flex rounded-md border border-ink-200 overflow-hidden">
                      {[0, 15, 30, 45].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => toggleMinute(m)}
                          className={cn(
                            "px-2 py-1 text-xs font-mono border-e border-ink-200 last:border-e-0",
                            gridMinutes.includes(m)
                              ? "bg-ink-900 text-white"
                              : "bg-white text-ink-700 hover:bg-ink-50"
                          )}
                        >
                          :{String(m).padStart(2, "0")}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="text-[10px] text-ink-400">
                    {gridHours.length * gridMinutes.length} פעמים ביום
                  </div>
                </div>
              ) : (
                <input
                  type="time"
                  value={singleTime}
                  onChange={(e) => setSingleTime(e.target.value)}
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
  if (!freq || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq))
    return null;
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
    ? map.UNTIL.replace(
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
