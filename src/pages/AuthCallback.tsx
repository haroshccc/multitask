import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";

export function AuthCallback() {
  const navigate = useNavigate();
  const { loading, session, memberships } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate("/", { replace: true });
      return;
    }
    if (memberships.length === 0) {
      navigate("/onboarding", { replace: true });
    } else {
      navigate("/app", { replace: true });
    }
  }, [loading, session, memberships, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50">
      <div className="text-ink-500 text-sm animate-pulse">משלימה התחברות...</div>
    </div>
  );
}
