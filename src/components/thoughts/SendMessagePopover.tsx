import { useState } from "react";
import { MessageCircle, Mail, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SendMessagePopoverProps {
  /** Suggested recipient phone or email extracted by the AI from the thought (optional). */
  suggestedRecipient?: string;
  /** Suggested body — usually the thought text. User edits in-place. */
  suggestedBody?: string;
  onClose: () => void;
  /** Called after the user clicks a channel, so the parent can record a processing. */
  onSent: (channel: "whatsapp" | "email") => void;
}

type Channel = "whatsapp" | "email";

/**
 * Small embedded panel for the AI banner — NOT a modal. SPEC §19 §10: we
 * don't send through our own bot; we deep-link to the user's own WhatsApp
 * (`wa.me`) or mail client (`mailto:`). "Schedule send" is shown as
 * disabled with a "בקרוב" tooltip until the scheduler ships.
 */
export function SendMessagePopover({
  suggestedRecipient,
  suggestedBody,
  onClose,
  onSent,
}: SendMessagePopoverProps) {
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [recipient, setRecipient] = useState(suggestedRecipient ?? "");
  const [body, setBody] = useState(suggestedBody ?? "");

  const canSend = recipient.trim().length > 0 && body.trim().length > 0;

  const handleSend = () => {
    if (!canSend) return;
    if (channel === "whatsapp") {
      const phone = recipient.replace(/[^0-9]/g, "");
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      const url = `mailto:${encodeURIComponent(recipient)}?body=${encodeURIComponent(body)}`;
      window.location.href = url;
    }
    onSent(channel);
  };

  return (
    <div className="border border-ink-200 rounded-xl bg-white p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-ink-700">שלח הודעה</div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-ink-100"
          title="סגור"
          type="button"
        >
          <X className="w-3.5 h-3.5 text-ink-500" />
        </button>
      </div>
      <div className="inline-flex rounded-md border border-ink-200 overflow-hidden text-xs">
        <ChannelTab
          active={channel === "whatsapp"}
          onClick={() => setChannel("whatsapp")}
        >
          <MessageCircle className="w-3 h-3" />
          WhatsApp
        </ChannelTab>
        <ChannelTab active={channel === "email"} onClick={() => setChannel("email")}>
          <Mail className="w-3 h-3" />
          מייל
        </ChannelTab>
        <button
          disabled
          title="תזמון שליחה — בקרוב"
          className="inline-flex items-center gap-1 px-2 py-1 text-ink-300 cursor-not-allowed border-s border-ink-200"
          type="button"
        >
          <Clock className="w-3 h-3" />
          תזמן
        </button>
      </div>
      <input
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
        placeholder={
          channel === "whatsapp"
            ? "מספר טלפון (למשל 0501234567)"
            : "כתובת מייל"
        }
        className="field text-sm"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        className="field text-sm resize-none"
        placeholder="תוכן ההודעה"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="btn-ghost text-xs"
          type="button"
        >
          ביטול
        </button>
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            "text-xs font-medium px-3 py-1 rounded-md",
            canSend
              ? "bg-primary-500 text-white hover:bg-primary-600"
              : "bg-ink-100 text-ink-400 cursor-not-allowed"
          )}
          type="button"
        >
          שלח
        </button>
      </div>
    </div>
  );
}

function ChannelTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 border-e border-ink-200 last:border-e-0 transition-colors",
        active ? "bg-ink-900 text-white" : "bg-white text-ink-700 hover:bg-ink-50"
      )}
      type="button"
    >
      {children}
    </button>
  );
}
