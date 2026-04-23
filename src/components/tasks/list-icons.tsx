import {
  ClipboardList,
  Home,
  ShoppingCart,
  BookOpen,
  Dumbbell,
  CalendarCheck,
  Lightbulb,
  Film,
  Sparkles,
  FolderKanban,
  Stethoscope,
  Wallet,
  Sprout,
  PawPrint,
  Luggage,
  ChefHat,
  Gift,
  MessageCircle,
  Palette,
  Wrench,
  Inbox,
  type LucideIcon,
} from "lucide-react";

/**
 * We store the choice in `task_lists.emoji` as a string that starts with
 * "icon:<key>" when the user picks from this palette. Legacy or custom values
 * (regular emoji characters) are rendered as-is. This lets us keep the DB
 * column shape while moving the visuals to Lucide line icons that match the
 * rest of the app's aesthetic.
 */

export interface ListIconPreset {
  key: string;       // stored as `icon:${key}` in task_lists.emoji
  icon: LucideIcon;
  label: string;     // Hebrew tooltip
}

export const LIST_ICON_PRESETS: ListIconPreset[] = [
  { key: "work",           icon: ClipboardList,   label: "עבודה" },
  { key: "home",           icon: Home,            label: "בית" },
  { key: "shopping",       icon: ShoppingCart,    label: "קניות" },
  { key: "study",          icon: BookOpen,        label: "לימודים" },
  { key: "fitness",        icon: Dumbbell,        label: "כושר" },
  { key: "appointments",   icon: CalendarCheck,   label: "פגישות" },
  { key: "ideas",          icon: Lightbulb,       label: "רעיונות" },
  { key: "leisure",        icon: Film,            label: "פנאי" },
  { key: "personal-care",  icon: Sparkles,        label: "טיפוח" },
  { key: "projects",       icon: FolderKanban,    label: "פרויקטים" },
  { key: "health",         icon: Stethoscope,     label: "בריאות" },
  { key: "finance",        icon: Wallet,          label: "כספים" },
  { key: "garden",         icon: Sprout,          label: "גינה" },
  { key: "pets",           icon: PawPrint,        label: "חיות" },
  { key: "travel",         icon: Luggage,         label: "נסיעות" },
  { key: "cooking",        icon: ChefHat,         label: "בישול" },
  { key: "holidays",       icon: Gift,            label: "חגים" },
  { key: "communication",  icon: MessageCircle,   label: "תקשורת" },
  { key: "creation",       icon: Palette,         label: "יצירה" },
  { key: "repairs",        icon: Wrench,          label: "תיקונים" },
];

const BY_KEY: Record<string, ListIconPreset> = Object.fromEntries(
  LIST_ICON_PRESETS.map((p) => [p.key, p])
);

export const INBOX_ICON = Inbox;

export interface ListIconProps {
  /** The value from task_lists.emoji — may be "icon:key", an emoji char, or null */
  emoji: string | null | undefined;
  /** Fallback icon when the stored value is empty */
  fallback?: LucideIcon;
  className?: string;
}

export function ListIcon({ emoji, fallback, className = "w-4 h-4" }: ListIconProps) {
  if (emoji && emoji.startsWith("icon:")) {
    const key = emoji.slice(5);
    const preset = BY_KEY[key];
    if (preset) {
      const Icon = preset.icon;
      return <Icon className={className} strokeWidth={1.75} />;
    }
  }
  if (emoji && emoji.length > 0) {
    // Legacy: raw emoji character stored directly.
    return <span className="text-base leading-none">{emoji}</span>;
  }
  if (fallback) {
    const F = fallback;
    return <F className={className} strokeWidth={1.75} />;
  }
  return null;
}
