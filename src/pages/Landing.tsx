import { useRef, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type IconName =
  | "folder"
  | "bulb"
  | "mic"
  | "gantt"
  | "calendar"
  | "check"
  | "home"
  | "target"
  | "settings";

interface FloatingIconDef {
  icon: IconName;
  x: number;
  y: number;
  size: number;
  delay: number;
  dur: number;
  journey: 1 | 2 | 3;
}

interface MousePos {
  x: number;
  y: number;
}

// ─── SVG icon paths ───────────────────────────────────────────────────────────

const ICON_PATHS: Record<IconName, JSX.Element> = {
  folder: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M8 13h8" />
    </g>
  ),
  bulb: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" />
    </g>
  ),
  mic: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </g>
  ),
  gantt: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 6h7" />
      <path d="M9 12h9" />
      <path d="M7 18h8" />
      <circle cx="14" cy="6" r="1.4" />
      <circle cx="6" cy="12" r="1.4" />
      <circle cx="17" cy="18" r="1.4" />
    </g>
  ),
  calendar: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4M16 3v4" />
      <circle cx="16" cy="15" r="1" fill="currentColor" />
    </g>
  ),
  check: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 12l3 3 5-6" />
    </g>
  ),
  target: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </g>
  ),
  settings: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </g>
  ),
  home: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-9z" />
    </g>
  ),
};

// ─── Floating icon definitions ────────────────────────────────────────────────

const FLOATING_ICONS: FloatingIconDef[] = [
  { icon: "folder",   x: 14, y: 20, size: 84,  delay: 0.2, dur: 16,   journey: 1 },
  { icon: "bulb",     x: 78, y: 12, size: 50,  delay: 0.6, dur: 13,   journey: 2 },
  { icon: "mic",      x: 88, y: 58, size: 96,  delay: 0.4, dur: 18,   journey: 3 },
  { icon: "gantt",    x: 10, y: 60, size: 60,  delay: 1.0, dur: 14,   journey: 2 },
  { icon: "calendar", x: 62, y: 84, size: 72,  delay: 0.7, dur: 17,   journey: 1 },
  { icon: "check",    x: 28, y: 86, size: 42,  delay: 1.2, dur: 12,   journey: 3 },
  { icon: "home",     x: 48, y: 36, size: 56,  delay: 0.9, dur: 15,   journey: 2 },
  { icon: "target",   x: 82, y: 32, size: 78,  delay: 0.3, dur: 16.5, journey: 1 },
  { icon: "settings", x: 22, y: 38, size: 38,  delay: 0.5, dur: 14.5, journey: 2 },
  { icon: "bulb",     x: 92, y: 78, size: 32,  delay: 1.6, dur: 12.5, journey: 1 },
  { icon: "check",    x: 6,  y: 82, size: 30,  delay: 1.8, dur: 11.5, journey: 2 },
];

// ─── FloatingIcon component ───────────────────────────────────────────────────

interface FloatingIconProps {
  def: FloatingIconDef;
  mouseX: number;
  mouseY: number;
  depth: number;
}

function FloatingIcon({ def, mouseX, mouseY, depth }: FloatingIconProps) {
  const [hoverOffsetX, setHoverOffsetX] = useState(0);
  const [hoverRotation, setHoverRotation] = useState(0);
  const iconRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const direction = e.clientX < centerX ? -1 : 1;
    setHoverOffsetX(direction * 36);
    setHoverRotation(direction * 18);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setHoverOffsetX(0);
      setHoverRotation(0);
    }, 700);
  }, []);

  const animName = `mtIconJourney${def.journey}`;
  const parallaxX = mouseX * depth;
  const parallaxY = mouseY * depth;

  return (
    <div
      ref={iconRef}
      onMouseEnter={handleMouseEnter}
      style={{
        position: "absolute",
        left: `${def.x}%`,
        top: `${def.y}%`,
        width: def.size,
        height: def.size,
        color: "rgba(255,255,255,0.22)",
        animation: `${animName} ${def.dur}s ease-in-out ${def.delay}s infinite, mtFadeIn 0.8s ease ${def.delay}s both`,
        transform: `translate(${parallaxX + hoverOffsetX}px, ${parallaxY}px) rotate(${hoverRotation}deg)`,
        transition: "transform 0.6s cubic-bezier(0.34,1.56,0.64,1)",
        pointerEvents: "auto",
        cursor: "default",
        userSelect: "none",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="100%"
        height="100%"
        style={{ display: "block" }}
      >
        {ICON_PATHS[def.icon]}
      </svg>
    </div>
  );
}

// ─── Google G icon ────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

// ─── Main Landing component ───────────────────────────────────────────────────

export function Landing() {
  const { signInWithGoogle, session, loading } = useAuth();

  const leftPanelRef = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState<MousePos>({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!leftPanelRef.current) return;
    const rect = leftPanelRef.current.getBoundingClientRect();
    setMouse({
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: ((e.clientY - rect.top) / rect.height) * 2 - 1,
    });
  }, []);

  // ── Auth guards ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--mt-grad)",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            border: "3px solid rgba(255,255,255,0.3)",
            borderTopColor: "#fff",
            borderRadius: "50%",
            animation: "mtSpin 0.8s linear infinite",
          }}
        />
      </div>
    );
  }

  if (session) {
    return <Navigate to="/app" replace />;
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        fontFamily: "'Rubik', system-ui, sans-serif",
        direction: "rtl",
      }}
    >
      {/* ════════════════ LEFT HERO PANEL ════════════════ */}
      <div
        ref={leftPanelRef}
        onMouseMove={handleMouseMove}
        style={{
          flex: 1.1,
          position: "relative",
          background: "var(--mt-grad)",
          backgroundSize: "200% 200%",
          animation: "mtGradShift 10s ease infinite",
          padding: 56,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflow: "hidden",
        }}
      >
        {/* Dotted pattern overlay */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Floating icons layer */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            pointerEvents: "none",
          }}
        >
          {FLOATING_ICONS.map((def, i) => (
            <FloatingIcon
              key={i}
              def={def}
              mouseX={mouse.x}
              mouseY={mouse.y}
              depth={8 + (i % 4) * 4}
            />
          ))}
        </div>

        {/* ── Logo ── */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              animation: "mtSlideRight 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.1s both",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
                flexShrink: 0,
              }}
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 6h16M4 12h10M4 18h7" />
                <circle cx="19" cy="18" r="3" />
              </svg>
            </div>
            <span
              style={{
                color: "#fff",
                fontWeight: 700,
                fontSize: 22,
                letterSpacing: "-0.02em",
              }}
            >
              multitask
            </span>
          </div>
        </div>

        {/* ── Center headline ── */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            flex: 1,
            display: "flex",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ overflow: "hidden" }}>
              <h1
                style={{
                  margin: 0,
                  color: "#fff",
                  fontSize: "clamp(2.4rem, 4vw, 3.8rem)",
                  fontWeight: 800,
                  lineHeight: 1.15,
                  letterSpacing: "-0.03em",
                  animation:
                    "mtSlideUp 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.25s both",
                }}
              >
                כל החיים שלך
              </h1>
            </div>
            <div style={{ overflow: "hidden" }}>
              <h1
                style={{
                  margin: 0,
                  color: "rgba(255,255,255,0.88)",
                  fontSize: "clamp(2.4rem, 4vw, 3.8rem)",
                  fontWeight: 800,
                  lineHeight: 1.15,
                  letterSpacing: "-0.03em",
                  animation:
                    "mtSlideUp 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.38s both",
                }}
              >
                במקום אחד.
              </h1>
            </div>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            gap: 32,
            animation: "mtFadeIn 0.9s ease 0.7s both",
          }}
        >
          {(
            [
              { value: "12K+", label: "משתמשים" },
              { value: "2.4M", label: "משימות" },
              { value: "98%", label: "שביעות רצון" },
            ] as const
          ).map((stat, i) => (
            <div
              key={i}
              style={{ display: "flex", flexDirection: "column", gap: 2 }}
            >
              <span
                style={{
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 22,
                  letterSpacing: "-0.02em",
                }}
              >
                {stat.value}
              </span>
              <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════ RIGHT FORM PANEL ════════════════ */}
      <div
        style={{
          flex: 1,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 56,
          overflowY: "auto",
        }}
      >
        <div style={{ width: "100%", maxWidth: 360 }}>
          {/* Small "כניסה" label */}
          <span
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#f59e0b",
              marginBottom: 12,
              animation: "mtFadeIn 0.6s ease 0.2s both",
            }}
          >
            כניסה
          </span>

          {/* Heading */}
          <div style={{ overflow: "hidden", marginBottom: 8 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 32,
                fontWeight: 800,
                letterSpacing: "-0.025em",
                color: "#111827",
                animation:
                  "mtSlideLeft 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.3s both",
              }}
            >
              ברוכות הבאות 👋
            </h2>
          </div>

          {/* Subtitle */}
          <p
            style={{
              margin: "0 0 32px 0",
              color: "#6b7280",
              fontSize: 15,
              lineHeight: 1.6,
              animation: "mtFadeIn 0.6s ease 0.45s both",
            }}
          >
            התחברי באמצעות חשבון Google שלך
          </p>

          {/* Google OAuth button */}
          <GoogleButton onClick={() => void signInWithGoogle()} />

          {/* Divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "24px 0",
              animation: "mtFadeIn 0.6s ease 0.65s both",
            }}
          >
            <div style={{ flex: 1, height: 1, background: "#f3f4f6" }} />
            <span style={{ color: "#9ca3af", fontSize: 13 }}>או</span>
            <div style={{ flex: 1, height: 1, background: "#f3f4f6" }} />
          </div>

          {/* Security notice */}
          <div
            style={{
              borderRadius: 12,
              background: "#fefce8",
              border: "1px solid #fde68a",
              padding: "14px 16px",
              fontSize: 13,
              color: "#78350f",
              lineHeight: 1.6,
              animation: "mtFadeIn 0.6s ease 0.75s both",
            }}
          >
            🔒 לאבטחה מלאה — multitask עובד רק עם Google OAuth. לא נשמרות סיסמאות
            בשרתים שלנו.
          </div>

          {/* Footer CTA */}
          <p
            style={{
              marginTop: 28,
              textAlign: "center",
              fontSize: 14,
              color: "#6b7280",
              animation: "mtFadeIn 0.6s ease 0.85s both",
            }}
          >
            עוד אין לך חשבון?{" "}
            <span
              role="button"
              tabIndex={0}
              onClick={() => void signInWithGoogle()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") void signInWithGoogle();
              }}
              style={{
                color: "#f59e0b",
                fontWeight: 600,
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              התחל גם בחינם
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── GoogleButton (extracted to keep hover state local) ───────────────────────

function GoogleButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "14px 20px",
        borderRadius: 12,
        border: `1.5px solid ${hovered ? "#f59e0b" : "#e5e7eb"}`,
        background: "#fff",
        color: "#374151",
        fontSize: 15,
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: "pointer",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease",
        boxShadow: hovered
          ? "0 4px 20px rgba(245,158,11,0.18)"
          : "0 1px 4px rgba(0,0,0,0.06)",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        animation: "mtFadeIn 0.6s ease 0.55s both",
      }}
    >
      <GoogleIcon />
      המשך עם Google
    </button>
  );
}
