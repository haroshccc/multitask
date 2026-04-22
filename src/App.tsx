import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { Landing } from "@/pages/Landing";
import { AuthCallback } from "@/pages/AuthCallback";
import { Onboarding } from "@/pages/Onboarding";
import { AppShell } from "@/components/layout/AppShell";
import { Dashboard } from "@/pages/app/Dashboard";
import { Tasks } from "@/pages/app/Tasks";
import { Calendar } from "@/pages/app/Calendar";
import { Gantt } from "@/pages/app/Gantt";
import { Recordings } from "@/pages/app/Recordings";
import { Thoughts } from "@/pages/app/Thoughts";
import { Projects } from "@/pages/app/Projects";
import { ProjectDetail } from "@/pages/app/ProjectDetail";
import { Settings } from "@/pages/app/Settings";
import { Admin } from "@/pages/app/Admin";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { session, loading, memberships } = useAuth();
  if (loading) return <LoadingShell />;
  if (!session) return <Navigate to="/" replace />;
  if (memberships.length === 0) return <Navigate to="/onboarding" replace />;
  return children;
}

function RedirectIfAuthed({ children }: { children: JSX.Element }) {
  const { session, loading, memberships } = useAuth();
  if (loading) return <LoadingShell />;
  if (session && memberships.length > 0) return <Navigate to="/app" replace />;
  if (session && memberships.length === 0) return <Navigate to="/onboarding" replace />;
  return children;
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
      <Route
        path="/"
        element={
          <RedirectIfAuthed>
            <Landing />
          </RedirectIfAuthed>
        }
      />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="gantt" element={<Gantt />} />
        <Route path="recordings" element={<Recordings />} />
        <Route path="thoughts" element={<Thoughts />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:projectId" element={<ProjectDetail />} />
        <Route path="settings" element={<Settings />} />
        <Route path="admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
