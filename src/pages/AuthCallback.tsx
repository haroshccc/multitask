import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";

export function AuthCallback() {
  const navigate = useNavigate();
  const { loading, session, memberships } = useAuth();
  const [exchanging, setExchanging] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // StrictMode mounts components twice in dev; guard against exchanging the
  // same one-time OAuth code twice (the second attempt always fails).
  const exchangedRef = useRef(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const errorDescription = url.searchParams.get("error_description");

    if (errorDescription) {
      setError(decodeURIComponent(errorDescription));
      setExchanging(false);
      return;
    }

    if (!code) {
      setExchanging(false);
      return;
    }

    if (exchangedRef.current) return;
    exchangedRef.current = true;

    const timeoutId = window.setTimeout(() => {
      setError(
        "ההתחברות אורכת יותר מהצפוי. נסי לרענן את הדף או להתחבר שוב."
      );
      setExchanging(false);
    }, 15000);

    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error: exchErr }) => {
        window.clearTimeout(timeoutId);
        if (exchErr) {
          // "Lock stolen" is transient contention between the exchange and
          // onAuthStateChange — the session still arrives. Treat it as success.
          if (/lock.*stolen/i.test(exchErr.message)) {
            console.warn("exchange reported lock contention; treating as OK");
            setExchanging(false);
            return;
          }
          console.error("exchangeCodeForSession failed:", exchErr);
          setError(exchErr.message);
          setExchanging(false);
          return;
        }
        // Don't load profile/memberships here — AuthContext's
        // onAuthStateChange listener already schedules that once the session
        // is set (see the setTimeout(0) in AuthContext).
        setExchanging(false);
      })
      .catch((err) => {
        window.clearTimeout(timeoutId);
        const msg = err instanceof Error ? err.message : String(err);
        if (/lock.*stolen/i.test(msg)) {
          console.warn("exchange reported lock contention; treating as OK");
          setExchanging(false);
          return;
        }
        console.error("exchangeCodeForSession threw:", err);
        setError(msg);
        setExchanging(false);
      });

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once exchange and initial auth load are both done, route the user.
  useEffect(() => {
    if (exchanging || loading) return;
    if (error) return; // let the user see the error, don't auto-navigate
    if (!session) {
      navigate("/", { replace: true });
      return;
    }
    if (memberships.length === 0) {
      navigate("/onboarding", { replace: true });
    } else {
      navigate("/app", { replace: true });
    }
  }, [exchanging, loading, session, memberships, error, navigate]);

  return (
    <div className="min-h-screen bg-ink-50 flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        {!error ? (
          <>
            <div className="text-ink-500 text-sm mb-2 animate-pulse">
              משלימה התחברות...
            </div>
            <div className="text-xs text-ink-400">רגע...</div>
          </>
        ) : (
          <>
            <div className="text-danger text-sm font-medium mb-2">
              ההתחברות נכשלה
            </div>
            <div className="text-xs text-ink-500 mb-6 leading-relaxed">{error}</div>
            <button onClick={() => navigate("/", { replace: true })} className="btn-dark">
              חזרה לעמוד הראשי
            </button>
          </>
        )}
      </div>
    </div>
  );
}
