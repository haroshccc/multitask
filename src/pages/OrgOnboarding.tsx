import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/lib/supabase/client";

const GRADIENT =
  "linear-gradient(135deg, #f59e0b 0%, #f472b6 25%, #ec4899 50%, #db2777 75%, #be185d 100%)";

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

const BuildingIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18" />
    <path d="M3 9h6" />
    <path d="M3 15h6" />
    <path d="M13 7h5" />
    <path d="M13 12h5" />
    <path d="M13 17h5" />
  </svg>
);

const UsersIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

type Mode = "create" | "join" | null;
type OrgType = "business" | "family" | "personal";

export function OrgOnboarding() {
  const navigate = useNavigate();
  const { session, loading, refreshProfile } = useAuth();

  const [mode, setMode] = useState<Mode>(null);

  // Create org state
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createShowPassword, setCreateShowPassword] = useState(false);
  const [orgType, setOrgType] = useState<OrgType>("business");
  const [createError, setCreateError] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Join org state
  const [joinName, setJoinName] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joinShowPassword, setJoinShowPassword] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [joinSubmitting, setJoinSubmitting] = useState(false);

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

  const handleCreate = async () => {
    setCreateError("");
    setCreateSubmitting(true);
    try {
      const { error } = await supabase.rpc(
        "create_organization_with_password",
        {
          p_name: createName,
          p_join_password: createPassword,
          p_suggested_email_domain: undefined,
          p_org_type: orgType,
        }
      );
      if (error) {
        setCreateError(error.message || "אירעה שגיאה. נסי שוב.");
        setCreateSubmitting(false);
        return;
      }
      await refreshProfile();
      navigate("/app");
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
      const { error } = await (supabase as any).rpc(
        "join_organization_by_name_and_password",
        {
          p_name: joinName,
          p_join_password: joinPassword,
        }
      );
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
      navigate("/app");
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

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "row-reverse",
        fontFamily:
          "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
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
              id="dots-org"
              x="0"
              y="0"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="1.5" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots-org)" />
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
              margin: "0 0 8px",
              letterSpacing: "-0.03em",
            }}
          >
            לבד? עם צוות?
          </h1>
          <h2
            style={{
              color: "white",
              fontSize: "clamp(1.4rem, 2.5vw, 1.9rem)",
              fontWeight: 700,
              lineHeight: 1.2,
              margin: "0 0 16px",
              letterSpacing: "-0.02em",
              opacity: 0.92,
            }}
          >
            את מחליטה.
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.82)",
              fontSize: 15,
              margin: "0 0 48px",
              lineHeight: 1.65,
              maxWidth: 340,
            }}
          >
            multitask עובד מצוין לבד, אבל הופך לעוצמתי במיוחד עם הצוות שלך.
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
          ✦ שלב 2 מתוך 2
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
            ארגון (אופציונלי)
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: "clamp(1.6rem, 2.5vw, 2rem)",
              fontWeight: 800,
              color: "#111827",
              margin: "0 0 8px",
              letterSpacing: "-0.03em",
              animation: "mtSlideLeft 0.6s ease 0.05s both",
            }}
          >
            איך נתחיל?
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "#6b7280",
              margin: "0 0 28px",
              lineHeight: 1.55,
              animation: "mtSlideLeft 0.6s ease 0.08s both",
            }}
          >
            תמיד אפשר להצטרף לארגון בהמשך מההגדרות
          </p>

          {/* Mode: initial selection */}
          {mode === null && (
            <div style={{ animation: "mtSlideLeft 0.55s ease 0.1s both" }}>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {/* Card: Create org */}
                <button
                  onClick={() => setMode("create")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    textAlign: "right",
                    background: "white",
                    border: "2px solid #e5e7eb",
                    borderRadius: 16,
                    padding: "18px 20px",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                    outline: "none",
                    width: "100%",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#f9a8d4";
                    e.currentTarget.style.background = "#fff7fb";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e5e7eb";
                    e.currentTarget.style.background = "white";
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background:
                        "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ec4899",
                      flexShrink: 0,
                    }}
                  >
                    <BuildingIcon />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#111827",
                        marginBottom: 3,
                      }}
                    >
                      צרי ארגון חדש
                    </div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                      עבודה עם צוות, משפחה, או קבוצה
                    </div>
                  </div>
                  <span style={{ color: "#9ca3af", fontSize: 18 }}>←</span>
                </button>

                {/* Card: Join org */}
                <button
                  onClick={() => setMode("join")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    textAlign: "right",
                    background: "white",
                    border: "2px solid #e5e7eb",
                    borderRadius: 16,
                    padding: "18px 20px",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                    outline: "none",
                    width: "100%",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#f9a8d4";
                    e.currentTarget.style.background = "#fff7fb";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e5e7eb";
                    e.currentTarget.style.background = "white";
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background:
                        "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ec4899",
                      flexShrink: 0,
                    }}
                  >
                    <UsersIcon />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#111827",
                        marginBottom: 3,
                      }}
                    >
                      הצטרפי לארגון קיים
                    </div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                      קיבלת הזמנה? יש לך שם וסיסמה?
                    </div>
                  </div>
                  <span style={{ color: "#9ca3af", fontSize: 18 }}>←</span>
                </button>
              </div>

              {/* Skip link */}
              <div style={{ textAlign: "center", marginTop: 24 }}>
                <button
                  onClick={() => navigate("/app")}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#9ca3af",
                    fontSize: 14,
                    fontWeight: 500,
                    padding: "4px 8px",
                    transition: "color 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#6b7280";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#9ca3af";
                  }}
                >
                  המשיכי לבד ←
                </button>
              </div>
            </div>
          )}

          {/* Mode: create org */}
          {mode === "create" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 18,
                animation: "mtSlideLeft 0.45s ease both",
              }}
            >
              {/* Org name */}
              <div>
                <label style={labelStyle}>שם הארגון</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="לדוגמה: Acme Inc"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#ec4899";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#e5e7eb";
                  }}
                />
              </div>

              {/* Org type */}
              <div>
                <label style={labelStyle}>סוג הארגון</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {orgTypeButtons.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setOrgType(value)}
                      style={{
                        flex: 1,
                        padding: "10px 0",
                        border:
                          orgType === value
                            ? "2px solid #ec4899"
                            : "2px solid #e5e7eb",
                        borderRadius: 10,
                        background:
                          orgType === value ? "#fdf2f8" : "white",
                        color:
                          orgType === value ? "#be185d" : "#374151",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        outline: "none",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={labelStyle}>סיסמת הצטרפות</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={createShowPassword ? "text" : "password"}
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="סיסמה לאחרים להצטרף"
                    style={{ ...inputStyle, paddingLeft: 44 }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#ec4899";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#e5e7eb";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setCreateShowPassword((v) => !v)}
                    style={{
                      position: "absolute",
                      left: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#9ca3af",
                      fontSize: 13,
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    {createShowPassword ? "הסתר" : "הצג"}
                  </button>
                </div>
              </div>

              {/* Error */}
              {createError && (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 10,
                    padding: "10px 14px",
                    color: "#dc2626",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {createError}
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleCreate}
                disabled={createSubmitting || !createName.trim()}
                style={{
                  width: "100%",
                  padding: "15px 0",
                  background:
                    createSubmitting || !createName.trim()
                      ? "#f3e8ff"
                      : GRADIENT,
                  backgroundSize: "200% 200%",
                  animation:
                    createSubmitting || !createName.trim()
                      ? "none"
                      : "mtGradShift 6s ease infinite",
                  border: "none",
                  borderRadius: 14,
                  color: "white",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor:
                    createSubmitting || !createName.trim()
                      ? "not-allowed"
                      : "pointer",
                  boxShadow:
                    createSubmitting || !createName.trim()
                      ? "none"
                      : "0 4px 20px rgba(236, 72, 153, 0.35)",
                  transition: "opacity 0.15s ease",
                  opacity: createSubmitting || !createName.trim() ? 0.6 : 1,
                }}
              >
                {createSubmitting ? "יוצרת..." : "צרי ארגון"}
              </button>

              {/* Back */}
              <button
                onClick={() => {
                  setMode(null);
                  setCreateError("");
                  setCreateName("");
                  setCreatePassword("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#9ca3af",
                  fontSize: 14,
                  fontWeight: 500,
                  padding: "4px 0",
                  textAlign: "center",
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#6b7280";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#9ca3af";
                }}
              >
                ← חזרה
              </button>
            </div>
          )}

          {/* Mode: join org */}
          {mode === "join" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 18,
                animation: "mtSlideLeft 0.45s ease both",
              }}
            >
              {/* Org name */}
              <div>
                <label style={labelStyle}>שם הארגון</label>
                <input
                  type="text"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  placeholder="שם הארגון שקיבלת"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#ec4899";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#e5e7eb";
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <label style={labelStyle}>סיסמת הצטרפות</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={joinShowPassword ? "text" : "password"}
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder="הסיסמה שקיבלת"
                    style={{ ...inputStyle, paddingLeft: 44 }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#ec4899";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#e5e7eb";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setJoinShowPassword((v) => !v)}
                    style={{
                      position: "absolute",
                      left: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#9ca3af",
                      fontSize: 13,
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    {joinShowPassword ? "הסתר" : "הצג"}
                  </button>
                </div>
              </div>

              {/* Error */}
              {joinError && (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 10,
                    padding: "10px 14px",
                    color: "#dc2626",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {joinError}
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleJoin}
                disabled={
                  joinSubmitting || !joinName.trim() || !joinPassword.trim()
                }
                style={{
                  width: "100%",
                  padding: "15px 0",
                  background:
                    joinSubmitting || !joinName.trim() || !joinPassword.trim()
                      ? "#f3e8ff"
                      : GRADIENT,
                  backgroundSize: "200% 200%",
                  animation:
                    joinSubmitting || !joinName.trim() || !joinPassword.trim()
                      ? "none"
                      : "mtGradShift 6s ease infinite",
                  border: "none",
                  borderRadius: 14,
                  color: "white",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor:
                    joinSubmitting || !joinName.trim() || !joinPassword.trim()
                      ? "not-allowed"
                      : "pointer",
                  boxShadow:
                    joinSubmitting || !joinName.trim() || !joinPassword.trim()
                      ? "none"
                      : "0 4px 20px rgba(236, 72, 153, 0.35)",
                  transition: "opacity 0.15s ease",
                  opacity:
                    joinSubmitting || !joinName.trim() || !joinPassword.trim()
                      ? 0.6
                      : 1,
                }}
              >
                {joinSubmitting ? "מצטרפת..." : "הצטרפי"}
              </button>

              {/* Back */}
              <button
                onClick={() => {
                  setMode(null);
                  setJoinError("");
                  setJoinName("");
                  setJoinPassword("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#9ca3af",
                  fontSize: 14,
                  fontWeight: 500,
                  padding: "4px 0",
                  textAlign: "center",
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#6b7280";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#9ca3af";
                }}
              >
                ← חזרה
              </button>
            </div>
          )}

          {/* Progress dots */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 8,
              marginTop: 32,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: i === 2 ? 24 : 8,
                  height: 8,
                  borderRadius: 100,
                  background:
                    i === 2
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
