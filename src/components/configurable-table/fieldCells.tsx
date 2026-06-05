import { useMemo, useState, useEffect, useRef } from "react";
import {
  Trash2,
  Plus,
  Loader2,
  Clock,
  Calendar as CalendarIcon,
  MapPin,
  Folder,
  User,
  Link2,
  Tag,
  Circle,
  Star,
  CircleDollarSign,
  AlignLeft,
  CheckSquare,
} from "lucide-react";
import { useFileUpload } from "@/lib/hooks/useFileUpload";
import { presignDownload } from "@/lib/services/storage";
import { useOrgMembers } from "@/lib/hooks";
import type { TaskCustomField, CustomFieldType } from "@/lib/types/domain";

// Generic alias — the configurable table operates on any row shape that
// carries a `custom_fields` jsonb column and is described by a custom-field
// definition with the same shape as task_custom_fields.
export type EntityCustomField = TaskCustomField;

interface EntityRow {
  custom_fields: Record<string, unknown> | unknown | null;
}

// ─── Dynamic column cell ────────────────────────────────────────────────────

export function readCustomField(task: EntityRow, key: string): unknown {
  const cf = task.custom_fields as Record<string, unknown> | null;
  if (!cf || typeof cf !== "object") return null;
  return cf[key] ?? null;
}

export function writeCustomField(
  task: EntityRow,
  key: string,
  value: unknown
): Record<string, unknown> {
  const cf = (task.custom_fields as Record<string, unknown> | null) ?? {};
  return { ...cf, [key]: value };
}

export function DynCell({
  field,
  value,
  onSave,
}: {
  field: EntityCustomField;
  value: unknown;
  onSave: (v: unknown) => void;
}) {
  switch (field.field_type) {
    case "text":
      return <DynTextCell value={(value as string) ?? ""} onSave={onSave} />;
    case "number":
      return <DynNumberCell value={value as number | null} onSave={onSave} />;
    case "date":
      return <DynDateCell value={(value as string) ?? ""} onSave={onSave} />;
    case "url":
      return <DynUrlCell value={(value as string) ?? ""} onSave={onSave} />;
    case "checkbox":
      return <DynCheckboxCell value={!!value} onSave={onSave} />;
    case "stars":
      return <DynStarsCell value={(value as number) ?? 0} onSave={onSave} />;
    case "select": {
      const opts = (field.options as SelectOption[] | null) ?? [];
      return (
        <DynSelectCell
          value={(value as string) ?? ""}
          options={opts}
          onSave={onSave}
        />
      );
    }
    case "time":
      return <DynTimeCell value={(value as string) ?? ""} onSave={onSave} />;
    case "location":
      return <DynLocationCell value={(value as string) ?? ""} onSave={onSave} />;
    case "person":
      return <DynPersonCell value={(value as string) ?? ""} onSave={onSave} />;
    case "tag":
      return <DynTagCell value={(value as string[]) ?? []} onSave={onSave} />;
    case "file":
      return (
        <DynFileCell
          value={(value as StoredFile[]) ?? []}
          onSave={onSave}
        />
      );
    default:
      return (
        <span className="text-[10px] text-ink-300 truncate">
          (לא נתמך)
        </span>
      );
  }
}

function DynTextCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onSave(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-full bg-transparent border-0 outline-none text-[11px] text-ink-700 px-1 py-0.5 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-primary-500/40"
    />
  );
}

function DynNumberCell({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState(value?.toString() ?? "");
  useEffect(() => setDraft(value?.toString() ?? ""), [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft === "") {
          if (value !== null) onSave(null);
          return;
        }
        const n = parseFloat(draft);
        if (isFinite(n) && n !== value) onSave(n);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-full bg-transparent border-0 outline-none text-[11px] text-ink-700 tabular-nums text-end px-1 py-0.5 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-primary-500/40"
    />
  );
}

function DynDateCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string | null) => void;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onSave(e.target.value || null)}
      className="w-full bg-transparent border-0 outline-none text-[11px] text-ink-700 px-1 py-0.5 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-primary-500/40"
    />
  );
}

function DynUrlCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string | null) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const isValid = !draft || /^https?:\/\//.test(draft);
  return (
    <div className="flex items-center gap-0.5 min-w-0">
      <input
        type="url"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onSave(draft || null)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder="https://"
        className="w-full min-w-0 bg-transparent border-0 outline-none text-[11px] text-ink-700 px-1 py-0.5 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-primary-500/40 truncate"
      />
      {value && isValid && (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-primary-600 hover:text-primary-700"
          title="פתח בלשונית חדשה"
        >
          ↗
        </a>
      )}
    </div>
  );
}

function DynCheckboxCell({
  value,
  onSave,
}: {
  value: boolean;
  onSave: (v: boolean) => void;
}) {
  return (
    <div className="flex justify-center">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onSave(e.target.checked)}
        className="w-3.5 h-3.5"
      />
    </div>
  );
}

function DynStarsCell({
  value,
  onSave,
}: {
  value: number;
  onSave: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onSave(value === n ? 0 : n)}
          className="text-[12px] leading-none"
          aria-label={`${n}/5`}
        >
          <span
            className={n <= value ? "text-primary-500" : "text-ink-300"}
          >
            ★
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Modal that lets the user manage the options (label + color) for a select
 * column. Saves to `task_custom_fields.options` jsonb on Save.
 */
export function OptionsEditorModal({
  field,
  onSave,
  onClose,
}: {
  field: EntityCustomField;
  onSave: (options: SelectOption[]) => void;
  onClose: () => void;
}) {
  const initial = (field.options as SelectOption[] | null) ?? [];
  const [options, setOptions] = useState<SelectOption[]>(
    initial.length > 0 ? initial : []
  );

  const addOption = () => {
    const idx = options.length;
    setOptions([
      ...options,
      {
        value: `opt_${Date.now().toString(36)}_${idx}`,
        label: "אופציה",
        color: STATUS_COLORS[idx % STATUS_COLORS.length].id,
      },
    ]);
  };

  const updateAt = (i: number, patch: Partial<SelectOption>) => {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  };

  const removeAt = (i: number) => {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/30 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-lift w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-ink-200">
          <h3 className="text-sm font-semibold text-ink-900">
            אפשרויות לעמודה: {field.field_label}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-ink-100 text-ink-500"
            aria-label="סגרי"
          >
            ×
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
          {options.length === 0 ? (
            <p className="text-xs text-ink-500 text-center py-4">
              עוד אין אפשרויות. לחצי "+ הוסיפי" למטה.
            </p>
          ) : (
            options.map((o, i) => {
              const colors = getOptionColor(o.color);
              return (
                <div
                  key={o.value}
                  className="flex items-center gap-2 p-2 border border-ink-200 rounded-md"
                >
                  <input
                    value={o.label}
                    onChange={(e) => updateAt(i, { label: e.target.value })}
                    placeholder="שם אופציה"
                    className="field py-1 text-xs flex-1"
                    style={{ background: colors.bg, color: colors.fg }}
                  />
                  <div className="flex items-center gap-0.5 shrink-0">
                    {STATUS_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => updateAt(i, { color: c.id })}
                        className={
                          "w-4 h-4 rounded-full transition-transform " +
                          (o.color === c.id
                            ? "ring-2 ring-offset-1 ring-ink-900 scale-110"
                            : "hover:scale-110")
                        }
                        style={{ background: c.fg }}
                        aria-label={`צבע ${c.id}`}
                        title={c.id}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="p-1 rounded hover:bg-ink-100 text-ink-400 hover:text-danger shrink-0"
                    aria-label="מחקי"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
          <button
            type="button"
            onClick={addOption}
            className="btn-outline text-xs w-full"
          >
            <Plus className="w-3.5 h-3.5" />
            הוסיפי אפשרות
          </button>
        </div>
        <footer className="px-4 py-3 border-t border-ink-200 flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost text-xs"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={() => onSave(options.filter((o) => o.label.trim()))}
            className="btn-accent text-xs"
          >
            שמרי
          </button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Status palette for select-option chips (mirrors the brand color tokens). Each
 * key maps to a soft background + a saturated foreground for legible chips.
 */
export const STATUS_COLORS: { id: string; bg: string; fg: string }[] = [
  { id: "yellow", bg: "rgba(250, 204, 21, 0.18)", fg: "#a16207" },
  { id: "orange", bg: "rgba(249, 115, 22, 0.16)", fg: "#c2410c" },
  { id: "rose", bg: "rgba(225, 29, 72, 0.14)", fg: "#be123c" },
  { id: "pink", bg: "rgba(236, 72, 153, 0.14)", fg: "#be185d" },
  { id: "purple", bg: "rgba(168, 85, 247, 0.14)", fg: "#7e22ce" },
  { id: "indigo", bg: "rgba(99, 102, 241, 0.14)", fg: "#4338ca" },
  { id: "blue", bg: "rgba(59, 130, 246, 0.14)", fg: "#1d4ed8" },
  { id: "sky", bg: "rgba(14, 165, 233, 0.14)", fg: "#0369a1" },
  { id: "teal", bg: "rgba(20, 184, 166, 0.16)", fg: "#0f766e" },
  { id: "green", bg: "rgba(16, 185, 129, 0.16)", fg: "#047857" },
  { id: "gray", bg: "rgba(107, 114, 128, 0.16)", fg: "#374151" },
];

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

export function getOptionColor(color: string | undefined) {
  return (
    STATUS_COLORS.find((c) => c.id === color) ?? STATUS_COLORS[10] // gray fallback
  );
}

function DynSelectCell({
  value,
  options,
  onSave,
}: {
  value: string;
  options: SelectOption[];
  onSave: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  const colors = getOptionColor(current?.color);

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-[11px] px-1.5 py-0.5 rounded truncate text-start hover:ring-1 hover:ring-primary-500/40 transition-shadow"
        style={{
          background: current ? colors.bg : "transparent",
          color: current ? colors.fg : undefined,
        }}
      >
        {current?.label ?? <span className="text-ink-300">—</span>}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <ul className="absolute end-0 top-full mt-1 z-40 bg-white border border-ink-200 rounded-md shadow-lift min-w-[140px] py-1">
            <li>
              <button
                type="button"
                onClick={() => {
                  onSave(null);
                  setOpen(false);
                }}
                className="w-full text-start text-[10px] text-ink-400 hover:bg-ink-50 px-2 py-1"
              >
                — ללא —
              </button>
            </li>
            {options.map((o) => {
              const c = getOptionColor(o.color);
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onSave(o.value);
                      setOpen(false);
                    }}
                    className="w-full text-start text-[11px] hover:bg-ink-50 px-2 py-1"
                  >
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-[10px]"
                      style={{ background: c.bg, color: c.fg }}
                    >
                      {o.label}
                    </span>
                  </button>
                </li>
              );
            })}
            {options.length === 0 && (
              <li className="px-2 py-1 text-[10px] text-ink-400">
                אין אפשרויות עדיין. דאבל-קליק על שם העמודה ואז ⚙ לעריכה.
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}

function DynTimeCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string | null) => void;
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onSave(e.target.value || null)}
      className="w-full bg-transparent border-0 outline-none text-[11px] text-ink-700 px-1 py-0.5 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-primary-500/40"
    />
  );
}

function DynLocationCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string | null) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div className="flex items-center gap-0.5 min-w-0">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onSave(draft || null)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder="כתובת…"
        className="w-full min-w-0 bg-transparent border-0 outline-none text-[11px] text-ink-700 px-1 py-0.5 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-primary-500/40 truncate"
      />
      {value && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-primary-600 hover:text-primary-700"
          title="פתח במפות"
        >
          <MapPin className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

/**
 * Person picker — first tries to match the value to a known org member; if no
 * match (free-typed name), still renders the initial chip but won't show a
 * profile-tinted highlight. Click opens a dropdown with current org members
 * + a free-text fallback.
 */
function PersonAvatar({
  name,
  avatarUrl,
  size,
}: {
  name: string;
  avatarUrl: string | null;
  size: "sm" | "md";
}) {
  const dim = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const text = size === "sm" ? "text-[9px]" : "text-[10px]";
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={"shrink-0 rounded-full object-cover " + dim}
        loading="lazy"
      />
    );
  }
  return (
    <span
      className={
        "shrink-0 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold " +
        dim +
        " " +
        text
      }
      aria-hidden
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function DynPersonCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string | null) => void;
}) {
  const { data: members = [] } = useOrgMembers();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const matched = members.find(
    (m) => m.profile?.full_name === value || m.profile?.id === value
  );
  const display = matched?.profile?.full_name ?? value;
  const matchedAvatar = matched?.profile?.avatar_url ?? null;

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.trim().toLowerCase();
    return members.filter((m) =>
      (m.profile?.full_name ?? "").toLowerCase().includes(q)
    );
  }, [members, search]);

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-[11px] flex items-center gap-1 px-1 py-0.5 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-primary-500/40 truncate"
      >
        {display ? (
          <>
            <PersonAvatar
              name={display}
              avatarUrl={matchedAvatar}
              size="sm"
            />
            <span className="text-ink-700 truncate">{display}</span>
          </>
        ) : (
          <span className="text-ink-300">+ שיוך</span>
        )}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute end-0 top-full mt-1 z-40 bg-white border border-ink-200 rounded-md shadow-lift min-w-[180px] py-1">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) {
                  onSave(search.trim());
                  setSearch("");
                  setOpen(false);
                }
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="חפשי / הקלידי שם…"
              className="w-full px-2 py-1 border-b border-ink-200 text-[11px] outline-none"
            />
            {value && (
              <button
                type="button"
                onClick={() => {
                  onSave(null);
                  setOpen(false);
                }}
                className="w-full text-start text-[10px] text-ink-400 hover:bg-ink-50 px-2 py-1"
              >
                — נקי שיוך —
              </button>
            )}
            {filtered.length === 0 && search.trim() && (
              <button
                type="button"
                onClick={() => {
                  onSave(search.trim());
                  setSearch("");
                  setOpen(false);
                }}
                className="w-full text-start text-[11px] hover:bg-ink-50 px-2 py-1"
              >
                שיוך ל"{search.trim()}"
              </button>
            )}
            {filtered.map((m) => (
              <button
                key={m.membership.user_id}
                type="button"
                onClick={() => {
                  const name = m.profile?.full_name ?? m.profile?.id ?? "";
                  if (name) onSave(name);
                  setSearch("");
                  setOpen(false);
                }}
                className="w-full text-start text-[11px] flex items-center gap-1.5 hover:bg-ink-50 px-2 py-1"
              >
                <PersonAvatar
                  name={m.profile?.full_name ?? "?"}
                  avatarUrl={m.profile?.avatar_url ?? null}
                  size="sm"
                />
                <span>{m.profile?.full_name ?? "(ללא שם)"}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DynTagCell({
  value,
  onSave,
}: {
  value: string[];
  onSave: (v: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const submit = () => {
    const v = draft.trim();
    if (v && !value.includes(v)) onSave([...value, v]);
    setDraft("");
    setAdding(false);
  };
  return (
    <div className="flex items-center gap-1 flex-wrap min-w-0">
      {value.map((t) => (
        <span
          key={t}
          className="group/tag inline-flex items-center gap-0.5 chip text-[9px] py-0 px-1.5"
        >
          {t}
          <button
            type="button"
            onClick={() => onSave(value.filter((x) => x !== t))}
            className="opacity-0 group-hover/tag:opacity-100 hover:text-danger transition-opacity"
            aria-label="הסירי"
          >
            ×
          </button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={submit}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          placeholder="תג…"
          className="w-12 bg-white border border-ink-300 rounded text-[10px] px-1 outline-none focus:border-primary-500"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-[10px] text-ink-400 hover:text-ink-700"
          aria-label="הוסיפי תג"
        >
          +
        </button>
      )}
    </div>
  );
}

// ─── File upload cell ──────────────────────────────────────────────────────

export interface StoredFile {
  name: string;
  key: string;
  size: number;
  mime: string;
}

/**
 * File upload cell. Picks files via the existing R2-backed pipeline
 * (`useFileUpload` → `presign-put` → R2 PUT), stores `{name, key, size, mime}`
 * tuples in the task's `custom_fields[fieldKey]` array, and lets the user
 * download via on-demand `presignDownload` (presign-get edge function).
 */
/**
 * Single file chip with image-mime preview thumbnail. The thumbnail URL is
 * presigned lazily on mount so we don't blast the storage gateway when a
 * row has many files; if the presign call fails the chip falls back to the
 * filename-only style.
 */
export function FileChip({
  file,
  onDownload,
  onRemove,
}: {
  file: StoredFile;
  onDownload: () => void;
  onRemove: () => void;
}) {
  const isImage = file.mime?.startsWith("image/") ?? false;
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    presignDownload(file.key)
      .then(({ url }) => {
        if (!cancelled) setThumbUrl(url);
      })
      .catch(() => {
        // Stay on text-only chip if presign fails.
      });
    return () => {
      cancelled = true;
    };
  }, [file.key, isImage]);

  return (
    <span
      className="group/file inline-flex items-center gap-0.5 chip text-[9px] py-0 px-1 max-w-[100px]"
      title={`${file.name} (${(file.size / 1024).toFixed(0)} KB)`}
    >
      {thumbUrl ? (
        <button
          type="button"
          onClick={onDownload}
          className="shrink-0 w-4 h-4 rounded overflow-hidden border border-ink-200 hover:border-primary-400"
        >
          <img
            src={thumbUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDownload}
        className="truncate hover:underline"
      >
        {file.name}
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="opacity-0 group-hover/file:opacity-100 hover:text-danger transition-opacity"
        aria-label="הסירי"
      >
        ×
      </button>
    </span>
  );
}

function DynFileCell({
  value,
  onSave,
}: {
  value: StoredFile[];
  onSave: (v: StoredFile[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useFileUpload();
  const [isUploading, setIsUploading] = useState(false);

  const handlePick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const next: StoredFile[] = [...value];
    try {
      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^\w.-]+/g, "_");
        const keySuffix = `task-files/${Date.now()}_${safeName}`;
        const { key } = await upload.upload(file, {
          keySuffix,
          contentType: file.type || "application/octet-stream",
          totalBytes: file.size,
        });
        next.push({
          name: file.name,
          key,
          size: file.size,
          mime: file.type || "application/octet-stream",
        });
      }
      onSave(next);
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDownload = async (file: StoredFile) => {
    try {
      const { url } = await presignDownload(file.key);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      alert("שגיאה ביצירת קישור הורדה");
    }
  };

  return (
    <div className="flex items-center gap-1 flex-wrap min-w-0">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handlePick(e.target.files)}
      />
      {value.map((f) => (
        <FileChip
          key={f.key}
          file={f}
          onDownload={() => handleDownload(f)}
          onRemove={() => onSave(value.filter((x) => x.key !== f.key))}
        />
      ))}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className="text-[10px] text-ink-400 hover:text-primary-600 disabled:opacity-50"
        aria-label="העלי קובץ"
      >
        {isUploading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          "+"
        )}
      </button>
    </div>
  );
}

/**
 * 12 column types per the spec MD's "בחר סוג עמודה" panel. The picker shows
 * them as a grid of icon cards; clicking creates the column with the type's
 * default Hebrew label, which the user can rename later by double-clicking
 * the header.
 */
export const COLUMN_TYPES: {
  type: CustomFieldType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { type: "time", label: "שעה", icon: Clock },
  { type: "date", label: "תאריך יעד", icon: CalendarIcon },
  { type: "location", label: "מיקום", icon: MapPin },
  { type: "file", label: "קבצים", icon: Folder },
  { type: "person", label: "אחראי", icon: User },
  { type: "url", label: "קישור URL", icon: Link2 },
  { type: "tag", label: "תג", icon: Tag },
  { type: "select", label: "סטטוס", icon: Circle },
  { type: "stars", label: "דירוג נוסף", icon: Star },
  { type: "number", label: "עלות חיצונית", icon: CircleDollarSign },
  { type: "text", label: "פירוט ארוך", icon: AlignLeft },
  { type: "checkbox", label: "תיבת סימון", icon: CheckSquare },
];
