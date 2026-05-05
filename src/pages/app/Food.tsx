import { useState } from "react";
import { UserPlus, ShoppingCart, ListChecks } from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { cn } from "@/lib/utils/cn";
import { MealsTab } from "@/components/food/MealsTab";
import { IngredientsTab } from "@/components/food/IngredientsTab";
import { WeeklyMenuTab } from "@/components/food/WeeklyMenuTab";
import { TomorrowMenuBanner } from "@/components/food/TomorrowMenuBanner";
import { ShareMenuModal } from "@/components/food/ShareMenuModal";
import { ShoppingListExportModal } from "@/components/food/ShoppingListExportModal";
import { MenuTaskExportModal } from "@/components/food/MenuTaskExportModal";

type Tab = "meals" | "ingredients" | "weekly";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "meals", label: "מנות" },
  { id: "ingredients", label: "מצרכים" },
  { id: "weekly", label: "תפריט שבועי" },
];

const STORAGE_KEY = "multitask.food.tab";

export function Food() {
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "meals";
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "ingredients" || stored === "weekly" ? stored : "meals";
  });
  const [ingredientsPanelOpen, setIngredientsPanelOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [taskExportOpen, setTaskExportOpen] = useState(false);

  const handleTabChange = (next: Tab) => {
    setTab(next);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <ScreenScaffold
      title="התנהלות אוכל"
      subtitle="ספריית מנות ומצרכים משותפת לבית, ותפריטים אישיים שאפשר לשתף עם משתמשים אחרים."
      actions={
        <span className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="btn-ghost text-sm gap-1.5"
            title="שיתוף תפריט"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">שיתוף</span>
          </button>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="btn-ghost text-sm gap-1.5"
            title="ייצוא רשימת קניות לוואטסאפ"
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline">לוואטסאפ</span>
          </button>
          <button
            type="button"
            onClick={() => setTaskExportOpen(true)}
            className="btn-dark text-sm gap-1.5"
            title="ייצוא למשימות (בישול / קניות)"
          >
            <ListChecks className="w-4 h-4" />
            <span className="hidden sm:inline">למשימות</span>
          </button>
        </span>
      }
    >
      <TomorrowMenuBanner />

      <div className="card overflow-visible mb-3 px-2 py-1.5">
        <nav className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabChange(t.id)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md transition-colors",
                tab === t.id
                  ? "bg-ink-900 text-white"
                  : "text-ink-700 hover:bg-ink-100"
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === "meals" && (
        <MealsTab
          ingredientsPanelOpen={ingredientsPanelOpen}
          onToggleIngredientsPanel={() => setIngredientsPanelOpen((v) => !v)}
        />
      )}
      {tab === "ingredients" && <IngredientsTab />}
      {tab === "weekly" && <WeeklyMenuTab />}

      <ShareMenuModal open={shareOpen} onClose={() => setShareOpen(false)} />
      <ShoppingListExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
      />
      <MenuTaskExportModal
        open={taskExportOpen}
        onClose={() => setTaskExportOpen(false)}
      />
    </ScreenScaffold>
  );
}
