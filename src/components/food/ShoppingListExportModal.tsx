import { useMemo, useState, useEffect } from "react";
import { X, Check, MessageCircle, Copy, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useMealPlanTemplate,
  useMealPlanDays,
  useMeals,
  useIngredients,
  useIngredientCategories,
} from "@/lib/hooks/useFood";
import { useFoodPeople, PersonAvatar } from "@/lib/food/people";
import {
  buildShoppingList,
  shoppingListToWhatsAppText,
  whatsAppShareUrl,
} from "@/lib/food/shopping-list";

interface ShoppingListExportModalProps {
  open: boolean;
  onClose: () => void;
}

const RANGE_PRESETS = [
  { id: "tomorrow", label: "מחר" },
  { id: "rest_of_week", label: "עד סוף השבוע" },
  { id: "next_7", label: "7 ימים קדימה" },
  { id: "custom", label: "טווח מותאם" },
] as const;
type RangePreset = (typeof RANGE_PRESETS)[number]["id"];

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function presetRange(preset: RangePreset): { from: string; to: string } {
  const t = new Date();
  if (preset === "tomorrow") {
    const tom = new Date(t);
    tom.setDate(t.getDate() + 1);
    return { from: isoDate(tom), to: isoDate(tom) };
  }
  if (preset === "rest_of_week") {
    const tom = new Date(t);
    tom.setDate(t.getDate() + 1);
    // End of week = next Saturday (Hebrew week ends Saturday in JS getDay() === 6)
    const end = new Date(tom);
    while (end.getDay() !== 6) end.setDate(end.getDate() + 1);
    return { from: isoDate(tom), to: isoDate(end) };
  }
  if (preset === "next_7") {
    const tom = new Date(t);
    tom.setDate(t.getDate() + 1);
    const end = new Date(tom);
    end.setDate(tom.getDate() + 6);
    return { from: isoDate(tom), to: isoDate(end) };
  }
  // custom — caller picks
  const tom = new Date(t);
  tom.setDate(t.getDate() + 1);
  return { from: isoDate(tom), to: isoDate(tom) };
}

/**
 * Modal that lets you choose:
 *   1. Whose plans to include (you + anyone who shared with you).
 *   2. A date range — preset or custom.
 *
 * Then it aggregates all needed ingredients across the selected plans,
 * groups them by ingredient_category, formats as a Hebrew WhatsApp
 * message, and offers two outputs: a "פתח בוואטסאפ" deep-link and a
 * "העתק טקסט" copy button (for non-WA users).
 */
export function ShoppingListExportModal({
  open,
  onClose,
}: ShoppingListExportModalProps) {
  const { people, me } = useFoodPeople();

  // Selected user_ids — defaults to all visible people (most useful default
  // for the "we shop together for the whole house" use case).
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!open) return;
    setSelectedUsers(new Set(people.map((p) => p.userId)));
  }, [open, people]);

  const [preset, setPreset] = useState<RangePreset>("rest_of_week");
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return isoDate(t);
  });
  const [customTo, setCustomTo] = useState<string>(() => {
    const t = new Date();
    t.setDate(t.getDate() + 7);
    return isoDate(t);
  });

  const range = useMemo(() => {
    if (preset === "custom") return { from: customFrom, to: customTo };
    return presetRange(preset);
  }, [preset, customFrom, customTo]);

  const { data: template = [] } = useMealPlanTemplate();
  const { data: dayRows = [] } = useMealPlanDays(range.from, range.to);
  const { data: meals = [] } = useMeals();
  const { data: ingredients = [] } = useIngredients();
  const { data: ingredientCategories = [] } = useIngredientCategories();

  const result = useMemo(() => {
    if (!open) return null;
    return buildShoppingList({
      userIds: Array.from(selectedUsers),
      fromDate: range.from,
      toDate: range.to,
      template,
      dayRows,
      meals,
      ingredients,
      ingredientCategories,
    });
  }, [
    open,
    selectedUsers,
    range,
    template,
    dayRows,
    meals,
    ingredients,
    ingredientCategories,
  ]);

  const text = useMemo(
    () =>
      result ? shoppingListToWhatsAppText(result, range.from, range.to) : "",
    [result, range]
  );

  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail outside HTTPS / on older browsers — silent
      // fallback is fine since the textarea below stays selectable.
    }
  };

  if (!open) return null;

  const togglePerson = (uid: string) => {
    setSelectedUsers((s) => {
      const next = new Set(s);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const noPeople = selectedUsers.size === 0;
  const noResult = result && result.totalLines === 0;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 p-4 border-b border-ink-100">
          <h2 className="text-lg font-semibold text-ink-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            רשימת קניות לוואטסאפ
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <section>
            <h3 className="text-xs font-medium text-ink-700 mb-2">
              לכלול מי?
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              {people.map((p) => {
                const sel = selectedUsers.has(p.userId);
                return (
                  <button
                    key={p.userId}
                    type="button"
                    onClick={() => togglePerson(p.userId)}
                    className={cn(
                      "inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-sm border transition-colors",
                      sel
                        ? `${p.color.bg} ${p.color.border} ${p.color.text} font-medium`
                        : "bg-white border-ink-200 text-ink-500 hover:bg-ink-50"
                    )}
                  >
                    <PersonAvatar person={p} size="xs" />
                    <span>{p.userId === me?.userId ? "אני" : p.displayName}</span>
                    {sel && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-medium text-ink-700 mb-2">לאיזה טווח?</h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              {RANGE_PRESETS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setPreset(r.id)}
                  className={cn(
                    "px-3 py-1 rounded-md text-sm border",
                    preset === r.id
                      ? "bg-ink-900 text-white border-ink-900"
                      : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="field text-sm py-1.5 w-auto"
                />
                <span className="text-xs text-ink-500">עד</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="field text-sm py-1.5 w-auto"
                />
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-ink-700">תצוגה מקדימה</h3>
              {result && (
                <span className="text-[10px] text-ink-400">
                  {result.totalLines} מצרכים · {result.slotsCovered} ארוחות
                </span>
              )}
            </div>
            {noPeople ? (
              <div className="text-sm text-ink-400 px-3 py-3 border border-dashed border-ink-200 rounded-md text-center">
                בחרי לפחות אדם אחד.
              </div>
            ) : noResult ? (
              <div className="text-sm text-ink-400 px-3 py-3 border border-dashed border-ink-200 rounded-md text-center">
                אין ארוחות מתוכננות בטווח שנבחר. ודאי שיש לך תפריט שבועי או
                בחירות יומיות.
              </div>
            ) : (
              <textarea
                readOnly
                value={text}
                rows={10}
                className="field text-sm font-mono whitespace-pre-wrap"
                onClick={(e) => (e.currentTarget as HTMLTextAreaElement).select()}
              />
            )}
          </section>
        </div>

        <footer className="flex items-center justify-end gap-2 p-4 border-t border-ink-100">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!text || noPeople || noResult || false}
            className="btn-ghost text-sm gap-1.5"
          >
            <Copy className="w-4 h-4" />
            {copied ? "הועתק!" : "העתק טקסט"}
          </button>
          <a
            href={text ? whatsAppShareUrl(text) : "#"}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "btn-dark text-sm gap-1.5",
              (!text || noPeople || noResult) &&
                "pointer-events-none opacity-40"
            )}
          >
            <MessageCircle className="w-4 h-4" />
            פתח בוואטסאפ
          </a>
        </footer>
      </div>
    </div>
  );
}
