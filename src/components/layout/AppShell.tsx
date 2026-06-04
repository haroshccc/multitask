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
  Keyboard,
  Sparkles,
} from "lucide-react";
import { useUndoStore, useCanUndo, useCanRedo } from "@/lib/undo/store";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRealtimeSync } from "@/lib/hooks/useRealtimeSync";
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
  { to: "/app/food", label: "אוכל", icon: UtensilsCrossed },
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
  const assistantEnabled = import.meta.env.VITE_FEATURE_AI_ASSISTANT === "true";

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
    <div className="h-screen bg-ink-50 flex flex-col overflow-hidden">
      {/* Top bar — not sticky; lives in fixed-height flex row so it never scrolls */}
      <header className="shrink-0 z-30 bg-white border-b border-ink-200">
      <div className="px-4 md:px-6 h-14 flex items-center justify-between gap-2">
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

      {/* Bottom tab bar (mobile only). Every primary screen appears here;
          inline-end padding reserves space for the AnimatedFab so it never
          overlaps a tab. */}
      <nav
        className="md:hidden shrink-0 z-30 bg-white border-t border-ink-200 h-16 flex items-stretch"
        style={{ paddingInlineEnd: "88px" /* matches 64px FAB + 24px inset */ }}
      >
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.label}
            className={({ isActive }) =>
              cn(
                "flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 text-[9px] leading-tight px-0.5",
                isActive ? "text-primary-600" : "text-ink-500"
              )
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            <span className="truncate w-full text-center">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Floating quick capture button — visible on every breakpoint, cycles
          its icon + gradient through the five capture actions. */}
      <AnimatedFab
        onClick={() => setCaptureOpen(true)}
        paused={captureOpen}
      />

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
              className="fixed bottom-4 start-4 z-40 w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-primary-600 text-white shadow-lift flex items-center justify-center hover:opacity-90"
              aria-label="עוזר AI"
              title="עוזר AI"
            >
              <Sparkles className="w-5 h-5" />
            </button>
          )}
          <AssistantPanel />
        </>
      )}
    </div>
    </FocusSessionProvider>
  );
}
