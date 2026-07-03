import { useEffect, useState } from "react";
import { Folder, Presentation, ExternalLink, Check, Pencil } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * A pinned project link (files folder / Canva presentation). Shows an "open"
 * affordance when set, and an inline editor to change the URL. Commits on blur.
 */
export function ProjectLinkBox({
  kind,
  label,
  placeholder,
  value,
  onSave,
}: {
  kind: "folder" | "presentation";
  label: string;
  placeholder: string;
  value: string;
  onSave: (url: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const Icon = kind === "folder" ? Folder : Presentation;
  const iconColor = kind === "folder" ? "text-amber-500" : "text-pink-500";
  const has = value.trim().length > 0;

  const commit = () => {
    setEditing(false);
    const v = draft.trim();
    if (v !== value) onSave(v);
  };

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-2.5 flex items-center gap-2">
      <Icon className={cn("w-5 h-5 shrink-0", iconColor)} />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-ink-500 leading-tight">{label}</div>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setDraft(value);
                setEditing(false);
              }
            }}
            placeholder={placeholder}
            dir="ltr"
            className="field text-xs w-full py-1 mt-0.5"
          />
        ) : has ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary-700 hover:underline truncate block"
            dir="ltr"
            title={value}
          >
            {value}
          </a>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-ink-400 hover:text-ink-700 mt-0.5"
          >
            {placeholder}
          </button>
        )}
      </div>
      {!editing && (
        <div className="flex items-center gap-0.5 shrink-0">
          {has && (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded-md text-ink-400 hover:text-primary-700 hover:bg-ink-100"
              title="פתיחה"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-ink-100"
            title="עריכת הקישור"
            aria-label="עריכת הקישור"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {editing && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={commit}
          className="p-1 rounded-md text-success-600 hover:bg-ink-100 shrink-0"
          title="שמירה"
          aria-label="שמירה"
        >
          <Check className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
