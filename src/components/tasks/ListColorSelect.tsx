import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ListIcon } from "./list-icons";

interface ListLike {
  id: string;
  name: string;
  color?: string | null;
  emoji?: string | null;
}

/**
 * List picker for the task editor. Shows the chosen list with its color dot +
 * icon + name (in the list's color); clicking opens a colored list of options
 * so it's easy to pick the right list at a glance. Replaces a plain <select>.
 */
export function ListColorSelect({
  lists,
  value,
  onChange,
  disabled,
}: {
  lists: ListLike[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? lists.find((l) => l.id === value) ?? null : null;
  const accent = selected?.color ?? "#6b6b80";

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="field w-full flex items-center gap-2 text-start disabled:opacity-60"
      >
        {selected ? (
          <>
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: accent }} />
            {selected.emoji && <ListIcon emoji={selected.emoji} className="w-4 h-4 shrink-0" />}
            <span className="truncate flex-1 font-medium" style={{ color: accent }}>
              {selected.name}
            </span>
          </>
        ) : (
          <span className="truncate flex-1 text-ink-500">לא משויכת</span>
        )}
        <ChevronDown className="w-4 h-4 text-ink-400 shrink-0" />
      </button>

      {open && !disabled && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 inset-x-0 max-h-64 overflow-y-auto bg-white rounded-xl border border-ink-200 shadow-lift py-1">
            <Option
              label="לא משויכת"
              muted
              selected={value === null}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            />
            {lists.map((l) => (
              <Option
                key={l.id}
                label={l.name}
                color={l.color ?? "#6b6b80"}
                emoji={l.emoji}
                selected={value === l.id}
                onClick={() => {
                  onChange(l.id);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Option({
  label,
  color,
  emoji,
  muted,
  selected,
  onClick,
}: {
  label: string;
  color?: string;
  emoji?: string | null;
  muted?: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-1.5 text-start text-sm hover:bg-ink-50",
        selected && "bg-ink-50"
      )}
    >
      {!muted && (
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
      )}
      {emoji && <ListIcon emoji={emoji} className="w-4 h-4 shrink-0" />}
      <span
        className={cn("truncate flex-1", muted ? "text-ink-500" : "font-medium")}
        style={muted ? undefined : { color }}
      >
        {label}
      </span>
      {selected && <Check className="w-3.5 h-3.5 text-ink-500 shrink-0" />}
    </button>
  );
}
