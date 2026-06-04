import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, X, Send, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAssistantUi } from "@/lib/ai/store";
import { useActiveSkill } from "@/lib/ai/registry";
import { useAssistantChat } from "@/lib/hooks/useAssistant";
import { AssistantProposalCard } from "./AssistantProposalCard";

/**
 * Global AI assistant panel. Mounts once at the AppShell level; picks the
 * active skill from the current route. Renders the chat + tool-proposal cards.
 * MVP: the food skill on /app/food; elsewhere it shows a "not here yet" note.
 */
export function AssistantPanel() {
  const { open, setOpen } = useAssistantUi();
  const location = useLocation();
  const skill = useActiveSkill(location.pathname);
  const chat = useAssistantChat(skill);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest message / proposal.
  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.messages, chat.pending, chat.busy, open]);

  if (!open) return null;

  const submit = () => {
    const t = input.trim();
    if (!t) return;
    setInput("");
    chat.sendMessage(t);
  };

  // Index pending tool calls by the assistant message they belong to so each
  // message renders its own cards inline.
  const pendingByMessage = new Map<number, typeof chat.pending>();
  for (const p of chat.pending) {
    const list = pendingByMessage.get(p.messageIndex) ?? [];
    list.push(p);
    pendingByMessage.set(p.messageIndex, list);
  }

  return (
    <div
      className="fixed inset-0 z-50 md:inset-auto md:bottom-4 md:start-4 md:w-[26rem] md:max-h-[80vh] flex flex-col bg-white md:rounded-2xl shadow-lift border border-ink-200"
      dir="rtl"
    >
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-3 border-b border-ink-100 shrink-0">
        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-primary-600 flex items-center justify-center text-white">
          <Sparkles className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink-900 truncate">
            {skill ? skill.label : "עוזר AI"}
          </div>
        </div>
        {chat.messages.length > 0 && (
          <button
            type="button"
            onClick={chat.reset}
            className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100"
            title="שיחה חדשה"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100"
          title="סגור"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {!skill ? (
          <div className="text-sm text-ink-400 text-center py-8">
            העוזר עדיין לא זמין במסך הזה. נסי במסך "התנהלות אוכל".
          </div>
        ) : chat.messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-500">
              שלום! אני {skill.label}. ספרי לי איזו מנה להוסיף ואבנה לך אותה — מתכון,
              מצרכים, וערכים תזונתיים.
            </p>
            {skill.starters && skill.starters.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {skill.starters.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => chat.sendMessage(s)}
                    className="text-start text-sm rounded-lg border border-ink-200 px-3 py-2 hover:bg-ink-50 text-ink-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          chat.messages.map((m, i) => (
            <div key={i} className="space-y-2">
              {m.content && (
                <div
                  className={cn(
                    "text-sm rounded-2xl px-3 py-2 max-w-[90%] whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-ink-900 text-white ms-auto"
                      : "bg-ink-100 text-ink-900 me-auto"
                  )}
                >
                  {m.content}
                </div>
              )}
              {(pendingByMessage.get(i) ?? []).map((p) => (
                <AssistantProposalCard
                  key={p.id}
                  call={p}
                  onApprove={chat.approveTool}
                  onDismiss={chat.dismissTool}
                />
              ))}
            </div>
          ))
        )}

        {chat.busy && (
          <div className="flex items-center gap-2 text-sm text-ink-400">
            <Loader2 className="w-4 h-4 animate-spin" /> חושב...
          </div>
        )}
        {chat.error && (
          <div className="text-sm text-danger-600 bg-danger-50 rounded-lg px-3 py-2">
            {chat.error}
          </div>
        )}
      </div>

      {/* Composer */}
      {skill && (
        <div className="p-3 border-t border-ink-100 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="כתבי הודעה..."
              className="field text-sm flex-1 resize-none max-h-28"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!input.trim() || chat.busy}
              className="btn-dark p-2 rounded-xl disabled:opacity-40"
              title="שלח"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
