import { useMemo, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useDailyBrief } from "@/lib/hooks/useDailyBrief";
import { DashboardRangeContext } from "../dashboard-context";
import { BriefBanner } from "../widgets/BriefBanner";
import { staticDayRange } from "./static-range";

const OPEN_KEY = "multitask:dashboard:briefOpen";

/**
 * Collapsible AI-brief strip — the daily brief's headline in one line at
 * the top of the dashboard; expanding reveals the full BriefBanner
 * (summary, recommendations, proposals) without it dominating the page.
 */
export function BriefStrip() {
  const range = useMemo(() => staticDayRange(new Date()), []);
  const { data: brief } = useDailyBrief({ view: "day", anchor: range.anchor });
  const [open, setOpen] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem(OPEN_KEY) === "true",
  );

  const toggle = () =>
    setOpen((v) => {
      const next = !v;
      if (typeof window !== "undefined") {
        localStorage.setItem(OPEN_KEY, String(next));
      }
      return next;
    });

  const headline = brief?.output?.headline || brief?.output?.summary || null;

  return (
    <div className="rounded-2xl border border-violet-100 bg-gradient-to-l from-violet-50/80 via-white to-primary-50/60 overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-start hover:bg-white/50 transition-colors"
      >
        <span
          className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-200 to-primary-200 flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <Sparkles className="w-3.5 h-3.5 text-violet-700" />
        </span>
        <span className="text-xs font-bold text-violet-800 shrink-0">
          סיכום AI
        </span>
        <span className="flex-1 min-w-0 truncate text-sm text-ink-700">
          {headline ??
            "עוד אין סיכום להיום — פתחי כדי ליצור סיכום AI בלחיצה אחת."}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-ink-500 shrink-0 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="border-t border-violet-100 p-2 bg-white/70">
          <DashboardRangeContext.Provider value={range}>
            <BriefBanner />
          </DashboardRangeContext.Provider>
        </div>
      )}
    </div>
  );
}
