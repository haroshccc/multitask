import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Lightbulb, ChevronLeft } from "lucide-react";
import { useThoughts } from "@/lib/hooks";

/**
 * Dashboard widget — "מחשבות לא מעובדות" (SPEC §14).
 *
 * Shows up to 5 unprocessed thoughts with their title/snippet. Clicking
 * through lands on the thoughts screen. This is a read-only surface; all
 * actions (process, archive) happen in-place on the thoughts screen.
 */
export function UnprocessedThoughts() {
  const { data: thoughts = [] } = useThoughts({ status: "unprocessed" });

  const recent = useMemo(() => thoughts.slice(0, 5), [thoughts]);
  const count = thoughts.length;

  return (
    <div className="card px-4 py-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="inline-flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-accent-500" />
          <h3 className="text-sm font-semibold text-ink-900">
            מחשבות לא מעובדות
          </h3>
          {count > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full bg-primary-500 text-white text-[10px] font-semibold px-1.5">
              {count}
            </span>
          )}
        </div>
        <Link
          to="/app/thoughts"
          className="inline-flex items-center gap-0.5 text-xs text-primary-600 hover:underline"
        >
          פתח
          <ChevronLeft className="w-3 h-3" />
        </Link>
      </div>

      {recent.length === 0 ? (
        <p className="text-xs text-ink-500 py-4">
          הכל מעובד! כל המחשבות סוכמו.
        </p>
      ) : (
        <ul className="space-y-1.5 flex-1 overflow-y-auto">
          {recent.map((t) => (
            <li key={t.id}>
              <Link
                to="/app/thoughts"
                className="block px-2 py-1.5 rounded-md hover:bg-ink-50 border border-transparent hover:border-ink-200 transition-colors"
              >
                <div className="text-xs font-medium text-ink-900 truncate">
                  {t.ai_generated_title ??
                    (t.text_content ?? "מחשבה").slice(0, 60)}
                </div>
                {t.text_content && (
                  <div className="text-[11px] text-ink-500 truncate">
                    {t.text_content.slice(0, 120)}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {count > recent.length && (
        <Link
          to="/app/thoughts"
          className="mt-2 text-[11px] text-primary-600 hover:underline text-center"
        >
          ועוד {count - recent.length} מחשבות...
        </Link>
      )}
    </div>
  );
}
