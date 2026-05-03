import { useMemo, useState } from "react";
import {
  Sparkles,
  RefreshCw,
  Users,
  Mic,
  Clock,
  Lightbulb,
  CheckCircle2,
  Pencil,
  ExternalLink,
  Loader2,
  AlertTriangle,
  TrendingUp,
  Compass,
  CalendarDays,
} from "lucide-react";
import { useDashboardRange } from "../dashboard-context";
import { useDailyBrief, useGenerateDailyBrief } from "@/lib/hooks/useDailyBrief";
import { ApplyProposalCard } from "./BriefProposalCard";
import { cn } from "@/lib/utils/cn";
import type { BriefRecommendation, DailyBrief } from "@/lib/types/domain";

const VIEW_LABEL: Record<string, string> = {
  day: "היום",
  week: "השבוע",
  month: "החודש",
};

const CATEGORY_ICON: Record<BriefRecommendation["category"], typeof Lightbulb> = {
  time: Clock,
  tasks: CheckCircle2,
  meetings: Users,
  general: Lightbulb,
  efficiency: TrendingUp,
  planning: CalendarDays,
};

const CATEGORY_TONE: Record<BriefRecommendation["category"], string> = {
  time: "bg-primary-50 text-primary-700 border-primary-200",
  tasks: "bg-emerald-50 text-emerald-700 border-emerald-200",
  meetings: "bg-violet-50 text-violet-700 border-violet-200",
  general: "bg-amber-50 text-amber-700 border-amber-200",
  efficiency: "bg-cyan-50 text-cyan-700 border-cyan-200",
  planning: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

/**
 * AI-generated daily/weekly/monthly brief — Phase 8.2 (read-only) + 8.3 (proposals).
 *
 * UX states (in order):
 *   1. No brief yet      → big "צרי סיכום" CTA. One-click generates.
 *   2. Generating        → spinner + "AI חושב…".
 *   3. Brief ready       → headline → summary → people → recordings → insight
 *                          → recommendations → proposals (each approve/dismiss/edit).
 *   4. Refreshing        → soft loading state on top of stale content.
 *   5. Error             → red banner with retry.
 *
 * Cost discipline: Phase 8.2 is cache-first. The widget never auto-regenerates;
 * the user has to click "🔄 רענן" for a fresh AI call.
 */
export function BriefBanner() {
  const range = useDashboardRange();
  const briefQuery = useDailyBrief({ view: range.view, anchor: range.anchor });
  const generate = useGenerateDailyBrief({
    view: range.view,
    anchor: range.anchor,
    from: range.range.from,
    to: range.range.to,
  });

  const brief = briefQuery.data ?? null;
  const isLoading = briefQuery.isLoading;
  const isGenerating = generate.isPending;
  const error = generate.error;

  // For 8.3: hide proposals that have been decided.
  const visibleProposals = useMemo(() => {
    if (!brief) return [];
    return brief.proposals.filter(
      (p) => !brief.proposal_decisions[p.id]
    );
  }, [brief]);

  return (
    <div className="card p-4 h-full flex flex-col overflow-hidden">
      <header className="flex items-center gap-2 shrink-0 mb-3">
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gradient-to-r from-violet-100 to-primary-100 text-violet-800 text-[11px] font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          סיכום AI {VIEW_LABEL[range.view]}
        </div>
        <span className="text-[11px] text-ink-500 truncate min-w-0">
          {range.label}
        </span>
        <div className="ms-auto flex items-center gap-2 shrink-0">
          {brief?.generated_at && (
            <span className="text-[10px] text-ink-400 tabular-nums">
              עודכן {fmtAgo(brief.generated_at)}
            </span>
          )}
          <button
            type="button"
            onClick={() => generate.mutate({ force: !!brief })}
            disabled={isGenerating || isLoading}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium",
              "border border-ink-200 text-ink-700 bg-white hover:bg-ink-50",
              "disabled:opacity-50 disabled:cursor-wait"
            )}
            title={brief ? "רענן סיכום (קריאת AI חדשה)" : "צרי סיכום AI"}
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {brief ? "רענן" : "צרי סיכום"}
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-auto pe-1 scrollbar-thin">
        {error && (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-800 flex-1 min-w-0">
              <div className="font-semibold">לא הצלחנו ליצור סיכום</div>
              <div className="opacity-80 break-words">
                {String(error.message ?? error)}
              </div>
            </div>
          </div>
        )}

        {!brief && !isLoading && !isGenerating && !error && (
          <EmptyState onGenerate={() => generate.mutate()} />
        )}

        {(isLoading || (isGenerating && !brief)) && <SkeletonState />}

        {brief && (
          <BriefContent
            brief={brief}
            visibleProposalsCount={visibleProposals.length}
          />
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Empty state — first time on this period.

function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-6 gap-3">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-200 to-primary-200 flex items-center justify-center">
        <Sparkles className="w-5 h-5 text-violet-700" />
      </div>
      <div>
        <h3 className="font-semibold text-ink-900 mb-1">סיכום AI לתקופה</h3>
        <p className="text-xs text-ink-600 max-w-md leading-relaxed">
          AI יקרא את המשימות, האירועים, ההקלטות והמחשבות שלך, וייתן סיכום של
          התקופה: מה היה, עם מי דיברת, באילו שעות היית הכי יעילה, והמלצות
          לתקופה הבאה. בסוף — גם הצעות פעולה שאת מאשרת ידנית.
        </p>
      </div>
      <button
        type="button"
        onClick={onGenerate}
        className="btn-primary text-xs"
      >
        <Sparkles className="w-3.5 h-3.5" />
        צרי סיכום AI
      </button>
      <p className="text-[10px] text-ink-400">קריאה אחת ≈ 2-5 אגורות</p>
    </div>
  );
}

function SkeletonState() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-ink-100 rounded w-3/4" />
      <div className="space-y-1.5">
        <div className="h-3 bg-ink-100 rounded w-full" />
        <div className="h-3 bg-ink-100 rounded w-11/12" />
        <div className="h-3 bg-ink-100 rounded w-4/5" />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4">
        <div className="h-16 bg-ink-100 rounded-lg" />
        <div className="h-16 bg-ink-100 rounded-lg" />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main content blocks.

function BriefContent({
  brief,
  visibleProposalsCount,
}: {
  brief: DailyBrief;
  visibleProposalsCount: number;
}) {
  const { output, proposals, proposal_decisions } = brief;
  const [showDismissed, setShowDismissed] = useState(false);
  const dismissedCount = Object.values(proposal_decisions).filter(
    (d) => d.state !== "approved"
  ).length;

  return (
    <div className="space-y-4">
      {/* Headline + summary */}
      {(output.headline || output.summary) && (
        <section>
          {output.headline && (
            <p className="text-base font-semibold text-ink-900 leading-snug mb-1">
              {output.headline}
            </p>
          )}
          {output.summary && (
            <p className="text-sm text-ink-700 leading-relaxed">
              {output.summary}
            </p>
          )}
        </section>
      )}

      {/* People summary */}
      {output.people_summary.length > 0 && (
        <section>
          <SectionHeader icon={Users} label="עם מי דיברת" />
          <div className="space-y-1.5">
            {output.people_summary.map((p, i) => (
              <div
                key={i}
                className="rounded-lg border border-ink-200 bg-white p-2.5"
              >
                <div className="text-xs font-semibold text-ink-900">
                  {p.person}
                </div>
                <div className="text-xs text-ink-700 mt-0.5 leading-relaxed">
                  {p.context}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recordings digest */}
      {output.recordings_digest && (
        <section>
          <SectionHeader icon={Mic} label="הקלטות" />
          <p className="text-xs text-ink-700 leading-relaxed bg-ink-50/60 rounded-lg p-2.5 border border-ink-100">
            {output.recordings_digest}
          </p>
        </section>
      )}

      {/* Productive hours */}
      {output.productive_hours_insight && (
        <section>
          <SectionHeader icon={Clock} label="שעות יעילות" />
          <p className="text-xs text-ink-700 leading-relaxed">
            {output.productive_hours_insight}
          </p>
        </section>
      )}

      {/* Forward outlook (Phase 8.2.1) — what's coming + how to prepare */}
      {output.forward_outlook && (
        <section>
          <SectionHeader icon={Compass} label="מה צפוי קדימה" />
          <p className="text-xs text-ink-800 leading-relaxed bg-gradient-to-l from-indigo-50/60 to-cyan-50/60 rounded-lg p-2.5 border border-indigo-100">
            {output.forward_outlook}
          </p>
        </section>
      )}

      {/* Recommendations */}
      {output.recommendations.length > 0 && (
        <section>
          <SectionHeader icon={Lightbulb} label="המלצות" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {output.recommendations.map((rec, i) => {
              const Icon = CATEGORY_ICON[rec.category] ?? Lightbulb;
              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg border p-2.5 flex gap-2 items-start",
                    CATEGORY_TONE[rec.category] ?? CATEGORY_TONE.general
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold leading-tight">
                      {rec.title}
                    </div>
                    <div className="text-[11px] mt-0.5 leading-relaxed opacity-90">
                      {rec.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Proposals (Phase 8.3) */}
      {proposals.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <SectionHeader icon={Pencil} label="הצעות פעולה" inline />
            <span className="text-[10px] text-ink-500">
              {visibleProposalsCount} ממתינות · {dismissedCount} טופלו
            </span>
          </div>
          <div className="space-y-2">
            {proposals
              .filter(
                (p) =>
                  !brief.proposal_decisions[p.id] ||
                  (showDismissed &&
                    brief.proposal_decisions[p.id]?.state !== "approved")
              )
              .map((p) => (
                <ApplyProposalCard
                  key={p.id}
                  proposal={p}
                  brief={brief}
                  decision={brief.proposal_decisions[p.id]}
                />
              ))}
          </div>
          {dismissedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowDismissed((v) => !v)}
              className="mt-2 text-[10px] text-ink-500 hover:text-ink-700"
            >
              {showDismissed ? "הסתר טופלו" : "הראה טופלו"}
            </button>
          )}
        </section>
      )}

      {/* Soft footer with origin disclosure */}
      <div className="text-[10px] text-ink-400 flex items-center gap-1">
        <ExternalLink className="w-3 h-3" />
        AI לא מבצע פעולות לבד — כל שינוי דורש אישור שלך.
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  label,
  inline,
}: {
  icon: typeof Lightbulb;
  label: string;
  inline?: boolean;
}) {
  return (
    <h4
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500",
        !inline && "mb-1.5"
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </h4>
  );
}

// -----------------------------------------------------------------------------
// Tiny "X minutes ago" formatter — Hebrew.

function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "עכשיו";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `לפני ${m} ד'`;
  const h = Math.floor(m / 60);
  if (h < 24) return `לפני ${h} שע'`;
  const d = Math.floor(h / 24);
  return `לפני ${d} ימים`;
}

export { ApplyProposalCard } from "./BriefProposalCard";
