import { useEffect, useMemo, useRef, useState } from "react";
import { useEvents } from "./useEvents";
import { useFocusPrefs } from "./useFocusPrefs";
import { systemNotify } from "@/lib/focus/notify";

/**
 * System-notification reminders for upcoming calendar events, while the app
 * is open. Complements FocusSessionProvider (which alerts on scheduled
 * *tasks*): one notification per event, ~10 minutes before it starts.
 *
 * Respects the same focus prefs (master switch + system notifications) and
 * the Notification permission the user granted in הגדרות → התראות.
 * Recurring events only remind on the master occurrence (the expansion
 * happens in calendar views, not here) — acceptable for v1.
 */
const LEAD_MIN = 10;

export function useEventReminders() {
  const { prefs } = useFocusPrefs();

  // Today + tomorrow, refreshed every 10 minutes so a long-lived tab rolls
  // over at midnight without a reload.
  const [dayKey, setDayKey] = useState(() => new Date().toDateString());
  useEffect(() => {
    const id = setInterval(
      () => setDayKey(new Date().toDateString()),
      10 * 60_000,
    );
    return () => clearInterval(id);
  }, []);
  const range = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 48 * 3_600_000);
    return { from: from.toISOString(), to: to.toISOString() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey]);
  const { data: events = [] } = useEvents(range);

  // One reminder per (event, start) for the lifetime of the tab.
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!prefs.enabled || !prefs.systemNotifications) return;
    const tick = () => {
      const now = Date.now();
      for (const e of events) {
        const start = new Date(e.starts_at).getTime();
        if (isNaN(start)) continue;
        if (now < start - LEAD_MIN * 60_000 || now >= start) continue;
        const key = `${e.id}@${e.starts_at}`;
        if (firedRef.current.has(key)) continue;
        firedRef.current.add(key);
        const minutes = Math.max(1, Math.round((start - now) / 60_000));
        systemNotify(
          `📅 ${e.title?.trim() || "אירוע"}`,
          `מתחיל בעוד ${minutes} דק'${e.location ? ` · ${e.location}` : ""}`,
        );
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [events, prefs.enabled, prefs.systemNotifications]);
}
