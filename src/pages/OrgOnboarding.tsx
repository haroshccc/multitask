import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/lib/supabase/client";

const GRADIENT = "linear-gradient(135deg, #f59e0b 0%, #f472b6 25%, #ec4899 50%, #db2777 75%, #be185d 100%)";

const MLogo = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 14, animation: "mtSlideRight .7s cubic-bezier(0.34,1.3,0.64,1) both" }}>
    <div style={{ width: 46, height: 46, borderRadius: 11, background: "rgba(255,255,255,.95)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="24" height="26" viewBox="0 0 100 110" fill="none" stroke="#ec4899" strokeWidth="13" strokeLinecap="butt">
        <path d="M 10 100 L 10 10" /><path d="M 10 10 L 50 60" /><path d="M 50 60 L 90 10" />
        <path d="M 90 10 L 90 65" /><path d="M 50 60 L 90 100" /><path d="M 90 65 L 90 100" />
      </svg>
    </div>
    <span style={{ fontSize: 24, fontWeight: 600, color: "#fff", letterSpacing: "-.5px", fontFamily: "Fredoka, sans-serif" }}>multitask</span>
  </div>
);

type Mode = "create" | "join" | null;
type OrgType = "business" | "family" | "personal";

export function OrgOnboarding() {
  const navigate = useNavigate();
  const { session, loading, refreshProfile } = useAuth();

  const [mode, setMode] = useState<Mode>(null);

  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createShowPassword, setCreateShowPassword] = useState(false);
  const [orgType, setOrgType] = useState<OrgType>("business");
  const [createError, setCreateError] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [joinName, setJoinName] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joinShowPassword, setJoinShowPassword] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [joinSubmitting, setJoinSubmitting] = useState(false);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 28, height: 28, border: "3px solid #f3e8ff", borderTop: "3px solid #ec4899", borderRadius: "50%", animation: "mtSpin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (!session) return <Navigate to="/" replace />;

  const handleCreate = async () => {
    setCreateError("");
    setCreateSubmitting(true);
    try {
      const { error } = await supabase.rpc("create_organization_with_password", {
        p_name: createName,
        p_join_password: createPassword,
        p_suggested_email_domain: undefined,
        p_org_type: orgType,
      });
      if (error) {
        setCreateError(error.message || "אירעה שגיאה. נסי שוב.");
        setCreateSubmitting(false);
        return;
      }
      await refreshProfile();
      navigate("/welcome", { replace: true });
    } catch {
      setCreateError("אירעה שגיאה. נסי שוב.");
      setCreateSubmitting(false);
    }
  };

  const handleJoin = async () => {
    setJoinError("");
    setJoinSubmitting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("join_organization_by_name_and_password", {
        p_name: joinName,
        p_join_password: joinPassword,
      });
      if (error) {
        const msg = error.message || "";
        if (msg.includes("org_not_found")) {
          setJoinError("לא מצאנו ארגון עם השם הזה.");
        } else if (msg.includes("wrong_password")) {
          setJoinError("הסיסמה שגויה. בדקי שוב.");
        } else {
          setJoinError("אירעה שגיאה. נסי שוב.");
        }
        setJoinSubmitting(false);
        return;
      }
      await refreshProfile();
      navigate("/welcome", { replace: true });
    } catch {
      setJoinError("אירעה שגיאה. נסי שוב.");
      setJoinSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    border: "2px solid #e5e7eb",
    borderRadius: 12,
    fontSize: 15,
    color: "#111827",
    background: "white",
    outline: "none",
    transition: "border-color 0.15s ease",
    boxSizing: "border-box",
    direction: "rtl",
    fontFamily: "Fredoka, sans-serif",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 6,
  };

  const orgTypeButtons: { value: OrgType; label: string }[] = [
    { value: "business", label: "עסקי" },
    { value: "family", label: "משפחתי" },
    { value: "personal", label: "אחר" },
  ];

  const submitBtnStyle = (disabled: boolean): React.CSSProperties => ({
    width: "100%",
    padding: "14px 18px",
    borderRadius: 12,
    background: disabled ? "#f3e8ff" : GRADIENT,
    backgroundSize: "200% 200%",
    animation: disabled ? "none" : "mtGradShift 6s ease infinite",
    border: "none",
    color: "white",
    fontFamily: "Fredoka, sans-serif",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 12px 28px -8px rgba(236,72,153,.5)",
    opacity: disabled ? 0.7 : 1,
    transition: "opacity 0.15s ease",
  });

  return (
    <div dir="rtl" style={{
      minHeight: "100vh", display: "flex", flexDirection: "row-reverse",
      fontFamily: "Fredoka, sans-serif", overflow: "hidden",
    }}>
      {/* LEFT: Hero panel */}
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
            <pattern id="dots-org" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.2" fill="rgba(255,255,255,.18)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots-org)" />
        </svg>

        {/* Decorative circle top-right */}
        <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", border: "2px solid rgba(255,255,255,.18)", right: -110, top: -110, animation: "mtSpin 30s linear infinite" }} />
        {/* Rotating diamond */}
        <div style={{ position: "absolute", width: 170, height: 170, border: "2px solid rgba(255,255,255,.22)", right: "20%", top: "50%", transform: "rotate(45deg)", animation: "mtSpin 22s linear infinite reverse" }} />
        {/* Floating blurred square */}
        <div style={{ position: "absolute", width: 120, height: 120, borderRadius: 30, background: "rgba(255,255,255,.18)", backdropFilter: "blur(18px)", left: "14%", bottom: "20%", animation: "mtFloat 8s ease-in-out infinite" }} />

        {/* Logo */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <MLogo />
        </div>

        {/* Bottom copy */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.85, marginBottom: 18, animation: "mtFadeIn .6s ease .4s both" }}>
            🤝 שלב 3 מתוך 3
          </div>
          <h2 style={{ fontSize: 54, fontWeight: 600, lineHeight: 1.05, letterSpacing: "-1.5px", marginBottom: 24 }}>
            <div style={{ overflow: "hidden" }}>
              <div style={{ animation: "mtSlideUp .8s cubic-bezier(0.25,0.46,0.45,0.94) .5s both" }}>לבד? עם צוות?</div>
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ animation: "mtSlideUp .8s cubic-bezier(0.25,0.46,0.45,0.94) .7s both" }}>את מחליטה.</div>
            </div>
          </h2>
          <p style={{ fontSize: 17, opacity: 0.92, maxWidth: 400, lineHeight: 1.5, animation: "mtFadeIn .8s ease .9s both" }}>
            multitask עובד מצוין לבד, אבל הופך לעוצמתי במיוחד עם הצוות שלך.
          </p>
        </div>
      </div>

      {/* RIGHT: Form panel */}
      <div style={{
        flex: 1, background: "white",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "56px", overflowY: "auto",
      }}>
        <div style={{ maxWidth: 400, width: "100%", animation: "mtSlideLeft .7s cubic-bezier(0.34,1.3,0.64,1) .2s both" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#ec4899", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 10 }}>
            ארגון <span style={{ color: "#6b6b80", fontWeight: 500 }}>(אופציונלי)</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 600, color: "#111118", letterSpacing: "-1px", marginBottom: 8, lineHeight: 1.15 }}>
            איך נתחיל?
          </h1>
          <p style={{ fontSize: 14, color: "#6b6b80", marginBottom: 24, lineHeight: 1.5 }}>
            תמיד אפשר להצטרף לארגון בהמשך מההגדרות
          </p>

          {/* Mode: initial card selection */}
          {mode === null && (
            <div style={{ animation: "mtSlideLeft 0.55s ease 0.1s both" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                <div
                  onClick={() => setMode("create")}
                  onMouseEnter={(e) => { const el = e.currentTarget; el.style.borderColor = "#ec4899"; el.style.background = "#fdf2f8"; }}
                  onMouseLeave={(e) => { const el = e.currentTarget; el.style.borderColor = "#e2e2ea"; el.style.background = "transparent"; }}
                  style={{ padding: "18px", borderRadius: 14, background: "transparent", border: "2px solid #e2e2ea", cursor: "pointer", transition: "all .25s", display: "flex", alignItems: "center", gap: 14, animation: "mtSlideUp .55s cubic-bezier(0.34,1.3,0.64,1) .4s both" }}
                >
                  <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: "#fdf2f8", color: "#ec4899", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="3" width="16" height="18" rx="2"/>
                      <path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1, textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#111118", marginBottom: 3 }}>צרי ארגון חדש</div>
                    <div style={{ fontSize: 12, color: "#6b6b80", lineHeight: 1.4 }}>עבודה עם צוות, משפחה, או קבוצה</div>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b6b80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6"/>
                  </svg>
                </div>

                <div
                  onClick={() => setMode("join")}
                  onMouseEnter={(e) => { const el = e.currentTarget; el.style.borderColor = "#ec4899"; el.style.background = "#fdf2f8"; }}
                  onMouseLeave={(e) => { const el = e.currentTarget; el.style.borderColor = "#e2e2ea"; el.style.background = "transparent"; }}
                  style={{ padding: "18px", borderRadius: 14, background: "transparent", border: "2px solid #e2e2ea", cursor: "pointer", transition: "all .25s", display: "flex", alignItems: "center", gap: 14, animation: "mtSlideUp .55s cubic-bezier(0.34,1.3,0.64,1) .5s both" }}
                >
                  <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: "#fdf2f8", color: "#ec4899", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="8" r="3.5"/>
                      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
                      <circle cx="17" cy="9" r="2.5"/>
                      <path d="M14 15c0-2 1.5-3.5 3-3.5s3 1.5 3 3.5"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1, textAlign: "right" }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#111118", marginBottom: 3 }}>הצטרפי לארגון קיים</div>
                    <div style={{ fontSize: 12, color: "#6b6b80", lineHeight: 1.4 }}>קיבלת הזמנה? יש לך שם וסיסמה?</div>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b6b80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6"/>
                  </svg>
                </div>
              </div>

              <button
                onClick={() => navigate("/app")}
                style={{ width: "100%", background: "transparent", border: "none", color: "#6b6b80", fontFamily: "inherit", fontSize: 13, fontWeight: 500, cursor: "pointer", padding: "10px", transition: "color .2s", animation: "mtFadeIn .5s ease .8s both" }}
              >
                המשיכי לבד ←
              </button>
            </div>
          )}

          {/* Mode: create org */}
          {mode === "create" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18, animation: "mtSlideLeft 0.45s ease both" }}>
              <div>
                <label style={labelStyle}>שם הארגון</label>
                <input type="text" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="לדוגמה: Acme Inc" style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#ec4899"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
                />
              </div>
              <div>
                <label style={labelStyle}>סוג הארגון</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {orgTypeButtons.map(({ value, label }) => (
                    <button key={value} onClick={() => setOrgType(value)} style={{ flex: 1, padding: "10px 0", border: orgType === value ? "2px solid #ec4899" : "2px solid #e5e7eb", borderRadius: 10, background: orgType === value ? "#fdf2f8" : "white", color: orgType === value ? "#be185d" : "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s ease", outline: "none", fontFamily: "inherit" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>סיסמת הצטרפות</label>
                <div style={{ position: "relative" }}>
                  <input type={createShowPassword ? "text" : "password"} value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} placeholder="סיסמה לאחרים להצטרף" style={{ ...inputStyle, paddingLeft: 44 }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#ec4899"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
                  />
                  <button type="button" onClick={() => setCreateShowPassword((v) => !v)} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 13, padding: 0, lineHeight: 1 }}>
                    {createShowPassword ? "הסתר" : "הצג"}
                  </button>
                </div>
              </div>
              {createError && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", color: "#dc2626", fontSize: 13, fontWeight: 500 }}>{createError}</div>
              )}
              <button onClick={handleCreate} disabled={createSubmitting || !createName.trim()} style={submitBtnStyle(createSubmitting || !createName.trim())}>
                {createSubmitting ? "יוצרת..." : "צרי ארגון"}
              </button>
              <button onClick={() => { setMode(null); setCreateError(""); setCreateName(""); setCreatePassword(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontFamily: "inherit", fontSize: 13, fontWeight: 500, padding: "4px 0", textAlign: "center" }}>
                ← חזרה
              </button>
            </div>
          )}

          {/* Mode: join org */}
          {mode === "join" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18, animation: "mtSlideLeft 0.45s ease both" }}>
              <div>
                <label style={labelStyle}>שם הארגון</label>
                <input type="text" value={joinName} onChange={(e) => setJoinName(e.target.value)} placeholder="שם הארגון שקיבלת" style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#ec4899"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
                />
              </div>
              <div>
                <label style={labelStyle}>סיסמת הצטרפות</label>
                <div style={{ position: "relative" }}>
                  <input type={joinShowPassword ? "text" : "password"} value={joinPassword} onChange={(e) => setJoinPassword(e.target.value)} placeholder="הסיסמה שקיבלת" style={{ ...inputStyle, paddingLeft: 44 }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#ec4899"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
                  />
                  <button type="button" onClick={() => setJoinShowPassword((v) => !v)} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 13, padding: 0, lineHeight: 1 }}>
                    {joinShowPassword ? "הסתר" : "הצג"}
                  </button>
                </div>
              </div>
              {joinError && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", color: "#dc2626", fontSize: 13, fontWeight: 500 }}>{joinError}</div>
              )}
              <button onClick={handleJoin} disabled={joinSubmitting || !joinName.trim() || !joinPassword.trim()} style={submitBtnStyle(joinSubmitting || !joinName.trim() || !joinPassword.trim())}>
                {joinSubmitting ? "מצטרפת..." : "הצטרפי"}
              </button>
              <button onClick={() => { setMode(null); setJoinError(""); setJoinName(""); setJoinPassword(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontFamily: "inherit", fontSize: 13, fontWeight: 500, padding: "4px 0", textAlign: "center" }}>
                ← חזרה
              </button>
            </div>
          )}

          {/* Login link */}
          <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: "#f59e0b", fontWeight: 600, animation: "mtFadeIn .5s ease 1s both" }}>
            <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} style={{ color: "#f59e0b", textDecoration: "underline", cursor: "pointer" }}>
              יש לך כבר חשבון? לחצי כאן להתחברות
            </a>
          </div>

          {/* Progress dots */}
          <div style={{ display: "flex", gap: 5, justifyContent: "center", marginTop: 14 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 24, height: 5, borderRadius: 3, background: i === 2 ? GRADIENT : "#e2e2ea" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
