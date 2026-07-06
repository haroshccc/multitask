/**
 * Shared finance UI primitives: modal, icon maps, money display, division pill.
 */
import { useEffect, type ReactNode } from "react";
import {
  Wallet,
  Utensils,
  Car,
  Home,
  ShoppingCart,
  Music,
  Heart,
  Plane,
  Gift,
  GraduationCap,
  Dumbbell,
  Landmark,
  CreditCard,
  Banknote,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatMoney, TEXT_COLOR, type DivisionColor } from "@/lib/finance/calc";
import {
  REMAINDER_UNIT_META,
  type RemainderUnit,
  type AccountKind,
} from "@/lib/types/finance";

// ---- Icon maps ---------------------------------------------------------------

export const BUDGET_ICONS: Record<string, LucideIcon> = {
  wallet: Wallet,
  food: Utensils,
  car: Car,
  home: Home,
  shopping: ShoppingCart,
  music: Music,
  health: Heart,
  travel: Plane,
  gift: Gift,
  education: GraduationCap,
  sport: Dumbbell,
};

export const BUDGET_ICON_KEYS = Object.keys(BUDGET_ICONS);

export function BudgetIcon({ name, className }: { name: string; className?: string }) {
  const Icon = BUDGET_ICONS[name] ?? Wallet;
  return <Icon className={className} />;
}

const ACCOUNT_ICONS: Record<AccountKind, LucideIcon> = {
  bank: Landmark,
  credit: CreditCard,
  cash: Banknote,
};

export function AccountIcon({ kind, className }: { kind: AccountKind; className?: string }) {
  const Icon = ACCOUNT_ICONS[kind] ?? Landmark;
  return <Icon className={className} />;
}

export const BUDGET_COLORS = [
  "#f59e0b", "#ec4899", "#10b981", "#3b82f6", "#8b5cf6",
  "#ef4444", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

// ---- Money -------------------------------------------------------------------

export function Money({
  value,
  className,
  precise,
}: {
  value: number;
  className?: string;
  precise?: boolean;
}) {
  return (
    <span dir="ltr" className={cn("tabular-nums", className)}>
      {formatMoney(value, precise)}
    </span>
  );
}

// ---- Division pill (the 🔴/🟢 signal) ----------------------------------------

export function DivisionPill({
  unit,
  value,
  color,
}: {
  unit: RemainderUnit;
  value: number;
  color: DivisionColor;
}) {
  const meta = REMAINDER_UNIT_META[unit];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        color === "green" && "bg-success-50 text-success-700",
        color === "red" && "bg-danger-50 text-danger-700",
        color === "neutral" && "bg-ink-100 text-ink-700"
      )}
      title={`${meta.label} · בסיס`}
    >
      <Money value={value} precise />
      <span className="font-normal opacity-80">{meta.label}</span>
    </span>
  );
}

export { TEXT_COLOR };

// ---- Modal -------------------------------------------------------------------

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
  size,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  size?: "md" | "lg" | "xl";
}) {
  const resolved = size ?? (wide ? "lg" : "md");
  const widthClass =
    resolved === "xl" ? "max-w-4xl" : resolved === "lg" ? "max-w-2xl" : "max-w-md";
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-ink-900/40 p-4 overflow-y-auto"
      onMouseDown={onClose}
    >
      <div
        className={cn("card w-full my-8 sm:my-0 max-h-[90vh] overflow-y-auto", widthClass)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-ink-200 px-5 py-3.5">
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            <X className="w-4 h-4" />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-ink-200 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

// ---- Labeled field -----------------------------------------------------------

export function LabeledField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-400">{hint}</span>}
    </label>
  );
}
