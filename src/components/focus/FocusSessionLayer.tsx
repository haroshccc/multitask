import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlarmClock,
  Bell,
  CalendarClock,
  Check,
  Clock,
  Pause,
  Play,
  Scissors,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useActiveTimer } from "@/lib/hooks/useTimer";
import { useFocusSession } from "./FocusSessionProvider";

function fmt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  const h = Math.floor(m / 60);
  if (h > 0)
    return `${h}:${String(m % 60).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/**
 * Renders all focus-session surfaces (mounted once at the AppShell, inside the
 * FocusSessionProvider): the "start your task" alert, the live countdown
 * banner with its forward stopwatch, the time-up extension prompt, and the
 * conflict-resolution banner.
 */
export function FocusSessionLayer() {
  const f = useFocusSession();
  const { data: activeTimer } = useActiveTimer();
  const [, setTick] = useState(0);

  // 1s tick so the forward stopwatch reading stays live.
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const elapsedMs = activeTimer
    ? Date.now() - new Date(activeTimer.started_at).getTime()
    : 0;

  return (
    <>
      {f.status === "alerting" && !f.alertMinimized && (
        <StartAlertModal
          title={f.alertTask?.title || "ללא כותרת"}
          onStart={f.startFromAlert}
          onMinimize={f.minimizeAlert}
          onDismiss={f.dismissAlert}
        />
      )}

      {f.status === "alerting" && f.alertMinimized && (
        <CornerCard accent>
          <Bell className="w-4 h-4 text-amber-500 shrink-0" />
          <button
            type="button"
            onClick={f.restoreAlert}
            className="flex-1 min-w-0 text-start"
            title="פתחי את ההתראה"
          >
            <div className="text-[11px] text-ink-500">משימה ממתינה להתחלה</div>
            <div className="text-sm font-semibold text-ink-900 truncate">
              {f.alertTask?.title || "ללא כותרת"}
            </div>
          </button>
          <button
            type="button"
            onClick={f.startFromAlert}
            className="shrink-0 btn-primary text-xs px-2 py-1"
          >
            הפעל
          </button>
          <button
            type="button"
            onClick={f.dismissAlert}
            className="shrink-0 w-7 h-7 rounded-full hover:bg-ink-100 flex items-center justify-center text-ink-500"
            title="סגור"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </CornerCard>
      )}

      {(f.status === "running" ||
        f.status === "paused" ||
        f.status === "timeup") && (
        <SessionBanner
          title={f.sessionTask?.title || "ללא כותרת"}
          status={f.status}
          remainingMs={f.remainingMs}
          elapsedMs={elapsedMs}
          onPause={f.pauseSession}
          onResume={f.resumeSession}
          onFinish={f.finishSession}
          onClose={f.closeSession}
          onExtend={f.extend}
          overrunMs={f.overrunMs}
          overrunArmed={f.overrunArmed}
          onPushByOverrun={f.pushByOverrun}
        />
      )}

      {f.conflict && (
        <ConflictBanner
          nextTitle={f.conflictNextTask?.title || "המשימה הבאה"}
          overlapMin={f.conflict.overlapMin}
          onShorten={f.resolveConflictShorten}
          onPush={f.resolveConflictPush}
          onDismiss={f.dismissConflict}
        />
      )}

      {f.latePrompt && (
        <LateStartModal
          lateMin={f.latePrompt.lateMin}
          onPush={f.resolveLatePush}
          onCheckEnd={f.resolveLateCheckEnd}
        />
      )}

      {f.overrunPrompt && (
        <OverrunPromptModal
          kind={f.overrunPrompt.kind}
          overrunMin={f.overrunPrompt.overrunMin}
          onGrow={() => f.resolveOverrunPrompt(true)}
          onSkip={() => f.resolveOverrunPrompt(false)}
        />
      )}

      {f.reminder && (
        <ReminderBanner
          title={f.reminderNextTask?.title || "המשימה הבאה"}
          minutesLeft={f.reminder.minutesLeft}
          onDismiss={f.dismissReminder}
        />
      )}

      {f.endWarning && f.status === "running" && (
        <EndWarningBanner
          title={f.sessionTask?.title || "המשימה"}
          minutesLeft={f.endWarning.minutesLeft}
          onExtend={f.extend}
          onDismiss={f.dismissEndWarning}
        />
      )}
    </>
  );
}

function CornerCard({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "fixed z-50 bottom-20 md:bottom-4 end-4 card !p-2 !pe-2.5 shadow-lift",
        "flex items-center gap-2 max-w-[calc(100vw-2rem)] sm:max-w-md",
        accent && "border-amber-300 bg-gradient-to-l from-amber-50 to-white"
      )}
    >
      {children}
    </div>
  );
}

function StartAlertModal({
  title,
  onStart,
  onMinimize,
  onDismiss,
}: {
  title: string;
  onStart: () => void;
  onMinimize: () => void;
  onDismiss: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-sm p-5 shadow-lift">
        <div className="flex items-center gap-2 mb-1">
          <AlarmClock className="w-5 h-5 text-primary-600" />
          <h2 className="text-base font-bold text-ink-900">
            הגיע הזמן להתחיל משימה
          </h2>
        </div>
        <p className="text-sm text-ink-700 mb-1">{title}</p>
        <p className="text-xs text-ink-500 mb-4">להפעיל את הסטופר עכשיו?</p>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onDismiss} className="btn-ghost text-sm">
            צא
          </button>
          <button type="button" onClick={onMinimize} className="btn-ghost text-sm">
            מזער לפינה
          </button>
          <button type="button" onClick={onStart} className="btn-primary text-sm">
            הפעל
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function SessionBanner({
  title,
  status,
  remainingMs,
  elapsedMs,
  onPause,
  onResume,
  onFinish,
  onClose,
  onExtend,
  overrunMs,
  overrunArmed,
  onPushByOverrun,
}: {
  title: string;
  status: "running" | "paused" | "timeup";
  remainingMs: number;
  elapsedMs: number;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onClose: () => void;
  onExtend: (minutes: number) => void;
  overrunMs: number;
  overrunArmed: boolean;
  onPushByOverrun: () => void;
}) {
  const isTimeup = status === "timeup";
  const overrunMin = Math.floor(overrunMs / 60_000);
  const isPaused = status === "paused";
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed z-50 bottom-20 md:bottom-4 end-4 card !p-3 shadow-lift",
        "w-[min(22rem,calc(100vw-2rem))] space-y-2",
        isTimeup
          ? "border-amber-300 bg-gradient-to-l from-amber-50 to-white"
          : isPaused
          ? "border-ink-200"
          : "border-primary-300 bg-gradient-to-l from-primary-50 to-white"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "shrink-0 w-9 h-9 rounded-full flex items-center justify-center",
            isTimeup
              ? "bg-amber-500 text-white"
              : isPaused
              ? "bg-ink-100 text-ink-500"
              : "bg-gradient-to-br from-primary-500 to-primary-600 text-white"
          )}
        >
          {isTimeup ? (
            <AlarmClock className="w-4 h-4" />
          ) : (
            <CalendarClock className="w-4 h-4" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink-900 truncate">
            {title}
          </div>
          <div className="text-[11px] text-ink-500">
            {isTimeup
              ? "נגמר הזמן"
              : isPaused
              ? "מושהה"
              : `נותרו ${fmt(remainingMs)}`}
            <span className="mx-1">·</span>
            עבדת {fmt(elapsedMs)}
          </div>
        </div>
        <button
          type="button"
          onClick={isPaused ? onResume : onPause}
          className={cn(
            "shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white",
            isPaused
              ? "bg-primary-500 hover:bg-primary-600"
              : "bg-danger-500 hover:bg-danger-600"
          )}
          title={isPaused ? "המשך" : "עצור"}
        >
          {isPaused ? (
            <Play className="w-3.5 h-3.5 ms-0.5" />
          ) : (
            <Pause className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={isPaused ? onClose : onFinish}
          className="shrink-0 w-7 h-7 rounded-full hover:bg-ink-100 flex items-center justify-center text-ink-500"
          title={isPaused ? "סגור" : "סיים"}
        >
          {isPaused ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isTimeup && (
        <div className="space-y-1.5">
          <div className="text-xs text-ink-600">סיימת, או צריך עוד זמן?</div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={onFinish}
              className="btn-primary text-xs px-2.5 py-1 inline-flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" /> סיימתי
            </button>
            {[5, 15, 30, 45].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onExtend(m)}
                className="btn-ghost text-xs px-2.5 py-1 border border-ink-200"
              >
                +{m} דק׳
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onPushByOverrun}
            className="w-full btn-ghost text-xs px-2.5 py-1 border border-amber-300 text-amber-700 inline-flex items-center justify-center gap-1"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            דחה הכל בכמות החריגה
            {overrunMin >= 1 ? ` (+${overrunMin} דק׳)` : ""}
          </button>
          {overrunArmed && (
            <div className="text-[11px] text-amber-700 leading-snug">
              דחפתי את שאר הלו״ז קדימה. בלחיצה על "סיימתי" המשימה תתארך
              שוב בהפרש שנצבר מאז.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConflictBanner({
  nextTitle,
  overlapMin,
  onShorten,
  onPush,
  onDismiss,
}: {
  nextTitle: string;
  overlapMin: number;
  onShorten: () => void;
  onPush: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "fixed z-[60] top-4 left-1/2 -translate-x-1/2 card !p-3 shadow-lift",
        "w-[min(26rem,calc(100vw-2rem))] space-y-2 border-amber-300",
        "bg-gradient-to-l from-amber-50 to-white"
      )}
    >
      <div className="flex items-start gap-2">
        <Bell className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1 text-sm text-ink-800">
          ההארכה מתנגשת עם <span className="font-semibold">{nextTitle}</span> (
          {overlapMin} דק׳). מה לעשות?
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 w-6 h-6 rounded-full hover:bg-ink-100 flex items-center justify-center text-ink-500"
          title="התעלם"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 justify-end">
        <button
          type="button"
          onClick={onShorten}
          className="btn-ghost text-xs px-2.5 py-1 border border-ink-200 inline-flex items-center gap-1"
        >
          <Scissors className="w-3.5 h-3.5" /> קצר את הבאה
        </button>
        <button
          type="button"
          onClick={onPush}
          className="btn-primary text-xs px-2.5 py-1 inline-flex items-center gap-1"
        >
          <CalendarClock className="w-3.5 h-3.5" /> דחה הכל קדימה
        </button>
      </div>
    </div>
  );
}

function LateStartModal({
  lateMin,
  onPush,
  onCheckEnd,
}: {
  lateMin: number;
  onPush: (makeDefault: boolean) => void;
  onCheckEnd: (makeDefault: boolean) => void;
}) {
  const [makeDefault, setMakeDefault] = useState(false);
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-sm p-5 shadow-lift">
        <div className="flex items-center gap-2 mb-1">
          <AlarmClock className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-bold text-ink-900">התחלת באיחור</h2>
        </div>
        <p className="text-sm text-ink-700 mb-4">
          התחלת באיחור של כ-{lateMin} דק׳. לדחות כבר עכשיו את שאר הלו״ז קדימה,
          או לבדוק איתך רק כשתתקרבי לסוף הזמן?
        </p>
        <label className="flex items-center gap-2 mb-4 text-xs text-ink-600 cursor-pointer">
          <input
            type="checkbox"
            checked={makeDefault}
            onChange={(e) => setMakeDefault(e.target.checked)}
          />
          הפוך את הבחירה לברירת מחדל (אפשר לשנות בהגדרות)
        </label>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onCheckEnd(makeDefault)}
            className="btn-ghost text-sm"
          >
            בדוק רק בסוף
          </button>
          <button
            type="button"
            onClick={() => onPush(makeDefault)}
            className="btn-primary text-sm inline-flex items-center gap-1"
          >
            <CalendarClock className="w-4 h-4" /> דחה את הלו״ז קדימה
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function OverrunPromptModal({
  kind,
  overrunMin,
  onGrow,
  onSkip,
}: {
  kind: "finish" | "pause";
  overrunMin: number;
  onGrow: () => void;
  onSkip: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-sm p-5 shadow-lift">
        <div className="flex items-center gap-2 mb-1">
          <AlarmClock className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-bold text-ink-900">
            עבדת אחרי הזמן
          </h2>
        </div>
        <p className="text-sm text-ink-700 mb-4">
          עבדת עוד כ-{overrunMin} דק׳ אחרי סוף הזמן שתוכנן. להאריך את המשימה
          ביומן כדי שתשקף את הזמן שבאמת עבדת? (אפשר לבטל אחר כך)
        </p>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onSkip} className="btn-ghost text-sm">
            {kind === "pause" ? "רק עצור" : "לא, סיים כמו שזה"}
          </button>
          <button
            type="button"
            onClick={onGrow}
            className="btn-primary text-sm inline-flex items-center gap-1"
          >
            <CalendarClock className="w-4 h-4" /> כן, הארך ב-{overrunMin} דק׳
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function EndWarningBanner({
  title,
  minutesLeft,
  onExtend,
  onDismiss,
}: {
  title: string;
  minutesLeft: number;
  onExtend: (minutes: number) => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed z-[60] top-4 left-1/2 -translate-x-1/2 card !p-2.5 shadow-lift",
        "w-[min(26rem,calc(100vw-2rem))] space-y-2",
        "border-amber-300 bg-gradient-to-l from-amber-50 to-white"
      )}
    >
      <div className="flex items-center gap-2">
        <AlarmClock className="w-4 h-4 text-amber-500 shrink-0" />
        <div className="flex-1 min-w-0 text-sm text-ink-800">
          נותרו כ-{minutesLeft} דק׳ ל<span className="font-semibold">{title}</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 w-6 h-6 rounded-full hover:bg-ink-100 flex items-center justify-center text-ink-500"
          title="סגור"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 justify-end">
        {[5, 15, 30].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              onExtend(m);
              onDismiss();
            }}
            className="btn-ghost text-xs px-2.5 py-1 border border-ink-200"
          >
            +{m} דק׳
          </button>
        ))}
      </div>
    </div>
  );
}

function ReminderBanner({
  title,
  minutesLeft,
  onDismiss,
}: {
  title: string;
  minutesLeft: number;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed z-[60] top-4 left-1/2 -translate-x-1/2 card !p-2.5 shadow-lift",
        "w-[min(24rem,calc(100vw-2rem))] flex items-center gap-2",
        "border-primary-300 bg-gradient-to-l from-primary-50 to-white"
      )}
    >
      <Clock className="w-4 h-4 text-primary-600 shrink-0" />
      <div className="flex-1 min-w-0 text-sm text-ink-800">
        בעוד כ-{minutesLeft} דק׳ מתחילה{" "}
        <span className="font-semibold">{title}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 w-6 h-6 rounded-full hover:bg-ink-100 flex items-center justify-center text-ink-500"
        title="סגור"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
