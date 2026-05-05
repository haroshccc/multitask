import { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, Pencil, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface CategoryOption {
  id: string;
  name: string;
  color: string | null;
}

interface CategoryPickerProps {
  value: string | null;
  onChange: (id: string | null) => void;
  options: CategoryOption[];
  onCreate: (name: string) => Promise<{ id: string } | void>;
  onRename?: (id: string, name: string) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  placeholder?: string;
  /** Optional unset label (e.g. "ללא קטגוריה"). When omitted, no clear option. */
  noneLabel?: string;
  className?: string;
}

/**
 * Compact dropdown for picking, creating, and managing a category. Used for
 * both meal_categories and ingredient_categories — same UI pattern.
 *
 * Inline create: type a new name and press Enter (or click +) to create the
 * category and select it in one step.
 *
 * Inline manage: hover an option to reveal rename/delete affordances. Rename
 * pops a tiny inline input; delete confirms via window.confirm().
 */
export function CategoryPicker({
  value,
  onChange,
  options,
  onCreate,
  onRename,
  onDelete,
  placeholder = "בחר קטגוריה",
  noneLabel,
  className,
}: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const selected = options.find((o) => o.id === value) ?? null;

  const handleCreate = async () => {
    const name = draft.trim();
    if (!name) return;
    const created = await onCreate(name);
    setDraft("");
    if (created && "id" in created) onChange(created.id);
  };

  const handleRename = async (id: string) => {
    const name = renameDraft.trim();
    if (!name || !onRename) return;
    await onRename(id, name);
    setRenamingId(null);
    setRenameDraft("");
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="field text-sm flex items-center justify-between gap-2 cursor-pointer"
      >
        <span className="flex items-center gap-2 min-w-0">
          {selected?.color && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: selected.color }}
            />
          )}
          <span className={cn("truncate", !selected && "text-ink-400")}>
            {selected?.name ?? placeholder}
          </span>
        </span>
        <ChevronDown className="w-4 h-4 text-ink-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 inset-x-0 bg-white border border-ink-200 rounded-md shadow-soft z-30 overflow-hidden">
          <div className="max-h-56 overflow-y-auto py-1">
            {noneLabel && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-start px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-ink-50",
                  value === null && "bg-ink-50 font-medium"
                )}
              >
                <span className="text-ink-500 italic">{noneLabel}</span>
              </button>
            )}
            {options.length === 0 && !noneLabel && (
              <div className="px-3 py-2 text-xs text-ink-400">
                אין עדיין קטגוריות
              </div>
            )}
            {options.map((o) => {
              const isRenaming = renamingId === o.id;
              return (
                <div
                  key={o.id}
                  className={cn(
                    "group flex items-center gap-1 px-2 py-1 text-sm hover:bg-ink-50",
                    o.id === value && "bg-ink-50"
                  )}
                >
                  {isRenaming ? (
                    <input
                      autoFocus
                      type="text"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleRename(o.id);
                        }
                        if (e.key === "Escape") {
                          setRenamingId(null);
                          setRenameDraft("");
                        }
                      }}
                      onBlur={() => handleRename(o.id)}
                      className="field text-sm py-1 flex-1"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onChange(o.id);
                        setOpen(false);
                      }}
                      className="flex items-center gap-2 flex-1 min-w-0 text-start"
                    >
                      {o.color && (
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: o.color }}
                        />
                      )}
                      <span className="truncate">{o.name}</span>
                      {o.id === value && <Check className="w-3 h-3 text-primary-600" />}
                    </button>
                  )}
                  {!isRenaming && (onRename || onDelete) && (
                    <div className="flex items-center opacity-0 group-hover:opacity-100">
                      {onRename && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingId(o.id);
                            setRenameDraft(o.name);
                          }}
                          className="p-1 rounded text-ink-400 hover:text-ink-900 hover:bg-ink-100"
                          title="ערוך שם"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!confirm(`למחוק את "${o.name}"?`)) return;
                            await onDelete(o.id);
                            if (value === o.id) onChange(null);
                          }}
                          className="p-1 rounded text-ink-400 hover:text-danger-600 hover:bg-danger-50"
                          title="מחק"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="border-t border-ink-100 p-1.5 flex items-center gap-1">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              placeholder="קטגוריה חדשה"
              className="field text-sm py-1 flex-1"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={!draft.trim()}
              className="p-1.5 rounded-md text-primary-600 hover:bg-primary-50 disabled:opacity-30 disabled:cursor-not-allowed"
              title="הוסף קטגוריה"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
