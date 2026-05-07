import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { getInviteByToken, acceptInvite } from "@/lib/services/organizations";

type Step = "loading" | "preview" | "accepting" | "done" | "error" | "need-login";

const orgTypeLabel: Record<string, string> = {
  business: "עסקי",
  family: "משפחתי",
  personal: "אישי",
};

export function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { session, loading: authLoading, signInWithGoogle, refreshProfile } = useAuth();

  const [step, setStep] = useState<Step>("loading");
  const [invite, setInvite] = useState<{
    org_name?: string;
    org_type?: string;
    role?: string;
    expires_at?: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!token) { setStep("error"); setErrorMsg("קישור לא תקין."); return; }

    getInviteByToken(token)
      .then((info) => {
        if (!info.valid) {
          setStep("error");
          setErrorMsg("הקישור פג תוקף או כבר נוצל.");
          return;
        }
        setInvite(info);
        if (session) {
          sessionStorage.removeItem("pending_invite_token");
          setStep("preview");
        } else {
          setStep("need-login");
        }
      })
      .catch(() => {
        setStep("error");
        setErrorMsg("לא הצלחנו לטעון את פרטי ההזמנה.");
      });
  }, [authLoading, session, token]);

  // After OAuth redirect back, resume if pending token matches
  useEffect(() => {
    if (!session || authLoading) return;
    const pending = sessionStorage.getItem("pending_invite_token");
    if (pending && pending === token && step === "need-login") {
      sessionStorage.removeItem("pending_invite_token");
      setStep("preview");
    }
  }, [session, authLoading, token, step]);

  const handleAccept = async () => {
    if (!token) return;
    setStep("accepting");
    try {
      const result = await acceptInvite(token);
      if (!result.ok) {
        setStep("error");
        setErrorMsg(result.error ?? "שגיאה בקבלת ההזמנה.");
        return;
      }
      await refreshProfile();
      setStep("done");
      setTimeout(() => navigate("/app", { replace: true }), 1800);
    } catch (err) {
      setStep("error");
      setErrorMsg(err instanceof Error ? err.message : "שגיאה בקבלת ההזמנה.");
    }
  };

  const handleGoogleLogin = async () => {
    sessionStorage.setItem("pending_invite_token", token ?? "");
    await signInWithGoogle();
  };

  const grad = "linear-gradient(135deg, #facc15 0%, #f59e0b 45%, #ec4899 100%)";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fafaf9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Fredoka, Rubik, sans-serif",
        direction: "rtl",
        padding: "24px",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          padding: "40px 36px",
          maxWidth: 420,
          width: "100%",
          boxShadow: "0 8px 40px rgba(0,0,0,0.10)",
          textAlign: "center",
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: 24 }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="12" fill="url(#invGrad)" />
            <text x="20" y="28" textAnchor="middle" fontSize="22" fontWeight="700" fill="#fff" fontFamily="Fredoka, sans-serif">M</text>
            <defs>
              <linearGradient id="invGrad" x1="0" y1="0" x2="40" y2="40">
                <stop stopColor="#facc15" /><stop offset="1" stopColor="#ec4899" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {step === "loading" && (
          <div style={{ fontSize: 16, color: "#78716c" }}>טוענת הזמנה...</div>
        )}

        {(step === "need-login" || step === "preview") && invite && (
          <>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "#111118" }}>
              הוזמנת להצטרף
            </div>
            <div style={{ fontSize: 16, color: "#57534e", marginBottom: 6 }}>
              לקבוצה <strong>{invite.org_name}</strong>
              {invite.org_type ? ` (${orgTypeLabel[invite.org_type] ?? invite.org_type})` : ""}
            </div>
            {invite.role && (
              <div style={{ fontSize: 13, color: "#a8a29e", marginBottom: 24 }}>
                תפקיד: {invite.role === "admin" ? "מנהל" : "חבר"}
              </div>
            )}

            {step === "need-login" ? (
              <>
                <div style={{ fontSize: 14, color: "#78716c", marginBottom: 20 }}>
                  כדי לקבל את ההזמנה, כנסי תחילה עם Google
                </div>
                <button
                  onClick={handleGoogleLogin}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    padding: "12px 20px",
                    borderRadius: 12,
                    border: "1.5px solid #e7e5e4",
                    background: "#fff",
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: "pointer",
                    color: "#111118",
                  }}
                >
                  <GoogleIcon /> כניסה עם Google
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleAccept}
                  style={{
                    width: "100%",
                    padding: "13px 24px",
                    borderRadius: 12,
                    border: "none",
                    background: grad,
                    color: "#fff",
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: "pointer",
                    marginBottom: 12,
                  }}
                >
                  קבלי הזמנה
                </button>
                <button
                  onClick={() => navigate("/app", { replace: true })}
                  style={{
                    width: "100%",
                    padding: "10px 24px",
                    borderRadius: 12,
                    border: "1.5px solid #e7e5e4",
                    background: "#fff",
                    fontSize: 14,
                    color: "#78716c",
                    cursor: "pointer",
                  }}
                >
                  דחיה
                </button>
              </>
            )}
          </>
        )}

        {step === "accepting" && (
          <div style={{ fontSize: 16, color: "#78716c" }}>מצרפת אותך...</div>
        )}

        {step === "done" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#111118", marginBottom: 8 }}>
              ברוכה הבאה!
            </div>
            <div style={{ fontSize: 14, color: "#78716c" }}>
              הצטרפת לקבוצה בהצלחה. מעבירה אותך לאפליקציה...
            </div>
          </>
        )}

        {step === "error" && (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>
              שגיאה
            </div>
            <div style={{ fontSize: 14, color: "#78716c", marginBottom: 24 }}>{errorMsg}</div>
            <button
              onClick={() => navigate("/", { replace: true })}
              style={{
                padding: "10px 24px",
                borderRadius: 12,
                border: "none",
                background: "#111118",
                color: "#fff",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              חזרה לדף הבית
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20">
      <path d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.79h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.22c1.89-1.74 2.98-4.3 2.98-7.31z" fill="#4285F4" />
      <path d="M10 20c2.7 0 4.96-.89 6.62-2.42l-3.22-2.5c-.9.6-2.04.96-3.4.96-2.61 0-4.82-1.76-5.61-4.13H1.06v2.58A9.998 9.998 0 0 0 10 20z" fill="#34A853" />
      <path d="M4.39 11.91A6.01 6.01 0 0 1 4.07 10c0-.66.11-1.3.32-1.91V5.51H1.06A9.998 9.998 0 0 0 0 10c0 1.61.39 3.13 1.06 4.49l3.33-2.58z" fill="#FBBC05" />
      <path d="M10 3.96c1.47 0 2.79.51 3.83 1.5l2.87-2.87C14.96.89 12.7 0 10 0A9.998 9.998 0 0 0 1.06 5.51l3.33 2.58C5.18 5.72 7.39 3.96 10 3.96z" fill="#EA4335" />
    </svg>
  );
}
