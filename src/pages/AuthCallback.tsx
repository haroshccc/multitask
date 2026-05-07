import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";

// Key stored in sessionStorage so it survives StrictMode re-mounts and
// React Suspense boundaries. Cleared once the exchange completes.
const EXCHANGE_KEY = "mt_oauth_code_exchanged";

function isTransientError(msg: string) {
  return /lock.*stolen/i.test(msg) || /state.*already.*used/i.test(msg) || /code.*already/i.test(msg);
}

export function AuthCallback() {
  const navigate = useNavigate();
  const { loading, session, profile } = useAuth();
  const [exchanging, setExchanging] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    // Deduplicate across re-mounts (StrictMode, Suspense) using sessionStorage.
    // The stored value is the code itself so stale keys from old tabs don't interfere.
    const alreadyExchanged = sessionStorage.getItem(EXCHANGE_KEY) === code;
    if (alreadyExchanged) {
      // Code was already sent — wait for the session to arrive via onAuthStateChange.
      setExchanging(false);
      return;
    }
    sessionStorage.setItem(EXCHANGE_KEY, code);

    const timeoutId = window.setTimeout(() => {
      setError("ההתחברות אורכת יותר מהצפוי. נסי לרענן את הדף או להתחבר שוב.");
      setExchanging(false);
    }, 15000);

    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error: exchErr }) => {
        window.clearTimeout(timeoutId);
        sessionStorage.removeItem(EXCHANGE_KEY);
        if (exchErr) {
          // Transient errors (lock contention, state-already-used) mean the
          // exchange already succeeded in a parallel request — session will
          // arrive via onAuthStateChange. Treat as success.
          if (isTransientError(exchErr.message)) {
            console.warn("exchange transient error; treating as OK:", exchErr.message);
            setExchanging(false);
            return;
          }
          console.error("exchangeCodeForSession failed:", exchErr);
          setError(exchErr.message);
          setExchanging(false);
          return;
        }
        setExchanging(false);
      })
      .catch((err) => {
        window.clearTimeout(timeoutId);
        sessionStorage.removeItem(EXCHANGE_KEY);
        const msg = err instanceof Error ? err.message : String(err);
        if (isTransientError(msg)) {
          console.warn("exchange transient error; treating as OK:", msg);
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
    if (error) return;
    if (!session) {
      navigate("/", { replace: true });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onboardingDone = (profile as any)?.onboarding_done;
    if (onboardingDone === false) {
      navigate("/plan", { replace: true });
    } else {
      navigate("/app", { replace: true });
    }
  }, [exchanging, loading, session, profile, error, navigate]);

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
