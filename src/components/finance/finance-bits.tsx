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
  Coffee,
  Pizza,
  Fuel,
  Bus,
  TrainFront,
  PawPrint,
  Smartphone,
  Wifi,
  Tv,
  Gamepad2,
  BookOpen,
  Shirt,
  Scissors,
  Stethoscope,
  Pill,
  Briefcase,
  Building2,
  PiggyBank,
  Coins,
  Receipt,
  ShoppingBag,
  Flower2,
  TreePine,
  Umbrella,
  Hotel,
  Camera,
  Clapperboard,
  Palette,
  Bike,
  Wrench,
  Zap,
  Droplet,
  Flame,
  Glasses,
  Cake,
  PartyPopper,
  Ticket,
  Laptop,
  Wine,
  Baby,
  Star,
  Leaf,
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
  restaurant: Pizza,
  coffee: Coffee,
  wine: Wine,
  car: Car,
  fuel: Fuel,
  bus: Bus,
  train: TrainFront,
  bike: Bike,
  travel: Plane,
  vacation: Umbrella,
  hotel: Hotel,
  home: Home,
  building: Building2,
  electricity: Zap,
  water: Droplet,
  gas: Flame,
  bills: Receipt,
  shopping: ShoppingCart,
  bag: ShoppingBag,
  clothes: Shirt,
  beauty: Scissors,
  glasses: Glasses,
  health: Heart,
  medical: Stethoscope,
  pharmacy: Pill,
  sport: Dumbbell,
  music: Music,
  games: Gamepad2,
  movies: Clapperboard,
  tv: Tv,
  camera: Camera,
  art: Palette,
  books: BookOpen,
  education: GraduationCap,
  work: Briefcase,
  laptop: Laptop,
  phone: Smartphone,
  internet: Wifi,
  gift: Gift,
  cake: Cake,
  party: PartyPopper,
  tickets: Ticket,
  kids: Baby,
  pets: PawPrint,
  garden: Flower2,
  nature: TreePine,
  leaf: Leaf,
  tools: Wrench,
  savings: PiggyBank,
  coins: Coins,
  star: Star,
};

export const BUDGET_ICON_KEYS = Object.keys(BUDGET_ICONS);

/** Hebrew labels for the icon dropdowns. */
export const BUDGET_ICON_LABELS: Record<string, string> = {
  wallet: "ארנק",
  food: "אוכל",
  restaurant: "מסעדות",
  coffee: "קפה",
  wine: "אלכוהול",
  car: "רכב",
  fuel: "דלק",
  bus: "תחבורה",
  train: "רכבת",
  bike: "אופניים",
  travel: "טיסות",
  vacation: "חופשה",
  hotel: "מלונות",
  home: "בית",
  building: "נדל״ן",
  electricity: "חשמל",
  water: "מים",
  gas: "גז",
  bills: "חשבונות",
  shopping: "קניות",
  bag: "קניות (תיק)",
  clothes: "ביגוד",
  beauty: "טיפוח",
  glasses: "משקפיים",
  health: "בריאות",
  medical: "רפואה",
  pharmacy: "תרופות",
  sport: "ספורט",
  music: "מוזיקה",
  games: "משחקים",
  movies: "סרטים",
  tv: "טלוויזיה",
  camera: "צילום",
  art: "אומנות",
  books: "ספרים",
  education: "לימודים",
  work: "עבודה",
  laptop: "מחשב",
  phone: "טלפון",
  internet: "אינטרנט",
  gift: "מתנות",
  cake: "ימי הולדת",
  party: "אירועים",
  tickets: "כרטיסים",
  kids: "ילדים",
  pets: "חיות מחמד",
  garden: "גינה",
  nature: "טבע",
  leaf: "טבעוני",
  tools: "כלים",
  savings: "חיסכון",
  coins: "מטבעות",
  star: "כללי",
};

export function budgetIconLabel(key: string): string {
  return BUDGET_ICON_LABELS[key] ?? key;
}

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
  "#f59e0b", "#f97316", "#ef4444", "#e11d48", "#ec4899",
  "#d946ef", "#a855f7", "#8b5cf6", "#6366f1", "#3b82f6",
  "#0ea5e9", "#06b6d4", "#14b8a6", "#10b981", "#22c55e",
  "#84cc16", "#eab308", "#f43f5e", "#78716c", "#64748b",
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
