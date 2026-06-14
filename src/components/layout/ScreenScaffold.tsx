import type { ReactNode } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ScreenScaffoldProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * When true, clamp the content to a comfortable reading width (~960px)
   * and center it. Use this on form-heavy pages (Settings / Admin /
   * Profile) where stretched-out fields look awkward. Work surfaces
   * (Tasks / Calendar / Gantt / Thoughts / Recordings / Projects) leave
   * this off and use the full viewport width.
   */
  narrow?: boolean;
  /**
   * Mobile-compact header. When an `icon` is supplied, the big title/subtitle
   * are hidden on mobile and replaced by a single tight row:
   *   [icon]  …  [actions]  [chrome-collapse toggle]
   * so the screen's real content starts right at the top. Desktop is
   * unchanged (full title header).
   */
  icon?: ReactNode;
  /** Show the chrome-collapse toggle in the mobile compact header. */
  chromeCollapsible?: boolean;
  chromeOpen?: boolean;
  onToggleChrome?: () => void;
  /** Dot on the toggle (e.g. active filters/hidden lists). */
  chromeIndicator?: boolean;
  /** Extra control(s) rendered in the mobile compact header row (before the
   *  page actions), e.g. a screen-specific toggle. */
  mobileExtra?: ReactNode;
}

export function ScreenScaffold({
  title,
  subtitle,
  actions,
  children,
  className,
  narrow,
  icon,
  chromeCollapsible,
  chromeOpen,
  onToggleChrome,
  chromeIndicator,
  mobileExtra,
}: ScreenScaffoldProps) {
  return (
    <div
      className={cn(
        "p-3 sm:p-5 md:p-6",
        narrow && "max-w-4xl mx-auto",
        className
      )}
      dir="rtl"
    >
      {/* Mobile compact header — only when the page opts in via `icon`. */}
      {icon && (
        <div className="flex md:hidden items-center gap-2 mb-2">
          <span
            className="w-9 h-9 rounded-xl bg-ink-100 text-ink-700 flex items-center justify-center shrink-0"
            aria-label={title}
            title={title}
          >
            {icon}
          </span>
          <div className="ms-auto flex items-center gap-1.5">
            {mobileExtra}
            {actions}
            {chromeCollapsible && (
              <button
                type="button"
                onClick={onToggleChrome}
                aria-expanded={chromeOpen}
                title="סינון ובקרות"
                className="relative inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-medium bg-ink-100 text-ink-700 hover:bg-ink-200"
              >
                <SlidersHorizontal className="w-4 h-4" />
                {chromeIndicator && (
                  <span className="absolute -top-0.5 -end-0.5 w-2 h-2 rounded-full bg-primary-500" />
                )}
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 transition-transform",
                    chromeOpen && "rotate-180"
                  )}
                />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Full header — desktop always; mobile only when no compact header. */}
      <header
        className={cn(
          "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 mb-4 sm:mb-5 text-start",
          icon && "hidden md:flex"
        )}
      >
        <div className="min-w-0 text-start">
          <h1 className="text-[22px] sm:text-2xl md:text-3xl font-bold text-ink-900 truncate text-start">{title}</h1>
          {subtitle && <p className="text-sm text-ink-500 mt-1 text-start">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function ComingSoon({ description }: { description: string }) {
  return (
    <div className="card p-6 sm:p-8 md:p-12 text-start" dir="rtl">
      <div className="text-5xl mb-4">🚧</div>
      <h2 className="text-xl font-semibold text-ink-900 mb-2">בבנייה</h2>
      <p className="text-ink-600 max-w-2xl leading-relaxed">{description}</p>
    </div>
  );
}
