import { useState } from "react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { cn } from "@/lib/utils/cn";
import {
  User,
  Building2,
  Bell,
  ListTodo,
  type LucideIcon,
} from "lucide-react";
import { StatusesSettings } from "@/components/settings/StatusesSettings";

type Tab = "statuses" | "profile" | "organization" | "notifications";

interface TabDef {
  key: Tab;
  label: string;
  icon: LucideIcon;
}

const TABS: TabDef[] = [
  { key: "statuses", label: "סטטוסים", icon: ListTodo },
  { key: "profile", label: "פרופיל", icon: User },
  { key: "organization", label: "ארגון", icon: Building2 },
  { key: "notifications", label: "התראות", icon: Bell },
];

export function Settings() {
  const [tab, setTab] = useState<Tab>("statuses");

  return (
    <ScreenScaffold
      title="הגדרות"
      subtitle="התאימי את הכלים שלך — סטטוסים, פרופיל, ארגון, והתראות."
    >
      <div className="grid grid-cols-1 md:grid-cols-[220px,1fr] gap-4">
        {/* Sidebar */}
        <nav className="card p-2 h-max">
          <ul className="space-y-0.5">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = t.key === tab;
              return (
                <li key={t.key}>
                  <button
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={cn(
                      "w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary-50 text-primary-800 font-medium"
                        : "text-ink-700 hover:bg-ink-100"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div>
          {tab === "statuses" && <StatusesSettings />}
          {tab === "profile" && <Placeholder text="פרופיל — בקרוב" />}
          {tab === "organization" && <Placeholder text="ארגון — בקרוב" />}
          {tab === "notifications" && <Placeholder text="התראות — בקרוב" />}
        </div>
      </div>
    </ScreenScaffold>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="card p-6 text-center text-sm text-ink-500">{text}</div>
  );
}
