import { useState, useRef, useEffect, useMemo } from "react";
import { Settings, Clock, Globe } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useCalendarPrefs,
  listAvailableTimezones,
} from "@/lib/hooks/useCalendarPrefs";

/**
 * Gear + "24h" quick toggle. The gear opens a popover where the user sets
 * their default hour range (start/end). The 24h button is a fast override —
 * click once to show 24 hours, click again to go back to the saved default.
 */
export function HourRangeSettings() {
  const { prefs, setPrefs, toggle24h, resetTimezone } = useCalendarPrefs();
  const [open, setOpen] = useState(false);
  const [tzQuery, setTzQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const timezones = useMemo(() => listAvailableTimezones(), []);
  const filteredTimezones = useMemo(() => {
    const q = tzQuery.trim().toLowerCase();
    if (!q) return timezones.slice(0, 80);
    return timezones.filter((tz) => tz.toLowerCase().includes(q)).slice(0, 200);
  }, [tzQuery, timezones]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative inline-flex items-center gap-1" ref={ref}>
      <button
        onClick={toggle24h}
        className={cn(
          "inline-flex items-center gap-1 rounded-md text-xs font-medium px-2 py-1 border transition-colors",
          prefs.show24h
            ? "bg-ink-900 text-white border-ink-900"
            : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
        )}
        title="הצג את כל 24 השעות"
        type="button"
      >
        <Clock className="w-3.5 h-3.5" />
        24h
      </button>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-md text-ink-600 hover:bg-ink-100"
        title="הגדרות שעות ברירת מחדל"
        type="button"
      >
        <Settings className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute top-full start-0 mt-1 z-30 bg-white border border-ink-200 rounded-xl shadow-lift w-64 max-w-[calc(100vw-1rem)] p-3 space-y-3">
          <div>
            <label className="eyebrow block mb-1">שעות מוצגות כברירת מחדל</label>
            <p className="text-[11px] text-ink-500 mb-2">
              טווח השעות שיופיע ביום ובשבוע. קליק על "24h" בכל עת חושף את השאר.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] text-ink-500 block">
                התחלה
                <select
                  value={prefs.hourStart}
                  onChange={(e) =>
                    setPrefs({ hourStart: Number(e.target.value) })
                  }
                  className="field text-sm mt-1"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h} disabled={h >= prefs.hourEnd}>
                      {pad(h)}:00
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[10px] text-ink-500 block">
                סיום
                <select
                  value={prefs.hourEnd}
                  onChange={(e) =>
                    setPrefs({ hourEnd: Number(e.target.value) })
                  }
                  className="field text-sm mt-1"
                >
                  {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => (
                    <option key={h} value={h} disabled={h <= prefs.hourStart}>
                      {pad(h)}:00
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setPrefs({ hourStart: 7, hourEnd: 22, show24h: false })}
              className="btn-ghost text-xs"
              type="button"
            >
              אפס לברירת מחדל
            </button>
          </div>

          <div className="border-t border-ink-200 pt-3">
            <label className="eyebrow block mb-1 flex items-center gap-1">
              <Globe className="w-3 h-3" />
              אזור זמן
            </label>
            <p className="text-[11px] text-ink-500 mb-2">
              התאריכים והשעות ביומן מוצגים לפי אזור הזמן הזה.
            </p>
            <input
              type="text"
              value={tzQuery}
              onChange={(e) => setTzQuery(e.target.value)}
              placeholder="חיפוש... (למשל Jerusalem)"
              className="field text-sm mb-1"
            />
            <select
              value={prefs.timezone}
              onChange={(e) => setPrefs({ timezone: e.target.value })}
              className="field text-sm"
              size={6}
            >
              {filteredTimezones.includes(prefs.timezone) ? null : (
                <option value={prefs.timezone}>{prefs.timezone}</option>
              )}
              {filteredTimezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
            <div className="flex justify-between items-center mt-2">
              <span className="text-[10px] text-ink-500">
                נוכחי: <code className="text-ink-700">{prefs.timezone}</code>
              </span>
              <button
                onClick={resetTimezone}
                className="btn-ghost text-xs"
                type="button"
              >
                זיהוי אוטומטי
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
