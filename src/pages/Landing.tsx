import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Calendar, CheckCircle2, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

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

  const CurrentIcon = DEMO_STEPS[stepIdx].icon;

  return (
    <div className="min-h-screen bg-ink-50 overflow-hidden relative">
      {/* Ambient brand-gradient blobs */}
      <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-30 bg-brand-gradient" />
      <div className="absolute -bottom-40 -left-32 w-[32rem] h-[32rem] rounded-full blur-3xl opacity-20 bg-accent-purple" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 md:px-12 py-6">
          <img
            src="/brand/logo.png"
            alt="Multitask"
            className="h-10 md:h-11 w-auto select-none"
            draggable={false}
          />
          <a
            href="mailto:harosh.ccc@gmail.com"
            className="text-sm text-ink-500 hover:text-ink-900 transition-colors"
          >
            יצירת קשר
          </a>
        </header>

        {/* Hero */}
        <main className="flex-1 flex flex-col md:flex-row items-center justify-center gap-12 px-6 md:px-12 pb-12 max-w-7xl mx-auto w-full">
          <div className="flex-1 text-center md:text-right max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="chip-accent mb-6"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
              בבנייה · גרסה מוקדמת
            </motion.div>

            <h1 className="text-6xl md:text-7xl font-semibold tracking-tightest text-ink-900 mb-5">
              <span className="text-gradient">multi</span>
              <span>task</span>
            </h1>

            <div className="h-20 md:h-16 mb-7">
              <AnimatePresence mode="wait">
                <motion.p
                  key={taglineIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="text-2xl md:text-3xl text-ink-700 font-light"
                >
                  {TAGLINES[taglineIdx]}
                </motion.p>
              </AnimatePresence>
            </div>

            <p className="text-lg text-ink-500 mb-8 leading-relaxed max-w-lg">
              פלטפורמה שמחברת משימות, יומן, הקלטות, מחשבות ופרויקטים למקום אחד.
              הקלטה הופכת למשימה, משימה מופיעה ביומן, הכל מסונכרן — בלי הפרעות.
            </p>

            <div className="flex items-center gap-3 flex-wrap justify-center md:justify-start">
              <button
                onClick={handleSignIn}
                disabled={signing}
                className="btn-dark text-md px-6 py-3.5"
              >
                <GoogleIcon />
                <span>{signing ? "מעביר אליך ל־Google..." : "התחברות עם Google"}</span>
              </button>
              <span className="text-sm text-ink-400">
                אין חשבון? ההתחברות יוצרת לך אחד.
              </span>
            </div>
          </div>

          {/* Interactive demo card */}
          <div className="flex-1 w-full max-w-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.34, 1.3, 0.64, 1] }}
              className="card shadow-lift p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-danger/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-warning/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-success/60" />
                </div>
                <img src="/brand/m-symbol.png" alt="" className="h-5 w-auto opacity-70" />
              </div>

              <div className="min-h-[200px] flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={stepIdx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4 }}
                    className="flex flex-col items-center gap-4 text-center"
                  >
                    <div className="w-16 h-16 rounded-lg bg-brand-gradient-soft flex items-center justify-center ring-1 ring-primary-500/20">
                      <CurrentIcon className="w-8 h-8 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-ink-900 mb-2">
                        {DEMO_STEPS[stepIdx].caption}
                      </p>
                      <p className="text-sm text-ink-500">{DEMO_STEPS[stepIdx].sub}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Step indicator dots */}
              <div className="flex justify-center gap-2 mt-6">
                {DEMO_STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStepIdx(i)}
                    className={`h-1.5 rounded-full transition-all duration-200 ease-smooth ${
                      i === stepIdx
                        ? "w-8 bg-brand-gradient"
                        : "w-1.5 bg-ink-300 hover:bg-ink-400"
                    }`}
                    aria-label={`שלב ${i + 1}`}
                  />
                ))}
              </div>
            </motion.div>
          </div>
        </main>

        <footer className="px-6 md:px-12 py-6 text-xs text-ink-400 text-center">
          © {new Date().getFullYear()} Multitask · כל הזכויות שמורות
        </footer>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
