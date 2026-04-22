import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";

// Supabase throws this when concurrent auth calls race on the token lock. The
// exchange itself usually still succeeds (the session lands via onAuthStateChange),
// so we treat it as transient and let the session check below decide the outcome.
function isLockStolenError(message: string | undefined): boolean {
  if (!message) return false;
  return /Lock .* was released because another request stole it/i.test(message);
}

export function AuthCallback() {
  const navigate = useNavigate();
  const { loading, session, memberships } = useAuth();
  const [exchanging, setExchanging] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // StrictMode double-invokes effects in dev; a second exchangeCodeForSession
  // on the same code is the classic trigger for the "lock stolen" error.
  const didExchangeRef = useRef(false);

  // On mount: explicitly exchange the ?code= URL param for a session.
  // Relying on Supabase client's detectSessionInUrl is racy with router
  // navigation — we want a deterministic success/fail we can branch on.
  useEffect(() => {
    if (didExchangeRef.current) return;
    didExchangeRef.current = true;

    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const errorDescription = url.searchParams.get("error_description");

    if (errorDescription) {
      setError(decodeURIComponent(errorDescription));
      setExchanging(false);
      return;
    }

    if (!code) {
      // Nothing to exchange — just fall through to the routing effect below
      setExchanging(false);
      return;
    }

    // Hard timeout so we never leave the user staring at a spinner. If the
    // exchange (or anything downstream) stalls, surface an actionable error
    // instead of an infinite "משלימה התחברות...".
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
        if (exchErr && !isLockStolenError(exchErr.message)) {
          console.error("exchangeCodeForSession failed:", exchErr);
          setError(exchErr.message);
          setExchanging(false);
          return;
        }
        if (exchErr) {
          console.warn("exchangeCodeForSession lock contention — ignoring:", exchErr);
        }
        // Profile + memberships load via AuthContext's onAuthStateChange
        // listener. Kicking off another refresh here only adds lock pressure.
        setExchanging(false);
      })
      .catch((err) => {
        window.clearTimeout(timeoutId);
        const msg = err instanceof Error ? err.message : String(err);
        if (isLockStolenError(msg)) {
          console.warn("exchangeCodeForSession lock contention — ignoring:", err);
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
