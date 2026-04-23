import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Home,
  CheckSquare,
  Calendar as CalendarIcon,
  BarChart3,
  Mic,
  Lightbulb,
  FolderKanban,
  Settings as SettingsIcon,
  Shield,
  LogOut,
  Plus,
  Search,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/utils/cn";
import { QuickCapture } from "@/components/capture/QuickCapture";
import { ActiveTimerPill } from "@/components/tasks/ActiveTimerPill";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { Logo } from "@/components/brand/Logo";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: "/app", label: "דשבורד", icon: Home, end: true },
  { to: "/app/tasks", label: "משימות", icon: CheckSquare },
  { to: "/app/calendar", label: "יומן", icon: CalendarIcon },
  { to: "/app/gantt", label: "Gantt", icon: BarChart3 },
  { to: "/app/recordings", label: "הקלטות", icon: Mic },
  { to: "/app/thoughts", label: "מחשבות", icon: Lightbulb },
  { to: "/app/projects", label: "פרויקטים", icon: FolderKanban },
];

export function AppShell() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-ink-50 flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-ink-200 px-4 md:px-6 h-14 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="md:hidden p-2 rounded-xl hover:bg-ink-100"
            aria-label="פתח תפריט"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Logo markSize={28} className="min-w-0" idKey="shellLogo" />
        </div>

        {/* Horizontal nav (desktop) */}
        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center max-w-2xl mx-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-colors",
                  isActive
                    ? "bg-ink-900 text-white"
                    : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
                )
              }
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-xl hover:bg-ink-100"
            aria-label="חיפוש (⌘K)"
            title="חיפוש (⌘K)"
          >
            <Search className="w-5 h-5 text-ink-600" />
          </button>
          <NotificationsBell />
          <button
            onClick={() => setCaptureOpen(true)}
            className="p-2 rounded-xl bg-primary-500 text-white hover:bg-primary-600"
            aria-label="יצירה מהירה"
          >
            <Plus className="w-5 h-5" />
          </button>
          <div className="hidden md:flex items-center gap-2 ps-3 border-s border-ink-200 ms-2">
            <button
              className="w-8 h-8 rounded-xl bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-sm font-medium text-ink-700"
              aria-label="פרופיל"
            >
              {(profile?.full_name?.[0] ?? "?").toUpperCase()}
            </button>
            {profile?.is_super_admin && (
              <NavLink
                to="/app/admin"
                className={({ isActive }) =>
                  cn(
                    "p-2 rounded-xl",
                    isActive ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100"
                  )
                }
                title="ניהול מערכת"
              >
                <Shield className="w-4 h-4" />
              </NavLink>
            )}
            <button
              onClick={handleSignOut}
              className="p-2 rounded-xl text-ink-600 hover:bg-ink-100"
              aria-label="יציאה"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Body: sidebar (mobile drawer / desktop rail) + main */}
      <div className="flex-1 flex">
        {/* Mobile drawer */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-ink-900/40"
            onClick={() => setSidebarOpen(false)}
          >
            <aside
              className="absolute top-14 end-0 bottom-0 w-64 bg-white border-s border-ink-200 shadow-lift p-3 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <nav className="flex flex-col gap-1">
                {NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm",
                        isActive
                          ? "bg-ink-900 text-white"
                          : "text-ink-700 hover:bg-ink-100"
                      )
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
                <div className="h-px bg-ink-200 my-2" />
                <NavLink
                  to="/app/settings"
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm",
                      isActive ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-ink-100"
                    )
                  }
                >
                  <SettingsIcon className="w-5 h-5" />
                  <span>הגדרות</span>
                </NavLink>
                {profile?.is_super_admin && (
                  <NavLink
                    to="/app/admin"
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm",
                        isActive ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-ink-100"
                      )
                    }
                  >
                    <Shield className="w-5 h-5" />
                    <span>ניהול מערכת</span>
                  </NavLink>
                )}
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-ink-700 hover:bg-ink-100 text-start"
                >
                  <LogOut className="w-5 h-5" />
                  <span>יציאה</span>
                </button>
              </nav>
            </aside>
          </div>
        )}

        {/* Desktop sidebar rail (icons only, collapsible later) */}
        <aside className="hidden md:flex w-14 flex-col items-center py-3 gap-1 border-s border-ink-200 bg-white">
          <NavLink
            to="/app/settings"
            className={({ isActive }) =>
              cn(
                "p-2.5 rounded-xl transition-colors",
                isActive ? "bg-ink-900 text-white" : "text-ink-500 hover:bg-ink-100 hover:text-ink-900"
              )
            }
            title="הגדרות"
          >
            <SettingsIcon className="w-5 h-5" />
          </NavLink>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Bottom tab bar (mobile only) */}
      <nav className="md:hidden sticky bottom-0 z-30 bg-white border-t border-ink-200 h-16 grid grid-cols-5">
        {NAV.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-0.5 text-[10px]",
                isActive ? "text-primary-600" : "text-ink-500"
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Floating quick capture button (mobile) */}
      <button
        onClick={() => setCaptureOpen(true)}
        className="md:hidden fixed bottom-20 end-4 z-20 w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 shadow-lift flex items-center justify-center text-white"
        aria-label="הקלטה מהירה"
      >
        <Mic className="w-6 h-6" />
      </button>

      <QuickCapture
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        currentPath={location.pathname}
      />

      <ActiveTimerPill />

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
