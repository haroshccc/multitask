import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Calendar, CheckCircle2, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { Logo, LogoMark } from "@/components/brand/Logo";

const DEMO_STEPS = [
  {
    icon: Mic,
    caption: "זרקת מחשבה בהקלטה",
    sub: "«להתקשר לדני מחר בבוקר על ההצעה»",
  },
  {
    icon: Sparkles,
    caption: "AI עיבד את זה",
    sub: "זיהה: משימה, שעה, לקוח, פרויקט",
  },
  {
    icon: CheckCircle2,
    caption: "נוצרה משימה",
    sub: "«התקשרות לדני» — מחר 09:00",
  },
  {
    icon: Calendar,
    caption: "הכל מופיע ביומן שלך",
    sub: "סונכרן אוטומטית לכל המכשירים",
  },
];

const TAGLINES = [
  "חלל לחשוב. חלל לעשות.",
  "הקלטה → משימה → לוח זמנים.",
  "הכל במקום אחד. סוף סוף.",
];

export function Landing() {
  const { signInWithGoogle } = useAuth();
  const [stepIdx, setStepIdx] = useState(0);
  const [taglineIdx, setTaglineIdx] = useState(0);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    const stepTimer = setInterval(() => {
      setStepIdx((i) => (i + 1) % DEMO_STEPS.length);
    }, 2400);
    const taglineTimer = setInterval(() => {
      setTaglineIdx((i) => (i + 1) % TAGLINES.length);
    }, 4500);
    return () => {
      clearInterval(stepTimer);
      clearInterval(taglineTimer);
    };
  }, []);

  const handleSignIn = async () => {
    try {
      setSigning(true);
      await signInWithGoogle();
    } catch (err) {
      console.error(err);
      setSigning(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-50 text-ink-900">
      <div className="max-w-[1240px] mx-auto px-8 min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between py-6">
          <Logo markSize={32} idKey="topLogo" />
          <a
            href="mailto:harosh.ccc@gmail.com"
            className="text-sm text-ink-500 hover:text-ink-900 transition-colors ease-smooth duration-150"
          >
            יצירת קשר
          </a>
        </header>

        {/* Hero — mirrors design-language .hero pattern */}
        <section
          dir="ltr"
          className="flex-1 flex items-center border-b border-ink-300 py-14"
        >
          <div className="flex items-center gap-12 md:gap-16 w-full flex-col md:flex-row">
            {/* Hero mark: responsive gradient square with white M inside */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.34, 1.3, 0.64, 1] }}
              className="hero-mark shrink-0 w-24 h-24 md:w-[128px] md:h-[128px] rounded-[28px] bg-brand-gradient animate-grad-shift [background-size:200%_200%] flex items-center justify-center relative overflow-hidden shadow-[0_24px_60px_-16px_rgba(245,158,11,0.4),0_8px_24px_-8px_rgba(236,72,153,0.3)]"
            >
              <div
                className="absolute inset-0 rounded-[28px] pointer-events-none"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.3), transparent 40%)",
                }}
              />
              <LogoMark size={74} variant="white" idKey="heroMark" />
            </motion.div>

            {/* Hero text */}
            <div className="flex-1 text-center md:text-start" dir="rtl">
              <div className="eyebrow mb-3.5">גרסת אלפא · פיתוח פעיל</div>
              <h1
                dir="ltr"
                className="text-6xl md:text-7xl font-semibold tracking-tightest leading-[0.95] mb-4 flex items-baseline gap-0 md:justify-start justify-center"
              >
                <span className="text-gradient">multi</span>
                <span className="text-ink-900">task</span>
              </h1>
              <div className="h-14 md:h-10 mb-5 flex items-center md:justify-start justify-center">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={taglineIdx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="text-md md:text-lg text-ink-500 font-normal"
                  >
                    {TAGLINES[taglineIdx]}
                  </motion.p>
                </AnimatePresence>
              </div>
              <p className="text-base text-ink-500 max-w-[580px] leading-[1.55] mb-6 md:mx-0 mx-auto">
                פלטפורמה שמחברת משימות, יומן, הקלטות, מחשבות ופרויקטים למקום אחד.
                הקלטה הופכת למשימה, משימה מופיעה ביומן — הכל מסונכרן, בלי הפרעות.
              </p>
              <div className="flex items-center gap-3 flex-wrap md:justify-start justify-center">
                <button
                  onClick={handleSignIn}
                  disabled={signing}
                  className="btn-dark px-5 py-3"
                >
                  <GoogleIcon />
                  <span>{signing ? "מעביר אל Google..." : "התחברות עם Google"}</span>
                </button>
                <span className="text-xs text-ink-400">
                  אין חשבון? ההתחברות יוצרת לך אחד.
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Demo section — follows design-language section pattern */}
        <section className="py-12">
          <div className="flex items-end justify-between gap-6 border-b border-ink-300 pb-3.5 mb-6">
            <div className="flex items-center gap-3.5">
              <span className="chip-accent text-xs font-semibold !py-1 !px-2.5 rounded-full">
                01
              </span>
              <h2 className="text-3xl font-semibold text-ink-900">איך זה עובד</h2>
            </div>
            <p className="text-xs text-ink-500 max-w-[400px] text-start hidden md:block">
              מחשבה נזרקת בהקלטה, AI מזהה מה בתוכה, ויוצר משימה שמופיעה אוטומטית
              ביומן שלך.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {DEMO_STEPS.map((step, i) => {
              const Icon = step.icon;
              const isActive = i === stepIdx;
              return (
                <button
                  key={i}
                  onClick={() => setStepIdx(i)}
                  className={`card p-5 text-start transition-all duration-300 ease-smooth flex flex-col gap-3 ${
                    isActive
                      ? "shadow-accent border-primary-500/40 -translate-y-0.5"
                      : "hover:-translate-y-0.5 hover:shadow-DEFAULT"
                  }`}
                >
                  <div
                    className={`w-11 h-11 rounded-md flex items-center justify-center transition-colors ${
                      isActive
                        ? "bg-brand-gradient animate-grad-shift [background-size:200%_200%] text-white"
                        : "bg-ink-150 text-ink-700"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-ink-400 mb-1">
                      שלב {String(i + 1).padStart(2, "0")}
                    </div>
                    <p className="text-sm font-medium text-ink-900 leading-snug mb-1">
                      {step.caption}
                    </p>
                    <p className="text-xs text-ink-500 leading-relaxed">{step.sub}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <footer className="py-8 text-xs text-ink-400 text-center border-t border-ink-300 mt-auto">
          © {new Date().getFullYear()} Multitask · כל הזכויות שמורות
        </footer>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
