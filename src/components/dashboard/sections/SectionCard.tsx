import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface SectionCardProps {
  icon: ReactNode;
  title: string;
  /** Small count badge rendered right after the title. */
  badge?: ReactNode;
  /** Trailing action (usually a "see all" link) pushed to the end side. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Shared chrome for every section of the fixed home dashboard — one
 * header style (icon chip + bold title + optional badge/action) so the
 * page reads as a single designed surface rather than a pile of widgets.
 */
export function SectionCard({
  icon,
  title,
  badge,
  action,
  children,
  className,
}: SectionCardProps) {
  return (
    <section className={cn("card p-4 flex flex-col overflow-hidden", className)}>
      <header className="flex items-center gap-2 mb-3 shrink-0">
        <span
          className="w-7 h-7 rounded-lg bg-ink-50 border border-ink-100 flex items-center justify-center text-primary-600"
          aria-hidden="true"
        >
          {icon}
        </span>
        <h3 className="text-sm font-bold text-ink-900">{title}</h3>
        {badge}
        {action && <span className="ms-auto shrink-0">{action}</span>}
      </header>
      {children}
    </section>
  );
}

/** Round count badge used next to section titles. */
export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary-500 text-white text-[10px] font-bold inline-flex items-center justify-center tabular-nums">
      {count}
    </span>
  );
}
