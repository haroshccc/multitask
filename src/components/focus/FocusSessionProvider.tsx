import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  useActiveTimer,
  useStartTimer,
  useStopTimer,
} from "@/lib/hooks/useTimer";
import { useTasks, useUpdateTask } from "@/lib/hooks";
import { useListVisibility } from "@/lib/hooks/useListVisibility";
import { useFocusPrefs } from "@/lib/hooks/useFocusPrefs";
import type { Task } from "@/lib/types/domain";
import { pushUndo } from "@/lib/undo/store";
import { playPleasantChime, primeChime } from "@/lib/focus/chime";
import {
  ensureNotificationPermission,
  systemNotify,
} from "@/lib/focus/notify";

const ALERTED_KEY = "multitask.focus.alerted";
const SESSION_KEY = "multitask.focus.session";

type Status = "idle" | "alerting" | "running" | "paused" | "timeup";

interface PersistedSession {
  taskId: string;
  endsAt: number; // epoch ms
  status: "running" | "paused" | "timeup";
  pausedRemainingMs?: number;
}

interface ConflictInfo {
  nextTaskId: string;
  overlapMin: number;
  newEndsAt: number;
}

interface LatePromptInfo {
  taskId: string;
  lateMin: number;
}

interface ReminderInfo {
  nextTaskId: string;
  minutesLeft: number;
}

interface FocusContextValue {
  status: Status;
  alertTask: Task | null;
  alertMinimized: boolean;
  sessionTask: Task | null;
  remainingMs: number;
  conflict: ConflictInfo | null;
  conflictNextTask: Task | null;
  latePrompt: LatePromptInfo | null;
  reminder: ReminderInfo | null;
  reminderNextTask: Task | null;
  /** Set when the running session is within `endWarningMin` of its end. */
  endWarning: { minutesLeft: number } | null;
  // alert actions
  startFromAlert: () => void;
  /** Start a focus session for an arbitrary task (e.g. from the row menu),
   *  including before its scheduled time. */
  startSession: (task: Task) => void;
  dismissAlert: () => void;
  minimizeAlert: () => void;
  restoreAlert: () => void;
  // session actions
  pauseSession: () => void;
  resumeSession: () => void;
  finishSession: () => void;
  closeSession: () => void;
  extend: (minutes: number) => void;
  /** Live overrun (ms past the planned end) while the session is in timeup. */
  overrunMs: number;
  /** True once the user chose "push by overrun" — finish will absorb the
   *  remaining difference too. */
  overrunArmed: boolean;
  /** Absorb the current overrun into the task block + push the rest of the day
   *  forward by that amount, keep working, and arm the finish follow-up. */
  pushByOverrun: () => void;
  // conflict actions
  resolveConflictShorten: () => void;
  resolveConflictPush: () => void;
  dismissConflict: () => void;
  // late-start prompt actions
  resolveLatePush: (makeDefault: boolean) => void;
  resolveLateCheckEnd: (makeDefault: boolean) => void;
  // next-task reminder
  dismissReminder: () => void;
  // end-of-time warning
  dismissEndWarning: () => void;
}

const FocusContext = createContext<FocusContextValue | null>(null);

export function useFocusSession(): FocusContextValue {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error("useFocusSession must be used within FocusSessionProvider");
  return ctx;
}

function loadAlerted(): Set<string> {
  try {
    const raw = localStorage.getItem(ALERTED_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* ignore */
  }
  return new Set();
}

function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as PersistedSession;
  } catch {
    /* ignore */
  }
  return null;
}

const occKey = (t: Task) => `${t.id}@${t.scheduled_at ?? ""}`;
const durationMinOf = (t: Task, fallbackMin: number) =>
  t.duration_minutes ?? fallbackMin;

export function FocusSessionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { prefs, setPrefs } = useFocusPrefs();
  const { data: tasks = [] } = useTasks();
  const { data: visibility } = useListVisibility("calendar");
  const hiddenLists = useMemo(
    () => new Set(visibility?.hidden_list_ids ?? []),
    [visibility]
  );
  const { data: activeTimer } = useActiveTimer();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const updateTask = useUpdateTask();

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [alertTaskId, setAlertTaskId] = useState<string | null>(null);
  const [alertMinimized, setAlertMinimized] = useState(false);
  const [sessionTaskId, setSessionTaskId] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [sessionStatus, setSessionStatus] = useState<
    "running" | "paused" | "timeup" | null
  >(null);
  const [pausedRemainingMs, setPausedRemainingMs] = useState(0);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [latePrompt, setLatePrompt] = useState<LatePromptInfo | null>(null);
  const [overrunArmed, setOverrunArmed] = useState(false);
  const [reminder, setReminder] = useState<ReminderInfo | null>(null);
  const [endWarning, setEndWarning] = useState<{ minutesLeft: number } | null>(
    null
  );

  const handledRef = useRef<Set<string>>(loadAlerted());
  const remindedRef = useRef<Set<string>>(new Set());
  const restoredRef = useRef(false);
  const chimedTimeupRef = useRef(false);
  // True once the end-warning has fired for the current countdown window, so
  // it doesn't re-fire every tick. Reset whenever endsAt changes (extend /
  // resume) or the session clears.
  const endWarnedRef = useRef(false);

  const taskById = useMemo(() => {
    const m = new Map<string, Task>();
    for (const t of tasks) m.set(t.id, t);
    return m;
  }, [tasks]);

  // 1-second clock driving the countdown + due-task scan.
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Persist session essentials.
  useEffect(() => {
    if (!sessionTaskId || !sessionStatus || endsAt == null) {
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    const data: PersistedSession = {
      taskId: sessionTaskId,
      endsAt,
      status: sessionStatus,
      pausedRemainingMs,
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [sessionTaskId, sessionStatus, endsAt, pausedRemainingMs]);

  const persistAlerted = useCallback(() => {
    try {
      localStorage.setItem(
        ALERTED_KEY,
        JSON.stringify([...handledRef.current].slice(-200))
      );
    } catch {
      /* ignore */
    }
  }, []);

  // Restore a persisted session once tasks are available.
  useEffect(() => {
    if (restoredRef.current) return;
    if (tasks.length === 0) return;
    restoredRef.current = true;
    const s = loadSession();
    if (!s || !taskById.has(s.taskId)) return;
    setSessionTaskId(s.taskId);
    setEndsAt(s.endsAt);
    if (s.status === "paused") {
      setPausedRemainingMs(s.pausedRemainingMs ?? 0);
      setSessionStatus("paused");
    } else if (Date.now() >= s.endsAt) {
      setSessionStatus("timeup");
    } else {
      setSessionStatus("running");
    }
  }, [tasks.length, taskById]);

  const status: Status = sessionStatus
    ? sessionStatus
    : alertTaskId
    ? "alerting"
    : "idle";

  // Due-task watcher — only when fully idle (no alert, no session).
  useEffect(() => {
    if (!prefs.enabled || status !== "idle" || !userId) return;
    const lateWindowMs = prefs.lateCatchMin * 60_000;
    for (const t of tasks) {
      if (!t.scheduled_at || t.completed_at || t.is_phase) continue;
      const mine = t.owner_id === userId || t.assignee_user_id === userId;
      if (!mine) continue;
      const start = new Date(t.scheduled_at).getTime();
      if (nowMs < start) continue;
      if (nowMs - start > lateWindowMs) continue; // too late
      const key = occKey(t);
      if (handledRef.current.has(key)) continue;
      handledRef.current.add(key);
      persistAlerted();
      setAlertTaskId(t.id);
      setAlertMinimized(false);
      if (prefs.systemNotifications) {
        void ensureNotificationPermission().then(() => {
          systemNotify("הגיע הזמן להתחיל משימה", t.title || "ללא כותרת");
        });
      }
      if (prefs.sound) playPleasantChime();
      break;
    }
  }, [nowMs, status, tasks, userId, persistAlerted, prefs]);

  // Timeup detection.
  useEffect(() => {
    if (sessionStatus !== "running" || endsAt == null) return;
    if (nowMs >= endsAt) {
      setSessionStatus("timeup");
    }
  }, [nowMs, sessionStatus, endsAt]);

  // A fresh countdown window (new endsAt from start / resume / extend) re-arms
  // the end-warning and clears any showing one.
  useEffect(() => {
    endWarnedRef.current = false;
    setEndWarning(null);
  }, [endsAt]);

  // End-of-time warning: while running, fire once when the countdown drops to
  // `endWarningMin` minutes (or less) remaining, but before time is actually up.
  useEffect(() => {
    if (sessionStatus !== "running" || endsAt == null) return;
    const lead = prefs.endWarningMin;
    if (lead <= 0 || endWarnedRef.current) return;
    const msLeft = endsAt - nowMs;
    if (msLeft <= 0 || msLeft > lead * 60_000) return;
    endWarnedRef.current = true;
    const minutesLeft = Math.max(1, Math.round(msLeft / 60_000));
    setEndWarning({ minutesLeft });
    if (prefs.sound) playPleasantChime();
    if (prefs.systemNotifications) {
      const t = sessionTaskId ? taskById.get(sessionTaskId) : null;
      systemNotify(
        "הזמן עומד להיגמר",
        `נותרו כ-${minutesLeft} דק׳${t?.title ? ` ל"${t.title}"` : ""}`
      );
    }
  }, [nowMs, sessionStatus, endsAt, sessionTaskId, taskById, prefs]);

  // Fire the chime + notification once when entering timeup.
  useEffect(() => {
    if (sessionStatus === "timeup" && !chimedTimeupRef.current) {
      chimedTimeupRef.current = true;
      if (prefs.sound) playPleasantChime();
      if (prefs.systemNotifications) {
        const t = sessionTaskId ? taskById.get(sessionTaskId) : null;
        systemNotify("נגמר הזמן", t?.title ? `סיימת את "${t.title}"?` : "סיימת?");
      }
    }
    if (sessionStatus !== "timeup") chimedTimeupRef.current = false;
  }, [sessionStatus, sessionTaskId, taskById, prefs]);

  const alertTask = alertTaskId ? taskById.get(alertTaskId) ?? null : null;
  const sessionTask = sessionTaskId ? taskById.get(sessionTaskId) ?? null : null;
  const conflictNextTask = conflict
    ? taskById.get(conflict.nextTaskId) ?? null
    : null;

  const remainingMs =
    sessionStatus === "paused"
      ? pausedRemainingMs
      : endsAt != null
      ? Math.max(0, endsAt - nowMs)
      : 0;

  // How far past the planned end we are right now (0 until time is up).
  const overrunMs = endsAt != null ? Math.max(0, nowMs - endsAt) : 0;

  // ---- actions ----

  // Push every later visible scheduled task today forward by `shiftMin`.
  const shiftSchedule = useCallback(
    (shiftMin: number, fromTs: number, excludeId: string) => {
      if (shiftMin <= 0) return;
      const dayEnd = new Date();
      dayEnd.setHours(23, 59, 59, 999);
      const toShift = tasks.filter(
        (t) =>
          t.id !== excludeId &&
          t.scheduled_at &&
          !t.completed_at &&
          !t.is_phase &&
          !(t.task_list_id && hiddenLists.has(t.task_list_id)) &&
          new Date(t.scheduled_at).getTime() > fromTs &&
          new Date(t.scheduled_at).getTime() <= dayEnd.getTime()
      );
      if (toShift.length === 0) return;
      const snapshots = toShift.map((t) => ({ id: t.id, scheduled_at: t.scheduled_at! }));
      const apply = () => {
        for (const s of snapshots) {
          const shifted = new Date(
            new Date(s.scheduled_at).getTime() + shiftMin * 60_000
          ).toISOString();
          updateTask.mutate({ taskId: s.id, patch: { scheduled_at: shifted } });
        }
      };
      apply();
      pushUndo({
        description: `דחיית ${snapshots.length} משימות ב-${shiftMin} דק׳`,
        undo: () => {
          for (const s of snapshots)
            updateTask.mutate({ taskId: s.id, patch: { scheduled_at: s.scheduled_at } });
        },
        redo: apply,
      });
    },
    [tasks, hiddenLists, updateTask]
  );

  const beginSession = useCallback(
    (task: Task) => {
      primeChime();
      void ensureNotificationPermission();
      startTimer.mutate({ taskId: task.id });
      const now = Date.now();
      setSessionTaskId(task.id);
      setEndsAt(now + durationMinOf(task, prefs.defaultDurationMin) * 60_000);
      setSessionStatus("running");
      setAlertTaskId(null);
      setAlertMinimized(false);
      setReminder(null);
      setOverrunArmed(false);
      // Late start? (started after the scheduled time.)
      const startTs = task.scheduled_at ? new Date(task.scheduled_at).getTime() : null;
      const lateMin = startTs != null ? Math.floor((now - startTs) / 60_000) : 0;
      if (startTs != null && lateMin >= 1) {
        if (prefs.lateStartBehavior === "reschedule") {
          shiftSchedule(lateMin, startTs, task.id);
        } else if (prefs.lateStartBehavior === "ask") {
          setLatePrompt({ taskId: task.id, lateMin });
        }
        // "check-near-end" → do nothing; the next-task reminder handles it.
      }
    },
    [startTimer, prefs.defaultDurationMin, prefs.lateStartBehavior, shiftSchedule]
  );

  const startFromAlert = useCallback(() => {
    if (alertTask) beginSession(alertTask);
  }, [alertTask, beginSession]);

  const dismissAlert = useCallback(() => {
    setAlertTaskId(null);
    setAlertMinimized(false);
  }, []);

  const minimizeAlert = useCallback(() => setAlertMinimized(true), []);
  const restoreAlert = useCallback(() => setAlertMinimized(false), []);

  const pauseSession = useCallback(() => {
    stopTimer.mutate();
    setPausedRemainingMs(endsAt != null ? Math.max(0, endsAt - Date.now()) : 0);
    setSessionStatus("paused");
  }, [stopTimer, endsAt]);

  const resumeSession = useCallback(() => {
    if (!sessionTaskId) return;
    startTimer.mutate({ taskId: sessionTaskId });
    setEndsAt(Date.now() + pausedRemainingMs);
    setSessionStatus("running");
  }, [sessionTaskId, pausedRemainingMs, startTimer]);

  const clearSession = useCallback(() => {
    setSessionTaskId(null);
    setEndsAt(null);
    setSessionStatus(null);
    setPausedRemainingMs(0);
    setConflict(null);
    setLatePrompt(null);
    setReminder(null);
    setEndWarning(null);
    setOverrunArmed(false);
    remindedRef.current.clear();
  }, []);

  // Grow the current task's block by however far past `endsAt` we are now, and
  // shove every later scheduled task today forward by the same amount. Returns
  // the overrun applied (0 when there's none). Does NOT reset `endsAt`.
  const absorbOverrunNow = useCallback(() => {
    if (endsAt == null || !sessionTaskId) return 0;
    const now = Date.now();
    if (now <= endsAt) return 0;
    const overrunMin = Math.max(1, Math.ceil((now - endsAt) / 60_000));
    const t = taskById.get(sessionTaskId);
    if (t) {
      const curMin = t.duration_minutes ?? prefs.defaultDurationMin;
      updateTask.mutate({
        taskId: sessionTaskId,
        patch: { duration_minutes: curMin + overrunMin },
      });
    }
    shiftSchedule(overrunMin, endsAt, sessionTaskId);
    return overrunMin;
  }, [
    endsAt,
    sessionTaskId,
    taskById,
    updateTask,
    prefs.defaultDurationMin,
    shiftSchedule,
  ]);

  const finishSession = useCallback(() => {
    // If the user armed "push by overrun", absorb the remaining difference that
    // accrued since the last push before finishing. `endsAt` was reset to the
    // last push moment, so this only counts the new diff — no double-pushing.
    if (overrunArmed) absorbOverrunNow();
    setOverrunArmed(false);
    stopTimer.mutate();
    clearSession();
  }, [overrunArmed, absorbOverrunNow, stopTimer, clearSession]);

  const pushByOverrun = useCallback(() => {
    if (absorbOverrunNow() <= 0) return;
    // Re-anchor the window to now so the next push / finish measures only the
    // additional overrun from here on.
    setEndsAt(Date.now());
    setOverrunArmed(true);
  }, [absorbOverrunNow]);

  // X on the paused banner — the timer is already stopped.
  const closeSession = useCallback(() => {
    if (sessionStatus !== "paused") stopTimer.mutate();
    clearSession();
  }, [sessionStatus, stopTimer, clearSession]);

  const checkConflict = useCallback(
    (newEndsAt: number) => {
      if (!sessionTaskId) return;
      const now = Date.now();
      // Visible (calendar) scheduled tasks that would overlap the extension.
      const candidates = tasks
        .filter(
          (t) =>
            t.id !== sessionTaskId &&
            t.scheduled_at &&
            !t.completed_at &&
            !t.is_phase &&
            !(t.task_list_id && hiddenLists.has(t.task_list_id))
        )
        .map((t) => ({ t, start: new Date(t.scheduled_at!).getTime() }))
        .filter(({ start }) => start >= now && start < newEndsAt)
        .sort((a, b) => a.start - b.start);
      const first = candidates[0];
      if (!first) {
        setConflict(null);
        return;
      }
      setConflict({
        nextTaskId: first.t.id,
        overlapMin: Math.ceil((newEndsAt - first.start) / 60_000),
        newEndsAt,
      });
    },
    [sessionTaskId, tasks, hiddenLists]
  );

  const extend = useCallback(
    (minutes: number) => {
      const base = sessionStatus === "timeup" ? Date.now() : endsAt ?? Date.now();
      const newEndsAt = base + minutes * 60_000;
      setEndsAt(newEndsAt);
      setSessionStatus("running");
      // Make sure the forward stopwatch is still running.
      if (!activeTimer && sessionTaskId) {
        startTimer.mutate({ taskId: sessionTaskId });
      }
      // Grow the calendar block by the extension so the planned slot reflects
      // the extra committed time. We only ever grow — never shrink — so a task
      // finished early keeps its original block (the actual-time overlay shows
      // the shorter worked span inside it).
      if (sessionTaskId) {
        const t = taskById.get(sessionTaskId);
        if (t) {
          const curMin = t.duration_minutes ?? prefs.defaultDurationMin;
          updateTask.mutate({
            taskId: sessionTaskId,
            patch: { duration_minutes: curMin + minutes },
          });
        }
      }
      checkConflict(newEndsAt);
    },
    [
      sessionStatus,
      endsAt,
      activeTimer,
      sessionTaskId,
      startTimer,
      checkConflict,
      taskById,
      updateTask,
      prefs.defaultDurationMin,
    ]
  );

  const resolveConflictShorten = useCallback(() => {
    if (!conflict) return;
    const next = taskById.get(conflict.nextTaskId);
    if (!next || !next.scheduled_at) {
      setConflict(null);
      return;
    }
    const origStart = new Date(next.scheduled_at).getTime();
    const origEnd = origStart + durationMinOf(next, prefs.defaultDurationMin) * 60_000;
    const newStartIso = new Date(conflict.newEndsAt).toISOString();
    const newDur = Math.max(5, Math.round((origEnd - conflict.newEndsAt) / 60_000));
    const prev = {
      scheduled_at: next.scheduled_at,
      duration_minutes: next.duration_minutes,
    };
    const patch = { scheduled_at: newStartIso, duration_minutes: newDur };
    updateTask.mutate({ taskId: next.id, patch });
    pushUndo({
      description: "קיצור המשימה הבאה",
      undo: () => updateTask.mutate({ taskId: next.id, patch: prev }),
      redo: () => updateTask.mutate({ taskId: next.id, patch }),
    });
    setConflict(null);
  }, [conflict, taskById, updateTask, prefs.defaultDurationMin]);

  const resolveConflictPush = useCallback(() => {
    if (!conflict) return;
    const shiftMin = conflict.overlapMin;
    const fromTs = new Date(
      taskById.get(conflict.nextTaskId)?.scheduled_at ?? Date.now()
    ).getTime();
    // Push the conflicting task and every later visible scheduled task today.
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);
    const toShift = tasks.filter(
      (t) =>
        t.id !== conflict.nextTaskId &&
        t.scheduled_at &&
        !t.completed_at &&
        !t.is_phase &&
        !(t.task_list_id && hiddenLists.has(t.task_list_id)) &&
        new Date(t.scheduled_at).getTime() > fromTs &&
        new Date(t.scheduled_at).getTime() <= dayEnd.getTime()
    );
    const next = taskById.get(conflict.nextTaskId);
    const all = next ? [next, ...toShift] : toShift;
    const snapshots = all.map((t) => ({
      id: t.id,
      scheduled_at: t.scheduled_at!,
    }));
    for (const t of all) {
      const shifted = new Date(
        new Date(t.scheduled_at!).getTime() + shiftMin * 60_000
      ).toISOString();
      updateTask.mutate({ taskId: t.id, patch: { scheduled_at: shifted } });
    }
    pushUndo({
      description: `דחיית ${all.length} משימות`,
      undo: () => {
        for (const s of snapshots)
          updateTask.mutate({
            taskId: s.id,
            patch: { scheduled_at: s.scheduled_at },
          });
      },
      redo: () => {
        for (const t of all) {
          const shifted = new Date(
            new Date(t.scheduled_at!).getTime() + shiftMin * 60_000
          ).toISOString();
          updateTask.mutate({ taskId: t.id, patch: { scheduled_at: shifted } });
        }
      },
    });
    setConflict(null);
  }, [conflict, tasks, taskById, hiddenLists, updateTask]);

  const dismissConflict = useCallback(() => setConflict(null), []);

  const resolveLatePush = useCallback(
    (makeDefault: boolean) => {
      if (!latePrompt) return;
      const task = taskById.get(latePrompt.taskId);
      const fromTs = task?.scheduled_at
        ? new Date(task.scheduled_at).getTime()
        : Date.now();
      shiftSchedule(latePrompt.lateMin, fromTs, latePrompt.taskId);
      if (makeDefault) setPrefs({ lateStartBehavior: "reschedule" });
      setLatePrompt(null);
    },
    [latePrompt, taskById, shiftSchedule, setPrefs]
  );

  const resolveLateCheckEnd = useCallback(
    (makeDefault: boolean) => {
      if (makeDefault) setPrefs({ lateStartBehavior: "check-near-end" });
      setLatePrompt(null);
    },
    [setPrefs]
  );

  const dismissReminder = useCallback(() => setReminder(null), []);

  const dismissEndWarning = useCallback(() => setEndWarning(null), []);

  // Next-task reminder: while a session is running, warn `nextTaskReminderMin`
  // minutes before the next visible scheduled task begins.
  useEffect(() => {
    if (sessionStatus !== "running" && sessionStatus !== "timeup") return;
    const lead = prefs.nextTaskReminderMin;
    if (lead <= 0) return;
    const upcoming = tasks
      .filter(
        (t) =>
          t.id !== sessionTaskId &&
          t.scheduled_at &&
          !t.completed_at &&
          !t.is_phase &&
          !(t.task_list_id && hiddenLists.has(t.task_list_id))
      )
      .map((t) => ({ t, start: new Date(t.scheduled_at!).getTime() }))
      .filter(({ start }) => start > nowMs)
      .sort((a, b) => a.start - b.start)[0];
    if (!upcoming) return;
    const msLeft = upcoming.start - nowMs;
    if (msLeft > lead * 60_000) return;
    const key = occKey(upcoming.t);
    if (remindedRef.current.has(key)) return;
    remindedRef.current.add(key);
    setReminder({
      nextTaskId: upcoming.t.id,
      minutesLeft: Math.max(1, Math.round(msLeft / 60_000)),
    });
    if (prefs.sound) playPleasantChime();
    if (prefs.systemNotifications) {
      systemNotify(
        "המשימה הבאה מתקרבת",
        `בעוד כ-${Math.max(1, Math.round(msLeft / 60_000))} דק׳: ${
          upcoming.t.title || "ללא כותרת"
        }`
      );
    }
  }, [nowMs, sessionStatus, tasks, sessionTaskId, hiddenLists, prefs]);

  const reminderNextTask = reminder
    ? taskById.get(reminder.nextTaskId) ?? null
    : null;

  const value: FocusContextValue = {
    status,
    alertTask,
    alertMinimized,
    sessionTask,
    remainingMs,
    conflict,
    conflictNextTask,
    latePrompt,
    reminder,
    reminderNextTask,
    endWarning,
    startFromAlert,
    startSession: beginSession,
    dismissAlert,
    minimizeAlert,
    restoreAlert,
    pauseSession,
    resumeSession,
    finishSession,
    closeSession,
    extend,
    overrunMs,
    overrunArmed,
    pushByOverrun,
    resolveConflictShorten,
    resolveConflictPush,
    dismissConflict,
    resolveLatePush,
    resolveLateCheckEnd,
    dismissReminder,
    dismissEndWarning,
  };

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}
