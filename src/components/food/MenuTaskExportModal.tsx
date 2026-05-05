import { useMemo, useState, useEffect } from "react";
import { X, Check, ListChecks, ShoppingCart, ChefHat } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useMealPlanTemplate,
  useMealPlanDays,
  useMeals,
  useIngredients,
  useIngredientCategories,
} from "@/lib/hooks/useFood";
import { useFoodPeople, PersonAvatar } from "@/lib/food/people";
import { useTaskLists } from "@/lib/hooks/useTaskLists";
import { useCreateTask } from "@/lib/hooks/useTasks";
import {
  buildCookingTaskPayloads,
  buildShoppingTaskPayload,
} from "@/lib/food/task-export";

interface MenuTaskExportModalProps {
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

type Mode = "cooking" | "shopping" | "both";

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function presetRange(preset: RangePreset): { from: string; to: string } {
  const t = new Date();
  const tom = new Date(t);
  tom.setDate(t.getDate() + 1);
  if (preset === "tomorrow") return { from: isoDate(tom), to: isoDate(tom) };
  if (preset === "rest_of_week") {
    const end = new Date(tom);
    while (end.getDay() !== 6) end.setDate(end.getDate() + 1);
    return { from: isoDate(tom), to: isoDate(end) };
  }
  if (preset === "next_7") {
    const end = new Date(tom);
    end.setDate(tom.getDate() + 6);
    return { from: isoDate(tom), to: isoDate(end) };
  }
  return { from: isoDate(tom), to: isoDate(tom) };
}

/**
 * Modal that turns a chunk of the meal plan into actual tasks in the
 * tasks system. Two flavours, choosable via a mode pill:
 *
 *   • "בישול" — one task per scheduled meal, with default time
 *     (breakfast 08:00 / lunch 13:00 / dinner 19:00 / between 11:00 /
 *     snack 16:00) and the meal's ingredients in the description.
 *
 *   • "קניות" — a single task with the WhatsApp-style shopping list
 *     in its description, scheduled to whenever the user picks.
 *
 *   • "שניהם" — both at once.
 *
 * The user picks a destination task list (or "ללא רשימה"), the people
 * to include, and the date range.
 */
export function MenuTaskExportModal({ open, onClose }: MenuTaskExportModalProps) {
  const { people, me } = useFoodPeople();
  const { data: lists = [] } = useTaskLists();
  const { data: template = [] } = useMealPlanTemplate();
  const { data: meals = [] } = useMeals();
  const { data: ingredients = [] } = useIngredients();
  const { data: ingredientCategories = [] } = useIngredientCategories();
  const createTask = useCreateTask();

  const [mode, setMode] = useState<Mode>("both");
  const [taskListId, setTaskListId] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
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
  const [shoppingScheduledAt, setShoppingScheduledAt] = useState<string>(() => {
    const t = new Date();
    return isoDate(t);
  });
  const [running, setRunning] = useState(false);
  const [doneSummary, setDoneSummary] = useState<string | null>(null);

  // Reset selections each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setSelectedUsers(new Set(people.map((p) => p.userId)));
    setDoneSummary(null);
  }, [open, people]);

  const range = useMemo(() => {
    if (preset === "custom") return { from: customFrom, to: customTo };
    return presetRange(preset);
  }, [preset, customFrom, customTo]);

  const { data: dayRows = [] } = useMealPlanDays(range.from, range.to);

  const noPeople = selectedUsers.size === 0;

  // Estimate counts up-front so the action button reads clearly.
  const counts = useMemo(() => {
    if (!open || noPeople) return { cooking: 0, shopping: 0 };
    const cookingPayloads = buildCookingTaskPayloads({
      userIds: Array.from(selectedUsers),
      fromDate: range.from,
      toDate: range.to,
      template,
      dayRows,
      meals,
      ingredients,
      taskListId,
    });
    return {
      cooking: cookingPayloads.length,
      // Shopping is always 1 task when it runs (or 0 if there are no
      // ingredients across the range — we still create the task with an
      // empty body, which is cheap; user can delete it).
      shopping: 1,
    };
  }, [
    open,
    noPeople,
    selectedUsers,
    range,
    template,
    dayRows,
    meals,
    ingredients,
    taskListId,
  ]);

  if (!open) return null;

  const togglePerson = (uid: string) => {
    setSelectedUsers((s) => {
      const next = new Set(s);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleRun = async () => {
    if (running || noPeople) return;
    setRunning(true);
    setDoneSummary(null);
    try {
      let cookingCreated = 0;
      let shoppingCreated = 0;

      if (mode === "cooking" || mode === "both") {
        const payloads = buildCookingTaskPayloads({
          userIds: Array.from(selectedUsers),
          fromDate: range.from,
          toDate: range.to,
          template,
          dayRows,
          meals,
          ingredients,
          taskListId,
        });
        for (const p of payloads) {
          await createTask.mutateAsync(p);
          cookingCreated++;
        }
      }

      if (mode === "shopping" || mode === "both") {
        const shoppingDate = `${shoppingScheduledAt}T09:00:00`;
        const dt = new Date(shoppingDate);
        const payload = buildShoppingTaskPayload({
          userIds: Array.from(selectedUsers),
          fromDate: range.from,
          toDate: range.to,
          template,
          dayRows,
          meals,
          ingredients,
          ingredientCategories,
          scheduledAt: dt.toISOString(),
          taskListId,
        });
        await createTask.mutateAsync(payload);
        shoppingCreated++;
      }

      const parts: string[] = [];
      if (cookingCreated) parts.push(`${cookingCreated} משימות בישול`);
      if (shoppingCreated) parts.push(`${shoppingCreated} משימת קניות`);
      setDoneSummary(parts.length ? `נוצרו ${parts.join(" + ")}.` : "לא נוצרו משימות.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 p-4 border-b border-ink-100">
          <h2 className="text-lg font-semibold text-ink-900 flex items-center gap-2">
            <ListChecks className="w-5 h-5" />
            ייצוא למשימות
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
            <h3 className="text-xs font-medium text-ink-700 mb-2">איזה משימות לייצר?</h3>
            <div className="grid grid-cols-3 gap-1.5">
              <ModeChip
                active={mode === "cooking"}
                onClick={() => setMode("cooking")}
                icon={<ChefHat className="w-4 h-4" />}
                label="בישול"
                hint="משימה לכל ארוחה"
              />
              <ModeChip
                active={mode === "shopping"}
                onClick={() => setMode("shopping")}
                icon={<ShoppingCart className="w-4 h-4" />}
                label="קניות"
                hint="משימה אחת מצרפת"
              />
              <ModeChip
                active={mode === "both"}
                onClick={() => setMode("both")}
                icon={<ListChecks className="w-4 h-4" />}
                label="שניהם"
                hint="גם וגם"
              />
            </div>
          </section>

          <section>
            <h3 className="text-xs font-medium text-ink-700 mb-2">לכלול תפריט של:</h3>
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

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <h3 className="text-xs font-medium text-ink-700 mb-2">לאיזה רשימה?</h3>
              <select
                value={taskListId ?? ""}
                onChange={(e) => setTaskListId(e.target.value || null)}
                className="field text-sm"
              >
                <option value="">ללא רשימה (אינבוקס)</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            {(mode === "shopping" || mode === "both") && (
              <div>
                <h3 className="text-xs font-medium text-ink-700 mb-2">
                  מתי לקנות?
                </h3>
                <input
                  type="date"
                  value={shoppingScheduledAt}
                  onChange={(e) => setShoppingScheduledAt(e.target.value)}
                  className="field text-sm"
                />
              </div>
            )}
          </section>

          <section className="border border-ink-200 bg-ink-50/40 rounded-md p-3 text-xs text-ink-600 space-y-1">
            <div className="font-medium text-ink-900">מה ייווצר:</div>
            {(mode === "cooking" || mode === "both") && (
              <div>
                · <strong>{counts.cooking}</strong> משימות בישול
                {counts.cooking > 0 && (
                  <span className="text-ink-500">
                    {" "}— משימה לכל ארוחה, מתוזמנת אוטומטית לפי הזמן (בוקר 08:00,
                    צהריים 13:00, ערב 19:00).
                  </span>
                )}
              </div>
            )}
            {(mode === "shopping" || mode === "both") && (
              <div>
                · <strong>1</strong> משימת קניות מצרפת מכל המצרכים בטווח שבחרת.
              </div>
            )}
          </section>

          {doneSummary && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 px-3 py-2 text-sm">
              {doneSummary}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 p-4 border-t border-ink-100">
          <button type="button" onClick={onClose} className="btn-ghost">
            סגור
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={running || noPeople}
            className="btn-dark gap-1.5"
          >
            <ListChecks className="w-4 h-4" />
            {running ? "יוצר..." : "צור משימות"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ModeChip({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0.5 p-2 rounded-md border transition-colors text-center",
        active
          ? "bg-ink-900 text-white border-ink-900"
          : "bg-white border-ink-200 text-ink-700 hover:bg-ink-50"
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {label}
      </span>
      <span className={cn("text-[10px]", active ? "text-white/70" : "text-ink-500")}>
        {hint}
      </span>
    </button>
  );
}
