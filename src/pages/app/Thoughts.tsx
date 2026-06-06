import { useState } from "react";
import { Lightbulb, FlaskConical } from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { cn } from "@/lib/utils/cn";
import { QuickThoughtsTab } from "@/components/thoughts/QuickThoughtsTab";
import { ThoughtDevelopmentTab } from "@/components/thoughts/ThoughtDevelopmentTab";

type ThoughtsTab = "quick" | "development";
const TAB_KEY = "multitask:thoughts:tab";

export function Thoughts() {
  const [tab, setTab] = useState<ThoughtsTab>(() =>
    typeof window !== "undefined" &&
    window.localStorage.getItem(TAB_KEY) === "development"
      ? "development"
      : "quick"
  );
  const selectTab = (t: ThoughtsTab) => {
    setTab(t);
    if (typeof window !== "undefined") window.localStorage.setItem(TAB_KEY, t);
  };

  return (
    <ScreenScaffold title="מחשבות" subtitle="">
      <div className="space-y-3">
        {/* Sub-screen tabs */}
        <div className="flex items-center gap-1 border-b border-ink-200">
          <SubTab
            active={tab === "quick"}
            onClick={() => selectTab("quick")}
            icon={<Lightbulb className="w-4 h-4" />}
            label="מחשבה מהירה"
          />
          <SubTab
            active={tab === "development"}
            onClick={() => selectTab("development")}
            icon={<FlaskConical className="w-4 h-4" />}
            label="פיתוח מחשבה"
          />
        </div>

        {tab === "quick" ? <QuickThoughtsTab /> : <ThoughtDevelopmentTab />}
      </div>
    </ScreenScaffold>
  );
}

function SubTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium flex items-center gap-1.5 border-b-2 -mb-px transition-colors",
        active
          ? "border-primary-500 text-primary-700"
          : "border-transparent text-ink-500 hover:text-ink-800"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
