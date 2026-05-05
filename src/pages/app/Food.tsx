import { useState } from "react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { cn } from "@/lib/utils/cn";
import { MealsTab } from "@/components/food/MealsTab";
import { IngredientsTab } from "@/components/food/IngredientsTab";
import { WeeklyMenuTab } from "@/components/food/WeeklyMenuTab";
import { TomorrowMenuBanner } from "@/components/food/TomorrowMenuBanner";

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

  const handleTabChange = (next: Tab) => {
    setTab(next);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <ScreenScaffold
      title="התנהלות אוכל"
      subtitle="ספריית מנות ומצרכים, תפריט שבועי, ובחירה לילית של תפריט המחר. משותף עם כל חברי הארגון."
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
    </ScreenScaffold>
  );
}
