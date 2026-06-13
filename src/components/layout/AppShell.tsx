import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import {
  Home,
  CheckSquare,
  Calendar as CalendarIcon,
  BarChart3,
  Mic,
  Lightbulb,
  FolderKanban,
  Contact as ContactIcon,
  Target,
  Frame,
  UtensilsCrossed,
  Settings as SettingsIcon,
  Shield,
  LogOut,
  Plus,
  Search,
  Bell,
  Menu,
  X,
  Undo2,
  Redo2,
  Moon,
  Sun,
  Keyboard,
  Sparkles,
} from "lucide-react";
import { useUndoStore, useCanUndo, useCanRedo } from "@/lib/undo/store";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRealtimeSync } from "@/lib/hooks/useRealtimeSync";
import { useEventReminders } from "@/lib/hooks/useEventReminders";
import { useTheme } from "@/lib/hooks/useTheme";
import { useUnreadNotificationsCount } from "@/lib/hooks/useNotifications";
import { cn } from "@/lib/utils/cn";
import { QuickCapture } from "@/components/capture/QuickCapture";
import { AnimatedFab } from "@/components/capture/AnimatedFab";
import { GlobalSearchPalette } from "@/components/search/GlobalSearchPalette";
import { Logo } from "@/components/brand/Logo";
import { FloatingTimerBanner } from "@/components/timer/FloatingTimerBanner";
import { FocusSessionProvider } from "@/components/focus/FocusSessionProvider";
import { FocusSessionLayer } from "@/components/focus/FocusSessionLayer";
import { PendingInviteBanner } from "@/components/org/PendingInviteBanner";
import { KeyboardShortcutsPanel } from "@/components/ui/KeyboardShortcutsPanel";
import { ToastRegion } from "@/components/ui/Toast";
import { AssistantPanel } from "@/components/ai/AssistantPanel";
import { useAssistantUi } from "@/lib/ai/store";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: "/app", label: "דשבורד", icon: Home, end: true },
  { to: "/app/tasks", label: "משימות", icon: CheckSquare },
  { to: "/app/goals", label: "יעדים", icon: Target },
  { to: "/app/frameworks", label: "מסגרות", icon: Frame },
  { to: "/app/calendar", label: "יומן", icon: CalendarIcon },
  { to: "/app/gantt", label: "Gantt", icon: BarChart3 },
  { to: "/app/recordings", label: "הקלטות", icon: Mic },
  { to: "/app/thoughts", label: "מחשבות", icon: Lightbulb },
  { to: "/app/projects", label: "פרויקטים", icon: FolderKanban },
  { to: "/app/contacts", label: "אנשי קשר", icon: ContactIcon },
  { to: "/app/food", label: "אוכל", icon: UtensilsCrossed },
];

// Primary destinations shown directly in the mobile bottom bar. Everything
// else lives behind the "עוד" (More) tab, which opens the full nav drawer.
const PRIMARY_MOBILE_NAV: NavItem[] = [
  { to: "/app", label: "דשבורד", icon: Home, end: true },
  { to: "/app/tasks", label: "משימות", icon: CheckSquare },
  { to: "/app/calendar", label: "יומן", icon: CalendarIcon },
];

// Route codes for vim-style G→X navigation (physical key codes, layout-independent)
const G_NAV: Record<string, string> = {
  KeyT: "/app/tasks",
  KeyG: "/app/goals",
  KeyM: "/app/frameworks",
  KeyC: "/app/calendar",
  KeyR: "/app/recordings",
  KeyH: "/app/thoughts",
  KeyP: "/app/projects",
  KeyF: "/app/food",
  KeyD: "/app",
};

export function AppShell() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const assistantUi = useAssistantUi();
  // On by default; set VITE_FEATURE_AI_ASSISTANT=false to hide it.
  const assistantEnabled = import.meta.env.VITE_FEATURE_AI_ASSISTANT !== "false";

  // Ref so keyboard handler always sees the latest pathname without re-registering.
  const pathnameRef = useRef(location.pathname);
  useEffect(() => { pathnameRef.current = location.pathname; }, [location.pathname]);

  // Refs so the keyboard effect ([] deps) can see the latest modal state
  // without being re-registered on every render.
  const captureOpenRef = useRef(captureOpen);
  const searchOpenRef = useRef(searchOpen);
  captureOpenRef.current = captureOpen;
  searchOpenRef.current = searchOpen;

  // Subscribe the whole session to Realtime invalidations for the active org.
  // Must stay mounted at AppShell level — DO NOT move into individual screens.
  useRealtimeSync();

  // Event-start reminders (system notifications) — app-wide, like realtime.
  useEventReminders();

  const { theme, toggle: toggleTheme } = useTheme();

  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const { data: unreadCount = 0 } = useUnreadNotificationsCount();

  useEffect(() => {
    // Whether the event target is a text-editing element where browser-native
    // shortcuts (Ctrl+Z inside an <input>) should be left alone.
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (target.isContentEditable) return true;
      return false;
    };

    // Pending first key of a two-key sequence (e.g. G → T for vim-style nav).
    let gPending = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    const clearG = () => {
      gPending = false;
      if (gTimer) { clearTimeout(gTimer); gTimer = null; }
    };

    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      // Use e.code (physical key) instead of e.key so shortcuts work on all
      // keyboard layouts including Hebrew where e.key gives Hebrew characters.
      const code = e.code;

      // ── Modifier combos ────────────────────────────────────────────────────
      if (mod) {
        if (code === "KeyK") {
          if (isEditableTarget(e.target)) return;
          e.preventDefault();
          setSearchOpen(true);
          clearG();
          return;
        }
        if (code === "KeyN") {
          if (isEditableTarget(e.target)) return;
          e.preventDefault();
          clearG();
          // Context-aware: open the relevant creation dialog for the active screen.
          const path = pathnameRef.current;
          if (path.startsWith("/app/tasks"))      { window.dispatchEvent(new CustomEvent("app:new-task")); }
          else if (path.startsWith("/app/goals")) { window.dispatchEvent(new CustomEvent("app:new-goal")); }
          else if (path.startsWith("/app/calendar")) { window.dispatchEvent(new CustomEvent("app:new-event")); }
          else if (path.startsWith("/app/projects")) { window.dispatchEvent(new CustomEvent("app:new-project")); }
          else if (path.startsWith("/app/thoughts")) { window.dispatchEvent(new CustomEvent("app:new-thought")); }
          else { setCaptureOpen(true); }
          return;
        }
        // Undo — skip when typing in a text field (browser handles it there).
        if (code === "KeyZ" && !e.shiftKey) {
          if (isEditableTarget(e.target)) return;
          e.preventDefault();
          useUndoStore.getState().undo();
          clearG();
          return;
        }
        // Redo (Ctrl+Y or Ctrl+Shift+Z / Cmd+Shift+Z on Mac).
        if (code === "KeyY" || (code === "KeyZ" && e.shiftKey)) {
          if (isEditableTarget(e.target)) return;
          e.preventDefault();
          useUndoStore.getState().redo();
          clearG();
          return;
        }
        // Ctrl+. — toggle mobile sidebar.
        if (code === "Period") {
          e.preventDefault();
          setSidebarOpen((v) => !v);
          clearG();
          return;
        }
        return; // other Ctrl/Cmd combos — don't process further
      }

      // ── No-modifier shortcuts ──────────────────────────────────────────────
      // Skip when typing anywhere.
      if (isEditableTarget(e.target)) { clearG(); return; }

      // ? → shortcuts panel
      if (e.key === "?" && !e.shiftKey) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        clearG();
        return;
      }
      // Shift+? also triggers (? is Shift+/ on many keyboards, but key is "?").
      if (e.key === "?" && e.shiftKey) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        clearG();
        return;
      }

      // G → [key] vim-style navigation
      if (code === "KeyG" && !gPending) {
        gPending = true;
        gTimer = setTimeout(clearG, 1200);
        return;
      }
      if (gPending) {
        clearG();
        const target = G_NAV[code];
        if (target) {
          e.preventDefault();
          navigate(target, { replace: false });
        }
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); clearG(); };
  }, [navigate]); // navigate is stable

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <FocusSessionProvider>
    <div className="h-dvh bg-ink-50 flex flex-col overflow-hidden">
      {/* Top bar — not sticky; lives in fixed-height flex row so it never scrolls */}
      <header className="shrink-0 z-30 bg-white border-b border-ink-200">
      <div className="px-4 md:px-6 h-14 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="md:hidden p-2 rounded-xl hover:bg-ink-100 shrink-0"
            aria-label="פתח תפריט"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          {/* Mobile: mark only (the wordmark is wide and crowded the menu
              button). Desktop: full wordmark. */}
          <Logo markSize={26} markOnly className="md:hidden shrink-0" idKey="shellLogoM" />
          <Logo markSize={28} className="hidden md:flex min-w-0" idKey="shellLogo" />
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
            onClick={toggleTheme}
            className="inline-flex p-2 rounded-xl hover:bg-ink-100"
            aria-label={theme === "dark" ? "מצב בהיר" : "מצב כהה"}
            title={theme === "dark" ? "מצב בהיר" : "מצב כהה (בטא)"}
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5 text-ink-600" />
            ) : (
              <Moon className="w-5 h-5 text-ink-600" />
            )}
          </button>
          <button
            onClick={() => useUndoStore.getState().undo()}
            disabled={!canUndo}
            className="inline-flex p-2 rounded-xl hover:bg-ink-100 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="בטל"
            title="בטל (Ctrl+Z)"
          >
            <Undo2 className="w-5 h-5 text-ink-600" />
          </button>
          <button
            onClick={() => useUndoStore.getState().redo()}
            disabled={!canRedo}
            className="inline-flex p-2 rounded-xl hover:bg-ink-100 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="בצע מחדש"
            title="בצע מחדש (Ctrl+Y)"
          >
            <Redo2 className="w-5 h-5 text-ink-600" />
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-xl hover:bg-ink-100"
            aria-label="חיפוש"
            title="חיפוש (Ctrl+K)"
          >
            <Search className="w-5 h-5 text-ink-600" />
          </button>
          <NavLink
            to="/app/notifications"
            className={({ isActive }) =>
              cn("relative p-2 rounded-xl transition-colors", isActive ? "bg-ink-900 text-white" : "hover:bg-ink-100")
            }
            aria-label="התראות"
            title="התראות"
          >
            {({ isActive }) => (
              <>
                <Bell className={cn("w-5 h-5", isActive ? "text-white" : "text-ink-600")} />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 end-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
          <button
            onClick={() => setShortcutsOpen(true)}
            className="hidden md:inline-flex p-2 rounded-xl hover:bg-ink-100"
            aria-label="קיצורי מקלדת"
            title="קיצורי מקלדת (?)"
          >
            <Keyboard className="w-5 h-5 text-ink-600" />
          </button>
          <button
            onClick={() => setCaptureOpen(true)}
            className="p-2 rounded-xl bg-primary-500 text-white hover:bg-primary-600"
            aria-label="יצירה מהירה"
          >
            <Plus className="w-5 h-5" />
          </button>
          <div className="hidden md:flex items-center gap-1 ps-2 border-s border-ink-200 ms-1">
            <NavLink
              to="/app/settings"
              className={({ isActive }) =>
                cn(
                  "p-2 rounded-xl transition-colors",
                  isActive
                    ? "bg-ink-900 text-white"
                    : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
                )
              }
              title="הגדרות"
              aria-label="הגדרות"
            >
              <SettingsIcon className="w-5 h-5" />
            </NavLink>
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
                aria-label="ניהול מערכת"
              >
                <Shield className="w-5 h-5" />
              </NavLink>
            )}
            <button
              className="w-8 h-8 rounded-xl bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-sm font-medium text-ink-700"
              aria-label="פרופיל"
            >
              {(profile?.full_name?.[0] ?? "?").toUpperCase()}
            </button>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-xl text-ink-600 hover:bg-ink-100"
              aria-label="יציאה"
              title="יציאה"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      <PendingInviteBanner />
      </header>

      {/* Body: sidebar (mobile drawer / desktop rail) + main */}
      <div className="flex-1 flex overflow-hidden min-h-0">
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
                {assistantEnabled && (
                  <button
                    onClick={() => {
                      setSidebarOpen(false);
                      assistantUi.setOpen(true);
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-ink-700 hover:bg-ink-100 text-start"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span>עוזר AI</span>
                  </button>
                )}
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-ink-700 hover:bg-ink-100 text-start"
                >
                  {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  <span>{theme === "dark" ? "מצב בהיר" : "מצב כהה"}</span>
                </button>
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

        {/* Main content — the only scrolling region */}
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Bottom tab bar (mobile only): 3 primary tabs + a raised center capture
          FAB + a "More" tab that opens the full nav drawer. Keeps every tap
          target comfortably wide instead of cramming all 11 screens. */}
      <nav
        className="md:hidden shrink-0 z-30 bg-white border-t border-ink-200 grid grid-cols-4 items-stretch h-16"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {PRIMARY_MOBILE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.label}
            className={({ isActive }) =>
              cn(
                "min-w-0 flex flex-col items-center justify-center gap-0.5 text-[10px] leading-tight px-0.5",
                isActive ? "text-primary-600" : "text-ink-500"
              )
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span className="truncate w-full text-center">{item.label}</span>
          </NavLink>
        ))}

        {/* More — opens the full navigation drawer. Quick-create lives in the
            top bar (+), so there's no floating button on mobile. */}
        <button
          onClick={() => setSidebarOpen(true)}
          title="עוד"
          className={cn(
            "min-w-0 flex flex-col items-center justify-center gap-0.5 text-[10px] leading-tight px-0.5",
            sidebarOpen ? "text-primary-600" : "text-ink-500"
          )}
        >
          <Menu className="w-5 h-5 shrink-0" />
          <span className="truncate w-full text-center">עוד</span>
        </button>
      </nav>

      {/* Floating quick capture button — desktop only (mobile uses the docked
          FAB inside the bottom bar above). */}
      <div className="hidden md:block">
        <AnimatedFab
          onClick={() => setCaptureOpen(true)}
          paused={captureOpen}
        />
      </div>

      <QuickCapture
        open={captureOpen}
        onClose={() => setCaptureOpen(false)}
        currentPath={location.pathname}
      />

      <GlobalSearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />

      <KeyboardShortcutsPanel open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <ToastRegion />

      <FloatingTimerBanner />
      <FocusSessionLayer />

      {assistantEnabled && (
        <>
          {!assistantUi.open && (
            <button
              type="button"
              onClick={() => assistantUi.setOpen(true)}
              className="ai-launcher hidden md:flex fixed bottom-4 start-4 z-40 w-16 h-16 rounded-full text-white items-center justify-center transition-transform hover:scale-110"
              aria-label="עוזר AI"
              title="עוזר AI"
            >
              <Sparkles className="ai-launcher-icon w-7 h-7" />
            </button>
          )}
          <AssistantPanel />
        </>
      )}
    </div>
    </FocusSessionProvider>
  );
}
