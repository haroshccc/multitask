import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  Loader2,
  ImagePlus,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAssistantUi } from "@/lib/ai/store";
import { useActiveSkill } from "@/lib/ai/registry";
import { useAssistantChat } from "@/lib/hooks/useAssistant";
import { fileToChatImage, chatImageSrc } from "@/lib/ai/image";
import type { ChatImage } from "@/lib/ai/types";
import { AssistantProposalCard } from "./AssistantProposalCard";

const MAX_ATTACHMENTS = 6;

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
  const [expanded, setExpanded] = useState(false);
  const [attachments, setAttachments] = useState<ChatImage[]>([]);
  const [attaching, setAttaching] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to the newest message / proposal.
  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.messages, chat.pending, chat.busy, attachments, open]);

  if (!open) return null;

  const pickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttaching(true);
    try {
      const imgs = await Promise.all(
        Array.from(files)
          .filter((f) => f.type.startsWith("image/"))
          .map(fileToChatImage)
      );
      setAttachments((prev) => [...prev, ...imgs].slice(0, MAX_ATTACHMENTS));
    } catch {
      /* ignore decode errors — the user can retry */
    } finally {
      setAttaching(false);
    }
  };

  const submit = () => {
    const t = input.trim();
    if ((!t && attachments.length === 0) || chat.busy) return;
    const imgs = attachments;
    setInput("");
    setAttachments([]);
    chat.sendMessage(t, imgs.length ? imgs : undefined);
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
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-white shadow-lift border border-ink-200",
        "md:inset-auto md:bottom-4 md:start-4 md:rounded-2xl",
        expanded
          ? "md:w-[54rem] md:max-w-[calc(100vw-2rem)] md:h-[90vh] md:max-h-[calc(100vh-2rem)]"
          : "md:w-[26rem] md:max-h-[80vh]"
      )}
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
          onClick={() => setExpanded((v) => !v)}
          className="hidden md:inline-flex p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100"
          title={expanded ? "הקטן חלון" : "הגדל חלון"}
        >
          {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
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
              מצרכים, וערכים תזונתיים. אפשר גם לצרף תמונה של מתכון, אריזת מוצר או תווית
              ערכים תזונתיים ואני אקרא ממנה את הפרטים.
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
              {m.images && m.images.length > 0 && (
                <div className="flex flex-wrap gap-1.5 ms-auto max-w-[90%] justify-end">
                  {m.images.map((img, k) => (
                    <img
                      key={k}
                      src={chatImageSrc(img)}
                      alt="תמונה שצורפה"
                      className="w-24 h-24 object-cover rounded-xl border border-ink-200"
                    />
                  ))}
                </div>
              )}
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
          {/* Pending image attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map((img, k) => (
                <div key={k} className="relative">
                  <img
                    src={chatImageSrc(img)}
                    alt="תצוגה מקדימה"
                    className="w-16 h-16 object-cover rounded-lg border border-ink-200"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((prev) => prev.filter((_, idx) => idx !== k))
                    }
                    className="absolute -top-1.5 -start-1.5 w-5 h-5 rounded-full bg-ink-900 text-white flex items-center justify-center shadow"
                    title="הסר תמונה"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                pickFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={attaching || attachments.length >= MAX_ATTACHMENTS}
              className="p-2 rounded-xl text-ink-500 hover:text-ink-900 hover:bg-ink-100 disabled:opacity-40 shrink-0"
              title="צרפי תמונה (מתכון, אריזת מוצר, תווית ערכים תזונתיים)"
            >
              {attaching ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ImagePlus className="w-5 h-5" />
              )}
            </button>
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
              placeholder="כתבי הודעה או צרפי תמונה..."
              className="field text-sm flex-1 resize-none max-h-28"
            />
            <button
              type="button"
              onClick={submit}
              disabled={(!input.trim() && attachments.length === 0) || chat.busy}
              className="btn-dark p-2 rounded-xl disabled:opacity-40 shrink-0"
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
