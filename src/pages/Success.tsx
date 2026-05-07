import { useMemo } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";

const CONFETTI_COLORS = [
  "#f59e0b", "#fb923c", "#f472b6", "#ec4899",
  "#db2777", "#be185d", "#facc15", "#a855f7",
  "#60a5fa", "#34d399",
];

interface ConfettiPiece {
  id: number;
  left: string;
  size: number;
  color: string;
  shape: "square" | "circle" | "rect";
  rotation: number;
  duration: string;
  delay: string;
}

function seededRand(seed: number) {
  // simple deterministic pseudo-random based on index
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function Success() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  const confetti: ConfettiPiece[] = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => {
      const r1 = seededRand(i * 3);
      const r2 = seededRand(i * 3 + 1);
      const r3 = seededRand(i * 3 + 2);
      const r4 = seededRand(i * 3 + 3);
      const r5 = seededRand(i * 3 + 4);
      const r6 = seededRand(i * 3 + 5);
      const shapes: ConfettiPiece["shape"][] = ["square", "circle", "rect"];
      return {
        id: i,
        left: `${r1 * 100}%`,
        size: 6 + Math.floor(r2 * 10),
        color: CONFETTI_COLORS[Math.floor(r3 * CONFETTI_COLORS.length)],
        shape: shapes[Math.floor(r4 * 3)],
        rotation: Math.floor(r5 * 360),
        duration: `${2.5 + r6 * 3}s`,
        delay: `${seededRand(i * 7) * 4}s`,
      };
    });
  }, []);

  if (loading) return null;
  if (!session) return <Navigate to="/" replace />;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background:
          "linear-gradient(135deg, #f59e0b 0%, #fb923c 18%, #f472b6 42%, #ec4899 64%, #db2777 86%, #be185d 100%)",
        backgroundSize: "300% 300%",
        animation: "mtGradShift 14s ease infinite",
        direction: "rtl",
      }}
    >
      {/* Dotted SVG overlay */}
      <svg
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.4,
          pointerEvents: "none",
        }}
      >
        <defs>
          <pattern
            id="mt-dots"
            x="0"
            y="0"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1.1" fill="white" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mt-dots)" />
      </svg>

      {/* Glow blob — top right */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "-120px",
          right: "-100px",
          width: "520px",
          height: "520px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,255,255,0.28) 0%, transparent 70%)",
          filter: "blur(40px)",
          animation: "mtFloat 7s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      {/* Glow blob — bottom left */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: "-100px",
          left: "-80px",
          width: "440px",
          height: "440px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(244,114,182,0.35) 0%, transparent 70%)",
          filter: "blur(40px)",
          animation: "mtFloat 9s ease-in-out infinite reverse",
          pointerEvents: "none",
        }}
      />

      {/* Confetti */}
      {confetti.map((piece) => {
        const baseStyle: React.CSSProperties = {
          position: "absolute",
          top: "-20px",
          left: piece.left,
          backgroundColor: piece.color,
          transform: `rotate(${piece.rotation}deg)`,
          animation: `mtConfettiFall ${piece.duration} ${piece.delay} linear infinite`,
          pointerEvents: "none",
        };

        if (piece.shape === "circle") {
          Object.assign(baseStyle, {
            width: piece.size,
            height: piece.size,
            borderRadius: "50%",
          });
        } else if (piece.shape === "rect") {
          Object.assign(baseStyle, {
            width: piece.size * 2,
            height: piece.size * 0.5,
            borderRadius: "2px",
          });
        } else {
          Object.assign(baseStyle, {
            width: piece.size,
            height: piece.size,
            borderRadius: "2px",
          });
        }

        return <div key={piece.id} style={baseStyle} />;
      })}

      {/* Center card */}
      <div
        style={{
          position: "relative",
          zIndex: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "28px",
          padding: "48px 40px",
          maxWidth: "680px",
          width: "calc(100% - 48px)",
          background: "rgba(255,255,255,0.12)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.28)",
          borderRadius: "28px",
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.18), 0 2px 0 rgba(255,255,255,0.22) inset",
          textAlign: "center",
        }}
      >
        {/* Check circle */}
        <div
          style={{
            width: "96px",
            height: "96px",
            borderRadius: "50%",
            background: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow:
              "0 8px 32px rgba(236,72,153,0.35), 0 2px 8px rgba(0,0,0,0.1)",
            animation: "mtSuccessPop 0.6s cubic-bezier(.34,1.56,.64,1) forwards",
            flexShrink: 0,
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <polyline
              points="10,26 20,36 38,16"
              stroke="#ec4899"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="42"
              strokeDashoffset="42"
              style={{
                animation: "mtCheckDraw 0.5s ease forwards 0.55s",
              }}
            />
          </svg>
        </div>

        {/* Chip */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 16px",
            borderRadius: "999px",
            background: "rgba(255,255,255,0.2)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.4)",
            fontSize: "13px",
            fontWeight: 600,
            color: "white",
            letterSpacing: "0.02em",
          }}
        >
          ✨ ההרשמה הושלמה
        </div>

        {/* H1 */}
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(36px, 5vw, 60px)",
            fontWeight: 700,
            color: "white",
            lineHeight: 1.15,
            textShadow: "0 2px 12px rgba(0,0,0,0.15)",
            opacity: 0,
            animation: "mtSlideUp 0.7s ease forwards 0.9s",
          }}
        >
          ברוכה הבאה ל-multitask 🎉
        </h1>

        {/* Description */}
        <p
          style={{
            margin: 0,
            fontSize: "17px",
            color: "rgba(255,255,255,0.88)",
            lineHeight: 1.65,
            maxWidth: "480px",
            opacity: 0,
            animation: "mtFadeIn 0.6s ease forwards 1.1s",
          }}
        >
          עכשיו יש לך גישה לכל הכלים שיעזרו לך לנהל את המשימות, הפרויקטים
          והיעדים שלך — כולם במקום אחד, מסודר ואישי בדיוק בשבילך.
        </p>

        {/* CTA cards */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            flexWrap: "wrap",
            justifyContent: "center",
            width: "100%",
            opacity: 0,
            animation: "mtFadeIn 0.6s ease forwards 1.3s",
          }}
        >
          {/* Card 1 — go to app */}
          <button
            onClick={() => navigate("/app")}
            style={{
              flex: "1 1 200px",
              minWidth: "200px",
              maxWidth: "260px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              padding: "24px 20px",
              background: "white",
              border: "none",
              borderRadius: "18px",
              cursor: "pointer",
              boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              transition: "transform 0.18s ease, box-shadow 0.18s ease",
              textAlign: "center",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform =
                "translateY(-3px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 10px 32px rgba(0,0,0,0.18)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "";
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 4px 20px rgba(0,0,0,0.12)";
            }}
          >
            <span style={{ fontSize: "32px", lineHeight: 1 }}>🚀</span>
            <span
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: "#111118",
                lineHeight: 1.3,
              }}
            >
              קחי אותי לאפליקציה
            </span>
            <span
              style={{
                fontSize: "12px",
                color: "#6b7280",
                lineHeight: 1.5,
              }}
            >
              התחילי לנהל את המשימות שלך עכשיו
            </span>
          </button>

          {/* Card 2 — tour (not implemented yet) */}
          <button
            onClick={() => navigate("/app")}
            style={{
              flex: "1 1 200px",
              minWidth: "200px",
              maxWidth: "260px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              padding: "24px 20px",
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.35)",
              borderRadius: "18px",
              cursor: "pointer",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
              transition: "transform 0.18s ease, box-shadow 0.18s ease",
              textAlign: "center",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform =
                "translateY(-3px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 10px 32px rgba(0,0,0,0.14)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "";
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 4px 20px rgba(0,0,0,0.08)";
            }}
          >
            <span style={{ fontSize: "32px", lineHeight: 1 }}>🗺️</span>
            <span
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: "white",
                lineHeight: 1.3,
              }}
            >
              הסבירי לי על האפליקציה
            </span>
            <span
              style={{
                fontSize: "12px",
                color: "rgba(255,255,255,0.75)",
                lineHeight: 1.5,
              }}
            >
              סיור מודרך בפיצ'רים המרכזיים
            </span>
          </button>
        </div>

        {/* Footer hint */}
        <p
          style={{
            margin: 0,
            fontSize: "12px",
            color: "rgba(255,255,255,0.6)",
            opacity: 0,
            animation: "mtFadeIn 0.6s ease forwards 1.5s",
          }}
        >
          לוקח 3 שניות. אפשר לדלג בכל רגע.
        </p>
      </div>
    </div>
  );
}
