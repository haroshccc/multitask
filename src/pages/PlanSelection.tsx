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

const MLogo = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      animation: "mtSlideRight 0.7s ease both",
    }}
  >
    <div
      style={{
        width: 44,
        height: 44,
        background: "rgba(255,255,255,0.15)",
        backdropFilter: "blur(8px)",
        borderRadius: 12,
        border: "1.5px solid rgba(255,255,255,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width="24"
        height="26"
        viewBox="0 0 100 110"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="13"
        strokeLinecap="butt"
      >
        <path d="M 10 100 L 10 10" />
        <path d="M 10 10 L 50 60" />
        <path d="M 50 60 L 90 10" />
        <path d="M 90 10 L 90 65" />
        <path d="M 50 60 L 90 100" />
        <path d="M 90 65 L 90 100" />
      </svg>
    </div>
    <span
      style={{
        color: "white",
        fontWeight: 700,
        fontSize: 18,
        letterSpacing: "-0.02em",
      }}
    >
      multitask
    </span>
  </div>
);

export function PlanSelection() {
  const navigate = useNavigate();
  const { session, loading, profile, refreshProfile } = useAuth();
  const [selected, setSelected] = useState<"free" | "pro" | "enterprise">("pro");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            border: "3px solid #f3e8ff",
            borderTop: "3px solid #ec4899",
            borderRadius: "50%",
            animation: "mtSpin 0.8s linear infinite",
          }}
        />
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
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "row-reverse",
        fontFamily: "Fredoka, Rubik, 'Segoe UI', sans-serif",
        overflow: "hidden",
      }}
    >
      {/* LEFT: Hero panel */}
      <div
        style={{
          flex: 1.05,
          background: GRADIENT,
          backgroundSize: "200% 200%",
          animation: "mtGradShift 10s ease infinite",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px 52px",
          overflow: "hidden",
        }}
      >
        {/* Dotted SVG pattern */}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: 0.12,
            pointerEvents: "none",
          }}
        >
          <defs>
            <pattern
              id="dots"
              x="0"
              y="0"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="1.5" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        {/* Spinning circle 1 */}
        <div
          style={{
            position: "absolute",
            top: -80,
            left: -80,
            width: 320,
            height: 320,
            borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.2)",
            animation: "mtSpin 18s linear infinite",
          }}
        />
        {/* Spinning circle 2 */}
        <div
          style={{
            position: "absolute",
            bottom: -100,
            right: -60,
            width: 260,
            height: 260,
            borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.15)",
            animation: "mtSpin 24s linear infinite reverse",
          }}
        />
        {/* Floating blurred square */}
        <div
          style={{
            position: "absolute",
            bottom: 120,
            left: 40,
            width: 80,
            height: 80,
            background: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(12px)",
            borderRadius: 20,
            animation: "mtFloat 5s ease-in-out infinite",
          }}
        />

        {/* Logo */}
        <div style={{ marginBottom: 52 }}>
          <MLogo />
        </div>

        {/* Headline */}
        <div style={{ animation: "mtSlideUp 0.8s ease 0.1s both" }}>
          <h1
            style={{
              color: "white",
              fontSize: "clamp(2rem, 3.5vw, 2.75rem)",
              fontWeight: 800,
              lineHeight: 1.15,
              margin: "0 0 16px",
              letterSpacing: "-0.03em",
            }}
          >
            איזו רמה בא לך?
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.82)",
              fontSize: 16,
              margin: "0 0 48px",
              lineHeight: 1.6,
              maxWidth: 340,
            }}
          >
            כל התוכניות כוללות AI ו-sync בין מכשירים
          </p>
        </div>

        {/* Step indicator */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,0.15)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 100,
            padding: "8px 16px",
            fontSize: 13,
            color: "white",
            fontWeight: 600,
            width: "fit-content",
            animation: "mtFadeIn 1s ease 0.4s both",
          }}
        >
          ✦ שלב 1 מתוך 2
        </div>
      </div>

      {/* RIGHT: Form panel */}
      <div
        style={{
          flex: 1,
          background: "white",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 48px",
          overflowY: "auto",
        }}
      >
        <div style={{ width: "100%", maxWidth: 440 }}>
          {/* Label */}
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "#ec4899",
              textTransform: "uppercase",
              marginBottom: 12,
              animation: "mtSlideLeft 0.6s ease both",
            }}
          >
            תוכניות
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: "clamp(1.6rem, 2.5vw, 2rem)",
              fontWeight: 800,
              color: "#111827",
              margin: "0 0 32px",
              letterSpacing: "-0.03em",
              animation: "mtSlideLeft 0.6s ease 0.05s both",
            }}
          >
            איזו רמה בא לך?
          </h1>

          {/* Plan cards */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginBottom: 32,
            }}
          >
            {plans.map((plan, i) => {
              const isSelected = selected === plan.id;
              return (
                <button
                  key={plan.id}
                  onClick={() => setSelected(plan.id)}
                  style={{
                    position: "relative",
                    textAlign: "right",
                    background: isSelected ? "#fdf2f8" : "white",
                    border: isSelected
                      ? "2px solid #ec4899"
                      : "2px solid #e5e7eb",
                    borderRadius: 16,
                    padding: "16px 20px",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                    animation: `mtSlideLeft 0.55s ease ${0.08 + i * 0.07}s both`,
                    outline: "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "#f9a8d4";
                      (e.currentTarget as HTMLButtonElement).style.background = "#fff7fb";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb";
                      (e.currentTarget as HTMLButtonElement).style.background = "white";
                    }
                  }}
                >
                  {/* Recommended badge */}
                  {plan.recommended && (
                    <span
                      style={{
                        position: "absolute",
                        top: -11,
                        left: 16,
                        background: GRADIENT,
                        backgroundSize: "200% 200%",
                        animation: "mtGradShift 6s ease infinite",
                        color: "white",
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 10px",
                        borderRadius: 100,
                        letterSpacing: "0.04em",
                      }}
                    >
                      מומלץ
                    </span>
                  )}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ textAlign: "left" }}>
                      <span
                        style={{
                          fontSize: 22,
                          fontWeight: 800,
                          color: isSelected ? "#be185d" : "#111827",
                          lineHeight: 1,
                        }}
                      >
                        {plan.price}
                        <span
                          style={{ fontSize: 14, fontWeight: 600, marginRight: 2 }}
                        >
                          ₪
                        </span>
                      </span>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#9ca3af",
                          marginTop: 2,
                        }}
                      >
                        /חודש
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: isSelected ? "#be185d" : "#111827",
                          marginBottom: 2,
                        }}
                      >
                        {plan.name}
                      </div>
                      <div style={{ fontSize: 13, color: "#6b7280" }}>
                        {plan.subtitle}
                      </div>
                    </div>
                  </div>

                  <ul
                    style={{
                      margin: 0,
                      padding: 0,
                      listStyle: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        style={{
                          fontSize: 13,
                          color: isSelected ? "#9d174d" : "#4b5563",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          justifyContent: "flex-end",
                        }}
                      >
                        {f}
                        <span
                          style={{
                            color: isSelected ? "#ec4899" : "#9ca3af",
                            fontSize: 14,
                            flexShrink: 0,
                          }}
                        >
                          ✓
                        </span>
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          {/* CTA */}
          <button
            onClick={handleContinue}
            disabled={submitting}
            style={{
              width: "100%",
              padding: "15px 0",
              background: submitting ? "#f3e8ff" : GRADIENT,
              backgroundSize: "200% 200%",
              animation: submitting ? "none" : "mtGradShift 6s ease infinite",
              border: "none",
              borderRadius: 14,
              color: "white",
              fontSize: 16,
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              letterSpacing: "0.01em",
              boxShadow: submitting
                ? "none"
                : "0 4px 20px rgba(236, 72, 153, 0.35)",
              transition: "opacity 0.15s ease",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "שומרת..." : "המשיכי ←"}
          </button>

          {/* Progress dots */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
              marginTop: 28,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: i === 1 ? 24 : 8,
                  height: 8,
                  borderRadius: 100,
                  background:
                    i === 1
                      ? "linear-gradient(90deg, #ec4899, #db2777)"
                      : "#e5e7eb",
                  transition: "all 0.3s ease",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
