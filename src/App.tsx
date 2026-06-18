import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { Landing } from "@/pages/Landing";
import { AuthCallback } from "@/pages/AuthCallback";
import { Onboarding } from "@/pages/Onboarding";
import { PlanSelection } from "@/pages/PlanSelection";
import { OrgOnboarding } from "@/pages/OrgOnboarding";
import { Success } from "@/pages/Success";
import { InviteAccept } from "@/pages/InviteAccept";
import { AppShell } from "@/components/layout/AppShell";

// Lazy-loaded app pages — each gets its own chunk, dramatically reducing the
// initial bundle sent to the browser on first load.
const Dashboard = lazy(() =>
  import("@/pages/app/Dashboard").then((m) => ({ default: m.Dashboard }))
);
const Tasks = lazy(() =>
  import("@/pages/app/Tasks").then((m) => ({ default: m.Tasks }))
);
const Calendar = lazy(() =>
  import("@/pages/app/Calendar").then((m) => ({ default: m.Calendar }))
);
const Gantt = lazy(() =>
  import("@/pages/app/Gantt").then((m) => ({ default: m.Gantt }))
);
const Recordings = lazy(() =>
  import("@/pages/app/Recordings").then((m) => ({ default: m.Recordings }))
);
const Thoughts = lazy(() =>
  import("@/pages/app/Thoughts").then((m) => ({ default: m.Thoughts }))
);
const Projects = lazy(() =>
  import("@/pages/app/Projects").then((m) => ({ default: m.Projects }))
);
const Food = lazy(() =>
  import("@/pages/app/Food").then((m) => ({ default: m.Food }))
);
const Goals = lazy(() =>
  import("@/pages/app/Goals").then((m) => ({ default: m.Goals }))
);
const Frameworks = lazy(() =>
  import("@/pages/app/Frameworks").then((m) => ({ default: m.Frameworks }))
);
const PlanShell = lazy(() =>
  import("@/pages/app/PlanShell").then((m) => ({ default: m.PlanShell }))
);
const PlanConceptPage = lazy(() =>
  import("@/pages/app/PlanShell").then((m) => ({ default: m.PlanConceptPage }))
);
const PlanTasksPage = lazy(() =>
  import("@/pages/app/PlanShell").then((m) => ({ default: m.PlanTasksPage }))
);
const PlanImpactsPage = lazy(() =>
  import("@/pages/app/PlanShell").then((m) => ({ default: m.PlanImpactsPage }))
);
const Contacts = lazy(() =>
  import("@/pages/app/Contacts").then((m) => ({ default: m.Contacts }))
);
const ProjectShell = lazy(() =>
  import("@/pages/app/ProjectShell").then((m) => ({ default: m.ProjectShell }))
);
const ProjectTasksTab = lazy(() =>
  import("@/pages/app/project/ProjectTasksTab").then((m) => ({
    default: m.ProjectTasksTab,
  }))
);
const ProjectDashboardTab = lazy(() =>
  import("@/pages/app/project/ProjectDashboardTab").then((m) => ({
    default: m.ProjectDashboardTab,
  }))
);
const ProjectCalendarTab = lazy(() =>
  import("@/pages/app/project/ProjectCalendarTab").then((m) => ({
    default: m.ProjectCalendarTab,
  }))
);
const ProjectMeetingsTab = lazy(() =>
  import("@/pages/app/project/ProjectMeetingsTab").then((m) => ({
    default: m.ProjectMeetingsTab,
  }))
);
const ProjectPaymentsTab = lazy(() =>
  import("@/pages/app/project/ProjectPaymentsTab").then((m) => ({
    default: m.ProjectPaymentsTab,
  }))
);
const ProjectContactsTab = lazy(() =>
  import("@/pages/app/project/ProjectContactsTab").then((m) => ({
    default: m.ProjectContactsTab,
  }))
);
const ProjectDocumentsTab = lazy(() =>
  import("@/pages/app/project/ProjectDocumentsTab").then((m) => ({
    default: m.ProjectDocumentsTab,
  }))
);
const Settings = lazy(() =>
  import("@/pages/app/Settings").then((m) => ({ default: m.Settings }))
);
const Admin = lazy(() =>
  import("@/pages/app/Admin").then((m) => ({ default: m.Admin }))
);
const Notifications = lazy(() =>
  import("@/pages/app/Notifications").then((m) => ({ default: m.Notifications }))
);
const QuickRecord = lazy(() =>
  import("@/pages/app/QuickRecord").then((m) => ({ default: m.QuickRecord }))
);
const QuickNote = lazy(() =>
  import("@/pages/app/QuickNote").then((m) => ({ default: m.QuickNote }))
);

function RequireAuth({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth();
  if (loading) return <LoadingShell />;
  if (!session) return <Navigate to="/" replace />;
  return children;
}

function RedirectIfAuthed({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth();
  if (loading) return <LoadingShell />;
  if (session) return <Navigate to="/app" replace />;
  return children;
}

// Supabase sometimes redirects OAuth back to the Site URL ("/") instead of the
// configured redirectTo (/auth/callback) — typically when the Site URL and the
// Redirect URL list disagree, or when the provider strips the path. If we see
// a ?code= on the root path, forward it to /auth/callback so AuthCallback can
// exchange it for a session.
function RootRoute() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (params.has("code") || params.has("error") || params.has("error_description")) {
    return <Navigate to={`/auth/callback${location.search}${location.hash}`} replace />;
  }
  return (
    <RedirectIfAuthed>
      <Landing />
    </RedirectIfAuthed>
  );
}

function LoadingShell() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50">
      <div className="text-ink-500 text-sm animate-pulse">טוען...</div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/plan" element={<PlanSelection />} />
      <Route path="/org-setup" element={<OrgOnboarding />} />
      <Route path="/welcome" element={<Success />} />
      <Route path="/invite/:token" element={<InviteAccept />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route
          index
          element={
            <Suspense fallback={<LoadingShell />}>
              <Dashboard />
            </Suspense>
          }
        />
        <Route
          path="tasks"
          element={
            <Suspense fallback={<LoadingShell />}>
              <Tasks />
            </Suspense>
          }
        />
        <Route
          path="calendar"
          element={
            <Suspense fallback={<LoadingShell />}>
              <Calendar />
            </Suspense>
          }
        />
        <Route
          path="gantt"
          element={
            <Suspense fallback={<LoadingShell />}>
              <Gantt />
            </Suspense>
          }
        />
        <Route
          path="recordings"
          element={
            <Suspense fallback={<LoadingShell />}>
              <Recordings />
            </Suspense>
          }
        />
        <Route
          path="thoughts"
          element={
            <Suspense fallback={<LoadingShell />}>
              <Thoughts />
            </Suspense>
          }
        />
        <Route
          path="projects"
          element={
            <Suspense fallback={<LoadingShell />}>
              <Projects />
            </Suspense>
          }
        />
        <Route
          path="food"
          element={
            <Suspense fallback={<LoadingShell />}>
              <Food />
            </Suspense>
          }
        />
        <Route
          path="goals"
          element={
            <Suspense fallback={<LoadingShell />}>
              <Goals />
            </Suspense>
          }
        />
        <Route
          path="goals/plan/:planId"
          element={
            <Suspense fallback={<LoadingShell />}>
              <PlanShell />
            </Suspense>
          }
        >
          <Route index element={<Navigate to="concept" replace />} />
          <Route
            path="concept"
            element={
              <Suspense fallback={<LoadingShell />}>
                <PlanConceptPage />
              </Suspense>
            }
          />
          <Route
            path="tasks"
            element={
              <Suspense fallback={<LoadingShell />}>
                <PlanTasksPage />
              </Suspense>
            }
          />
          <Route
            path="impacts"
            element={
              <Suspense fallback={<LoadingShell />}>
                <PlanImpactsPage />
              </Suspense>
            }
          />
        </Route>
        <Route
          path="frameworks"
          element={
            <Suspense fallback={<LoadingShell />}>
              <Frameworks />
            </Suspense>
          }
        />
        <Route
          path="contacts"
          element={
            <Suspense fallback={<LoadingShell />}>
              <Contacts />
            </Suspense>
          }
        />
        <Route
          path="projects/:projectId"
          element={
            <Suspense fallback={<LoadingShell />}>
              <ProjectShell />
            </Suspense>
          }
        >
          <Route index element={<Navigate to="tasks" replace />} />
          <Route
            path="tasks"
            element={
              <Suspense fallback={<LoadingShell />}>
                <ProjectTasksTab />
              </Suspense>
            }
          />
          <Route
            path="calendar"
            element={
              <Suspense fallback={<LoadingShell />}>
                <ProjectCalendarTab />
              </Suspense>
            }
          />
          <Route
            path="meetings"
            element={
              <Suspense fallback={<LoadingShell />}>
                <ProjectMeetingsTab />
              </Suspense>
            }
          />
          <Route
            path="payments"
            element={
              <Suspense fallback={<LoadingShell />}>
                <ProjectPaymentsTab />
              </Suspense>
            }
          />
          <Route
            path="contacts"
            element={
              <Suspense fallback={<LoadingShell />}>
                <ProjectContactsTab />
              </Suspense>
            }
          />
          <Route
            path="documents"
            element={
              <Suspense fallback={<LoadingShell />}>
                <ProjectDocumentsTab />
              </Suspense>
            }
          />
          <Route
            path="dashboard"
            element={
              <Suspense fallback={<LoadingShell />}>
                <ProjectDashboardTab />
              </Suspense>
            }
          />
        </Route>
        <Route
          path="settings"
          element={
            <Suspense fallback={<LoadingShell />}>
              <Settings />
            </Suspense>
          }
        />
        <Route
          path="admin"
          element={
            <Suspense fallback={<LoadingShell />}>
              <Admin />
            </Suspense>
          }
        />
        <Route
          path="notifications"
          element={
            <Suspense fallback={<LoadingShell />}>
              <Notifications />
            </Suspense>
          }
        />
        <Route
          path="record"
          element={
            <Suspense fallback={<LoadingShell />}>
              <QuickRecord />
            </Suspense>
          }
        />
        <Route
          path="note"
          element={
            <Suspense fallback={<LoadingShell />}>
              <QuickNote />
            </Suspense>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
