import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/lib/supabase/client";

const GRADIENT = "linear-gradient(135deg, #f59e0b 0%, #f472b6 25%, #ec4899 50%, #db2777 75%, #be185d 100%)";

const plans = [
  {
    id: "free" as const,
    name: "חינם",
    price: "0",
    subtitle: "מתאים להתחלה",
    features: ["עד 50 משימות", "יעד אחד", "בלי קבוצות", "בלי הקלטות AI"],
    recommended: false,
  },
  {
    id: "pro" as const,
    name: "פלוס",
    price: "29",
    subtitle: "ליחיד שרציני",
    features: ["משימות ללא הגבלה", "יעדים", "הקלטות AI (5 שעות/חודש)", "קבוצה אחת"],
    recommended: true,
  },
  {
    id: "enterprise" as const,
    name: "פרו",
    price: "99",
    subtitle: "לצוותים וארגונים",
    features: ["כל מה שב-Plus", "הקלטות ללא הגבלה", "עד 5 קבוצות", "תמיכה מועדפת"],
    recommended: false,
  },
];

function HeroBadgeLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, animation: "mtSlideRight .7s cubic-bezier(0.34,1.3,0.64,1) both" }}>
      <div style={{
        width: 46, height: 46, borderRadius: 11,
        background: "rgba(255,255,255,.95)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="24" height="26" viewBox="0 0 100 110" fill="none" stroke="#ec4899" strokeWidth="13" strokeLinecap="butt">
          <path d="M 10 100 L 10 10" /><path d="M 10 10 L 50 60" /><path d="M 50 60 L 90 10" />
          <path d="M 90 10 L 90 65" /><path d="M 50 60 L 90 100" /><path d="M 90 65 L 90 100" />
        </svg>
      </div>
      <span style={{ fontSize: 24, fontWeight: 600, color: "#fff", letterSpacing: "-.5px", fontFamily: "Fredoka, sans-serif" }}>multitask</span>
    </div>
  );
}

export function PlanSelection() {
  const navigate = useNavigate();
  const { session, loading, profile, refreshProfile } = useAuth();
  const [selected, setSelected] = useState<"free" | "pro" | "enterprise">("pro");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28, border: "3px solid #f3e8ff", borderTop: "3px solid #ec4899", borderRadius: "50%", animation: "mtSpin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (!session) return <Navigate to="/" replace />;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((profile as any)?.onboarding_done) return <Navigate to="/app" replace />;

  const handleContinue = async () => {
    setSubmitting(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc("set_onboarding_done", { p_plan: selected });
    navigate("/org-setup", { replace: true });
    refreshProfile();
  };

  return (
    <div dir="rtl" style={{
      minHeight: "100vh", display: "flex", flexDirection: "row-reverse",
      fontFamily: "Fredoka, Rubik, sans-serif", overflow: "hidden",
    }}>
      {/* LEFT: pink hero */}
      <div style={{
        flex: 1.05, background: GRADIENT, backgroundSize: "200% 200%",
        animation: "mtGradShift 10s ease infinite",
        position: "relative", overflow: "hidden",
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: "56px 56px", color: "#fff",
      }}>
        {/* Dot pattern */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <defs>
            <pattern id="dotsPlan" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" fill="rgba(255,255,255,.18)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dotsPlan)" />
        </svg>

        {/* Decorative circles */}
        <div style={{ position: "absolute", width: 280, height: 280, borderRadius: "50%", border: "2px solid rgba(255,255,255,.18)", right: -100, top: -100, animation: "mtSpin 30s linear infinite" }} />
        <div style={{ position: "absolute", width: 160, height: 160, border: "2px solid rgba(255,255,255,.22)", right: "18%", top: "48%", transform: "rotate(45deg)", animation: "mtSpin 22s linear infinite reverse" }} />
        <div style={{ position: "absolute", width: 110, height: 110, borderRadius: 28, background: "rgba(255,255,255,.18)", backdropFilter: "blur(18px)", left: "12%", bottom: "18%", animation: "mtFloat 8s ease-in-out infinite" }} />

        {/* Logo */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <HeroBadgeLogo />
        </div>

        {/* Bottom copy */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.85, marginBottom: 18, animation: "mtFadeIn .6s ease .4s both" }}>
            ✨ שלב 2 מתוך 3
          </div>
          <h2 style={{ fontSize: 54, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-1.5px", marginBottom: 24 }}>
            <div style={{ overflow: "hidden" }}>
              <div style={{ animation: "mtSlideUp .8s cubic-bezier(0.25,0.46,0.45,0.94) .5s both" }}>בחרי את התוכנית</div>
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ animation: "mtSlideUp .8s cubic-bezier(0.25,0.46,0.45,0.94) .7s both" }}>שמתאימה לך.</div>
            </div>
          </h2>
          <p style={{ fontSize: 17, opacity: 0.92, maxWidth: 380, lineHeight: 1.5, animation: "mtFadeIn .8s ease .9s both" }}>
            תמיד אפשר לשנות, לשדרג או לבטל מההגדרות. ללא התחייבות.
          </p>
          <div style={{ display: "flex", gap: 24, marginTop: 32, animation: "mtFadeIn .8s ease 1.1s both" }}>
            {[["14", "ימי ניסיון"], ["∞", "שינויים"], ["0₪", "התחלה"]].map(([n, l], i) => (
              <div key={i}>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{n}</div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT: form */}
      <div style={{
        flex: 1, background: "#fff", display: "flex", alignItems: "center",
        justifyContent: "center", padding: "40px 44px", overflowY: "auto",
      }}>
        <div style={{ maxWidth: 440, width: "100%", animation: "mtSlideLeft .7s cubic-bezier(0.34,1.3,0.64,1) .2s both" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#ec4899", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10 }}>
            תוכניות
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 600, color: "#111118", letterSpacing: "-.8px", marginBottom: 6, lineHeight: 1.15 }}>
            איזו רמה בא לך?
          </h1>
          <p style={{ fontSize: 14, color: "#6b6b80", marginBottom: 24, lineHeight: 1.5 }}>
            כל התוכניות כוללות AI ו-sync בין מכשירים
          </p>

          {/* Plan cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {plans.map((plan, i) => {
              const isSel = selected === plan.id;
              return (
                <div
                  key={plan.id}
                  onClick={() => setSelected(plan.id)}
                  style={{
                    padding: "14px 16px", borderRadius: 14,
                    background: isSel ? "#fdf2f8" : "transparent",
                    border: isSel ? "2px solid #ec4899" : "2px solid #e2e2ea",
                    cursor: "pointer", transition: "all .25s", position: "relative",
                    animation: `mtSlideUp .5s cubic-bezier(0.34,1.3,0.64,1) ${0.4 + i * 0.08}s both`,
                  }}
                >
                  {plan.recommended && (
                    <div style={{
                      position: "absolute", top: -9, left: 14,
                      background: GRADIENT, color: "#fff",
                      fontSize: 10, fontWeight: 600, letterSpacing: ".06em",
                      padding: "3px 9px", borderRadius: 999,
                      boxShadow: "0 4px 10px -2px rgba(236,72,153,.5)",
                    }}>מומלץ</div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isSel ? 0 : 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                      <span style={{ fontSize: 20, fontWeight: 600, color: "#111118", letterSpacing: "-.5px" }}>{plan.price}</span>
                      <span style={{ fontSize: 11, color: "#6b6b80" }}>₪/ח</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                        border: isSel ? "none" : "2px solid #e2e2ea",
                        background: isSel ? "#ec4899" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {isSel && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#111118" }}>{plan.name}</div>
                        <div style={{ fontSize: 11, color: "#6b6b80" }}>{plan.subtitle}</div>
                      </div>
                    </div>
                  </div>
                  {isSel && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 10, paddingTop: 10, borderTop: "1px solid #e2e2ea" }}>
                      {plan.features.map((f, j) => (
                        <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#111118", justifyContent: "flex-end" }}>
                          <span>{f}</span>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" fill="#ec4899" />
                            <path d="M8 12l3 3 5-6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <button
            onClick={handleContinue}
            disabled={submitting}
            style={{
              width: "100%", padding: "14px 18px", borderRadius: 12,
              background: submitting ? "#f3e8ff" : GRADIENT,
              backgroundSize: "200% 200%",
              animation: submitting ? "none" : "mtGradShift 6s ease infinite",
              color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 600,
              border: "none", cursor: submitting ? "not-allowed" : "pointer",
              boxShadow: submitting ? "none" : "0 12px 28px -8px rgba(236,72,153,.5)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            <span>{submitting ? "שומרת..." : "המשיכי"}</span>
            {!submitting && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "rotate(180deg)" }}>
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </button>

          {/* Login link */}
          <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: "#f59e0b", fontWeight: 600, animation: "mtFadeIn .5s ease 1s both" }}>
            <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} style={{ color: "#f59e0b", textDecoration: "underline", cursor: "pointer" }}>
              יש לך כבר חשבון? לחצי כאן להתחברות
            </a>
          </div>

          {/* Progress dots */}
          <div style={{ display: "flex", gap: 5, justifyContent: "center", marginTop: 14 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 24, height: 5, borderRadius: 3, background: i === 1 ? GRADIENT : "#e2e2ea" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
