import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface ScreenScaffoldProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ScreenScaffold({
  title,
  subtitle,
  actions,
  children,
  className,
}: ScreenScaffoldProps) {
  return (
    <div className={cn("p-4 md:p-6 max-w-7xl mx-auto", className)}>
      <header className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-ink-900 truncate">{title}</h1>
          {subtitle && <p className="text-sm text-ink-500 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function ComingSoon({ description }: { description: string }) {
  return (
    <div className="card p-8 md:p-12 text-center">
      <div className="text-5xl mb-4">🚧</div>
      <h2 className="text-xl font-semibold text-ink-900 mb-2">בבנייה</h2>
      <p className="text-ink-600 max-w-md mx-auto leading-relaxed">{description}</p>
    </div>
  );
}
