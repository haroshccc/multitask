import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Send, X, Plus, CheckSquare, Calendar, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCreateThought } from "@/lib/queries/thoughts";
import { useCreateTask } from "@/lib/queries/tasks";

interface QuickCaptureProps {
  open: boolean;
  onClose: () => void;
  currentPath: string;
}

type Mode = "menu" | "thought" | "task" | "recording";

export function QuickCapture({ open, onClose }: QuickCaptureProps) {
  const navigate = useNavigate();
  const { user, activeOrganizationId } = useAuth();
  const createThought = useCreateThought();
  const createTask = useCreateTask();
  const [mode, setMode] = useState<Mode>("menu");
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "thought" || mode === "task") {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open, mode]);

  useEffect(() => {
    if (!open) {
      setMode("menu");
      setText("");
      setIsRecording(false);
      setSeconds(0);
      setError(null);
      if (timerRef.current) window.clearInterval(timerRef.current);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const startRecording = () => {
    setMode("recording");
    setIsRecording(true);
    setSeconds(0);
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
    // TODO: upload audio blob + create thought row
  };

  const saveThought = async () => {
    const body = text.trim();
    if (!body) return;
    if (!user || !activeOrganizationId) {
      setError("חסר ארגון פעיל — נסי להתחבר מחדש");
      return;
    }
    setError(null);
    try {
      await createThought.mutateAsync({
        orgId: activeOrganizationId,
        ownerId: user.id,
        text: body,
        source: "app_text",
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  };

  const saveTask = async () => {
    const title = text.trim();
    if (!title) return;
    if (!user || !activeOrganizationId) {
      setError("חסר ארגון פעיל — נסי להתחבר מחדש");
      return;
    }
    setError(null);
    try {
      await createTask.mutateAsync({
        orgId: activeOrganizationId,
        ownerId: user.id,
        title,
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-lift w-full max-w-lg overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-ink-200">
              <h3 className="font-semibold text-ink-900">
                {mode === "menu" && "יצירה מהירה"}
                {mode === "thought" && "מחשבה מהירה"}
                {mode === "task" && "משימה מהירה"}
                {mode === "recording" && (isRecording ? "מקליטה..." : "הקלטה")}
              </h3>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100">
                <X className="w-4 h-4 text-ink-600" />
              </button>
            </div>

            <div className="p-5">
              {mode === "menu" && (
                <div className="grid grid-cols-2 gap-3">
                  <MenuAction
                    icon={Mic}
                    label="הקלטה מהירה"
                    accent
                    onClick={startRecording}
                  />
                  <MenuAction
                    icon={Plus}
                    label="מחשבה מוקלדת"
                    onClick={() => setMode("thought")}
                  />
                  <MenuAction
                    icon={CheckSquare}
                    label="משימה חדשה"
                    onClick={() => {
                      setText("");
                      setMode("task");
                    }}
                  />
                  <MenuAction
                    icon={Calendar}
                    label="אירוע חדש"
                    onClick={() => {
                      onClose();
                      navigate("/app/calendar");
                    }}
                  />
                  <MenuAction
                    icon={FolderKanban}
                    label="פרויקט חדש"
                    onClick={() => {
                      onClose();
                      navigate("/app/projects");
                    }}
                  />
                </div>
              )}

              {mode === "task" && (
                <div className="space-y-3">
                  <textarea
                    ref={textareaRef}
                    className="field min-h-[80px] resize-none"
                    placeholder="כותרת המשימה — Enter לשמירה"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={createTask.isPending}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        saveTask();
                      }
                    }}
                  />
                  {error && (
                    <div className="text-xs text-danger-600 bg-danger-500/10 border border-danger-500/20 rounded-xl px-3 py-2">
                      {error}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setMode("menu")}
                      className="btn-ghost"
                      disabled={createTask.isPending}
                    >
                      חזרה
                    </button>
                    <button
                      onClick={saveTask}
                      disabled={!text.trim() || createTask.isPending}
                      className="btn-accent"
                    >
                      <Send className="w-4 h-4" />
                      <span>{createTask.isPending ? "שומרת..." : "צרי משימה"}</span>
                    </button>
                  </div>
                </div>
              )}

              {mode === "thought" && (
                <div className="space-y-3">
                  <textarea
                    ref={textareaRef}
                    className="field min-h-[120px] resize-none"
                    placeholder="מה עולה לך ברגע זה? Enter מוסיף, Shift+Enter לשורה חדשה..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={createThought.isPending}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        saveThought();
                      }
                    }}
                  />
                  {error && (
                    <div className="text-xs text-danger-600 bg-danger-500/10 border border-danger-500/20 rounded-xl px-3 py-2">
                      {error}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setMode("menu")}
                      className="btn-ghost"
                      disabled={createThought.isPending}
                    >
                      חזרה
                    </button>
                    <button
                      onClick={saveThought}
                      disabled={!text.trim() || createThought.isPending}
                      className="btn-accent"
                    >
                      <Send className="w-4 h-4" />
                      <span>{createThought.isPending ? "שומרת..." : "שמרי"}</span>
                    </button>
                  </div>
                </div>
              )}

              {mode === "recording" && (
                <div className="flex flex-col items-center gap-6 py-6">
                  <div
                    className={cn(
                      "w-24 h-24 rounded-full flex items-center justify-center transition-all",
                      isRecording
                        ? "bg-gradient-to-br from-danger-500 to-danger-600 animate-pulse shadow-lift"
                        : "bg-ink-100"
                    )}
                  >
                    <Mic className={cn("w-10 h-10", isRecording ? "text-white" : "text-ink-500")} />
                  </div>
                  <div className="font-mono text-3xl text-ink-900 tabular-nums">
                    {formatTime(seconds)}
                  </div>
                  {isRecording ? (
                    <button onClick={stopRecording} className="btn-primary">
                      <Square className="w-4 h-4" />
                      סיום הקלטה
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setMode("menu")} className="btn-ghost">
                        בטל
                      </button>
                      <button onClick={startRecording} className="btn-accent">
                        <Mic className="w-4 h-4" />
                        הקלטה נוספת
                      </button>
                      <button onClick={onClose} className="btn-primary">
                        <Send className="w-4 h-4" />
                        שמרי
                      </button>
                    </div>
                  )}
                  {!isRecording && (
                    <p className="text-xs text-ink-500 text-center max-w-xs">
                      האודיו יעלה ל-Supabase Storage, יתומלל ע"י Gladia, ו-AI יחלץ ממנו משימות.
                      (האינטגרציות ייופעלו כשהחשבונות יהיו מוכנים — בינתיים UI בלבד.)
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MenuAction({
  icon: Icon,
  label,
  onClick,
  accent,
}: {
  icon: typeof Mic;
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all hover:-translate-y-0.5",
        accent
          ? "border-primary-200 bg-primary-50 hover:bg-primary-100"
          : "border-ink-200 bg-white hover:bg-ink-50"
      )}
    >
      <Icon className={cn("w-6 h-6", accent ? "text-primary-700" : "text-ink-700")} />
      <span className="text-sm font-medium text-ink-900">{label}</span>
    </button>
  );
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
