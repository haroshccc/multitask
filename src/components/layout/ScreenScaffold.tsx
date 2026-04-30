import type { ReactNode } from "react";
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
}

export function ScreenScaffold({
  title,
  subtitle,
  actions,
  children,
  className,
  narrow,
}: ScreenScaffoldProps) {
  return (
    <div
      className={cn(
        "p-4 sm:p-5 md:p-6",
        narrow && "max-w-4xl mx-auto",
        className
      )}
      dir="rtl"
    >
      <header className="flex items-start justify-between gap-4 mb-5 text-start">
        <div className="min-w-0 text-start">
          <h1 className="text-[22px] sm:text-2xl md:text-3xl font-bold text-ink-900 truncate text-start">{title}</h1>
          {subtitle && <p className="text-sm text-ink-500 mt-1 text-start">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
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
