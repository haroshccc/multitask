import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { useEvents } from "@/lib/hooks/useEvents";
import { useDashboardRange } from "../dashboard-context";
import { cn } from "@/lib/utils/cn";

const VIEW_LABEL: Record<string, string> = {
  day: "להיום",
  week: "לשבוע",
  month: "לחודש",
};

const HE_DAY_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDayLabel(iso: string) {
  const d = new Date(iso);
  return `${HE_DAY_SHORT[d.getDay()]} ${d.getDate()}`;
}

export function RangeEvents() {
  const range = useDashboardRange();
  const { data: events = [] } = useEvents(range.range);
  const navigate = useNavigate();

  const sorted = useMemo(
    () =>
      [...events].sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      ),
    [events],
  );

  return (
    <div className="card p-3 h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <CalendarDays className="w-4 h-4 text-primary-600" />
        <h3 className="text-sm font-semibold text-ink-900">
          אירועים {VIEW_LABEL[range.view]}
        </h3>
        <span className="ms-auto text-[10px] text-ink-500 tabular-nums">
          {sorted.length}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto space-y-1.5 pe-1 scrollbar-thin">
        {sorted.length === 0 ? (
          <p className="text-center text-xs text-ink-500 py-4">
            אין אירועים בטווח הזה
          </p>
        ) : (
          sorted.map((e) => {
            const isPast = new Date(e.ends_at).getTime() < Date.now();
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => navigate("/app/calendar")}
                className={cn(
                  "w-full text-start rounded-lg border px-2.5 py-1.5 transition-colors",
                  "hover:border-primary-300 hover:bg-primary-50/40",
                  isPast
                    ? "border-ink-200 bg-ink-50/60 text-ink-500"
                    : "border-ink-200 bg-white text-ink-800",
                )}
              >
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="shrink-0 font-mono tabular-nums text-[10px] text-ink-500">
                    {range.view === "day"
                      ? fmtTime(e.starts_at)
                      : fmtDayLabel(e.starts_at)}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-xs font-medium">
                    {e.title?.trim() || "ללא כותרת"}
                  </span>
                  <span className="shrink-0 text-[10px] text-ink-500">
                    {fmtTime(e.starts_at)}–{fmtTime(e.ends_at)}
                  </span>
                </div>
                {(e.location || e.video_call_url) && (
                  <div className="mt-0.5 inline-flex items-center gap-2 text-[10px] text-ink-500">
                    {e.location && (
                      <span className="inline-flex items-center gap-0.5 truncate max-w-[160px]">
                        <MapPin className="w-2.5 h-2.5" />
                        {e.location}
                      </span>
                    )}
                    {e.video_call_url && (
                      <span className="inline-flex items-center gap-0.5">
                        <Users className="w-2.5 h-2.5" />
                        וידאו
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
