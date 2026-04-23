import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal, X, Save, Bookmark, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useSavedFilters,
  useCreateSavedFilter,
  useDeleteSavedFilter,
} from "@/lib/hooks/useSavedFilters";
import type { DashboardScreen, FilterConfig } from "@/lib/types/domain";

/**
 * FilterBar — shared across all work screens.
 *
 * The filter state is driven by the URL (so refresh/share keeps the view).
 * The parent controls WHAT fields are shown by passing `fields`.
 *
 * Usage:
 *   const [filters, setFilters] = useFiltersFromUrl();
 *   <FilterBar
 *     screenKey="tasks"
 *     filters={filters}
 *     onChange={setFilters}
 *     fields={[
 *       { key: 'statuses', type: 'multi-enum', label: 'סטטוס', options: [...] },
 *       { key: 'tags', type: 'multi-text', label: 'תגים' },
 *     ]}
 *   />
 */

export type FilterField =
  | {
      key: keyof FilterConfig;
      type: "multi-enum";
      label: string;
      options: { value: string; label: string }[];
    }
  | {
      key: keyof FilterConfig;
      type: "multi-text";
      label: string;
      /** Optional resolver: given a value, return a human-readable label. */
      resolveLabel?: (v: string) => string;
    }
  | {
      key: keyof FilterConfig;
      type: "number-range";
      label: string;
      min: number;
      max: number;
      minKey: keyof FilterConfig;
      maxKey: keyof FilterConfig;
    }
  | {
      key: keyof FilterConfig;
      type: "date-range";
      label: string;
      fromKey: keyof FilterConfig;
      toKey: keyof FilterConfig;
    }
  | {
      key: keyof FilterConfig;
      type: "boolean";
      label: string;
    };

interface FilterBarProps {
  screenKey: DashboardScreen;
  filters: FilterConfig;
  onChange: (next: FilterConfig) => void;
  fields: FilterField[];
  className?: string;
}

export function FilterBar({
  screenKey,
  filters,
  onChange,
  fields,
  className,
}: FilterBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: savedFilters = [] } = useSavedFilters(screenKey);
  const createSaved = useCreateSavedFilter();
  const deleteSaved = useDeleteSavedFilter();
  const [savingName, setSavingName] = useState<string | null>(null);

  const activeCount = countActive(filters);

  const clearAll = () => onChange({});

  const applySaved = (config: FilterConfig) => {
    onChange(config);
    setDrawerOpen(false);
  };

  const saveCurrent = async () => {
    if (!savingName?.trim()) return;
    await createSaved.mutateAsync({
      screenKey,
      name: savingName.trim(),
      filter_config: filters,
    });
    setSavingName(null);
  };

  return (
    <>
      <div className={cn("card p-3 flex items-center gap-2 flex-wrap", className)}>
        <button
          onClick={() => setDrawerOpen(true)}
          className={cn(
            "btn-outline text-xs",
            activeCount > 0 && "border-primary-500 text-primary-700"
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          סנן
          {activeCount > 0 && (
            <span className="ms-1 inline-flex items-center justify-center rounded-full bg-primary-500 text-white text-[10px] w-4 h-4">
              {activeCount}
            </span>
          )}
        </button>

        <ActiveFilterChips filters={filters} fields={fields} onChange={onChange} />

        {activeCount > 0 && (
          <button onClick={clearAll} className="btn-ghost text-xs py-1 px-2">
            <X className="w-3 h-3" />
            נקה
          </button>
        )}

        <div className="ms-auto flex items-center gap-1 flex-wrap">
          {savedFilters.map((sf) => (
            <div key={sf.id} className="flex items-center">
              <button
                onClick={() => applySaved(sf.filter_config as FilterConfig)}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border border-ink-200 bg-white hover:bg-ink-50"
              >
                <Bookmark className="w-3 h-3" />
                {sf.name}
              </button>
              <button
                onClick={() =>
                  deleteSaved.mutate({ filterId: sf.id, screenKey })
                }
                className="p-0.5 text-ink-400 hover:text-danger-500"
                title="מחק פילטר שמור"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {activeCount > 0 && (
            <button
              onClick={() => setSavingName("")}
              className="btn-ghost text-xs py-1 px-2"
            >
              <Save className="w-3 h-3" />
              שמור סינון
            </button>
          )}
        </div>
      </div>

      {savingName !== null && (
        <div className="fixed inset-0 z-50 bg-ink-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-lift w-full max-w-sm p-4 space-y-3">
            <h3 className="font-semibold text-ink-900">שמור סינון נוכחי</h3>
            <input
              autoFocus
              value={savingName}
              onChange={(e) => setSavingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveCurrent();
                if (e.key === "Escape") setSavingName(null);
              }}
              placeholder='שם (למשל "השבוע שלי")'
              className="field"
            />
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setSavingName(null)} className="btn-ghost text-xs">
                בטל
              </button>
              <button onClick={saveCurrent} className="btn-accent text-xs">
                שמור
              </button>
            </div>
          </div>
        </div>
      )}

      {drawerOpen && (
        <FilterDrawer
          fields={fields}
          filters={filters}
          onChange={onChange}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </>
  );
}

function FilterDrawer({
  fields,
  filters,
  onChange,
  onClose,
}: {
  fields: FilterField[];
  filters: FilterConfig;
  onChange: (next: FilterConfig) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<FilterConfig>(filters);

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/40" onClick={onClose}>
      <aside
        className="absolute top-0 end-0 bottom-0 w-full max-w-sm bg-white shadow-lift overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-ink-200 px-4 py-3 flex items-center justify-between z-10">
          <h3 className="font-semibold text-ink-900">סינון</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-5">
          {fields.map((field) => (
            <FieldEditor
              key={`${field.type}-${String(field.key)}`}
              field={field}
              value={draft}
              onChange={setDraft}
            />
          ))}
        </div>
        <div className="sticky bottom-0 bg-white border-t border-ink-200 p-3 flex items-center gap-2">
          <button
            onClick={() => {
              setDraft({});
              onChange({});
              onClose();
            }}
            className="btn-ghost text-sm flex-1"
          >
            נקה הכל
          </button>
          <button
            onClick={() => {
              onChange(draft);
              onClose();
            }}
            className="btn-accent text-sm flex-1"
          >
            החל סינון
          </button>
        </div>
      </aside>
    </div>
  );
}

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: FilterField;
  value: FilterConfig;
  onChange: (v: FilterConfig) => void;
}) {
  if (field.type === "multi-enum") {
    const current = ((value[field.key] as string[] | undefined) ?? []);
    const toggle = (opt: string) => {
      const next = current.includes(opt)
        ? current.filter((x) => x !== opt)
        : [...current, opt];
      onChange({ ...value, [field.key]: next as FilterConfig[typeof field.key] });
    };
    return (
      <div>
        <label className="eyebrow mb-1.5 block">{field.label}</label>
        <div className="flex flex-wrap gap-1.5">
          {field.options.map((opt) => {
            const active = current.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border",
                  active
                    ? "bg-primary-500 text-white border-primary-500"
                    : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
                )}
              >
                {active && <Check className="w-3 h-3" />}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === "multi-text") {
    const current = ((value[field.key] as string[] | undefined) ?? []);
    const [draft, setDraft] = useTextDraft();
    const add = () => {
      if (!draft.trim()) return;
      onChange({
        ...value,
        [field.key]: [...current, draft.trim()] as FilterConfig[typeof field.key],
      });
      setDraft("");
    };
    const remove = (v: string) => {
      onChange({
        ...value,
        [field.key]: current.filter((x) => x !== v) as FilterConfig[typeof field.key],
      });
    };
    return (
      <div>
        <label className="eyebrow mb-1.5 block">{field.label}</label>
        <div className="flex items-center gap-1 mb-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            className="field text-sm"
            placeholder="הקלד והקש Enter"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {current.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-xs"
            >
              {v}
              <button onClick={() => remove(v)} className="text-ink-500 hover:text-danger-500">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "number-range") {
    const min = value[field.minKey] as number | undefined;
    const max = value[field.maxKey] as number | undefined;
    return (
      <div>
        <label className="eyebrow mb-1.5 block">{field.label}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={min ?? ""}
            min={field.min}
            max={field.max}
            onChange={(e) =>
              onChange({
                ...value,
                [field.minKey]: e.target.value
                  ? Number(e.target.value)
                  : (undefined as FilterConfig[typeof field.minKey]),
              })
            }
            placeholder="מ-"
            className="field text-sm"
          />
          <span className="text-ink-400">—</span>
          <input
            type="number"
            value={max ?? ""}
            min={field.min}
            max={field.max}
            onChange={(e) =>
              onChange({
                ...value,
                [field.maxKey]: e.target.value
                  ? Number(e.target.value)
                  : (undefined as FilterConfig[typeof field.maxKey]),
              })
            }
            placeholder="עד"
            className="field text-sm"
          />
        </div>
      </div>
    );
  }

  if (field.type === "date-range") {
    const from = value[field.fromKey] as string | undefined;
    const to = value[field.toKey] as string | undefined;
    return (
      <div>
        <label className="eyebrow mb-1.5 block">{field.label}</label>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from?.slice(0, 10) ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                [field.fromKey]: e.target.value
                  ? (e.target.value as FilterConfig[typeof field.fromKey])
                  : (undefined as FilterConfig[typeof field.fromKey]),
              })
            }
            className="field text-sm"
          />
          <span className="text-ink-400">—</span>
          <input
            type="date"
            value={to?.slice(0, 10) ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                [field.toKey]: e.target.value
                  ? (e.target.value as FilterConfig[typeof field.toKey])
                  : (undefined as FilterConfig[typeof field.toKey]),
              })
            }
            className="field text-sm"
          />
        </div>
      </div>
    );
  }

  if (field.type === "boolean") {
    const current = Boolean(value[field.key]);
    return (
      <label className="flex items-center justify-between py-1 cursor-pointer">
        <span className="text-sm text-ink-900">{field.label}</span>
        <input
          type="checkbox"
          checked={current}
          onChange={(e) =>
            onChange({
              ...value,
              [field.key]: (e.target.checked ||
                undefined) as FilterConfig[typeof field.key],
            })
          }
          className="w-4 h-4"
        />
      </label>
    );
  }

  return null;
}

function ActiveFilterChips({
  filters,
  fields,
  onChange,
}: {
  filters: FilterConfig;
  fields: FilterField[];
  onChange: (next: FilterConfig) => void;
}): ReactNode {
  const chips: { label: string; onRemove: () => void }[] = [];

  fields.forEach((field) => {
    if (field.type === "multi-enum") {
      const current = (filters[field.key] as string[] | undefined) ?? [];
      current.forEach((v) => {
        const opt = field.options.find((o) => o.value === v);
        chips.push({
          label: `${field.label}: ${opt?.label ?? v}`,
          onRemove: () =>
            onChange({
              ...filters,
              [field.key]: current.filter(
                (x) => x !== v
              ) as FilterConfig[typeof field.key],
            }),
        });
      });
    } else if (field.type === "multi-text") {
      const current = (filters[field.key] as string[] | undefined) ?? [];
      current.forEach((v) => {
        chips.push({
          label: `${field.label}: ${field.resolveLabel ? field.resolveLabel(v) : v}`,
          onRemove: () =>
            onChange({
              ...filters,
              [field.key]: current.filter(
                (x) => x !== v
              ) as FilterConfig[typeof field.key],
            }),
        });
      });
    } else if (field.type === "boolean" && filters[field.key]) {
      chips.push({
        label: field.label,
        onRemove: () =>
          onChange({ ...filters, [field.key]: undefined as FilterConfig[typeof field.key] }),
      });
    }
  });

  return (
    <>
      {chips.map((c, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full bg-primary-50 border border-primary-200 px-2 py-0.5 text-xs text-primary-700"
        >
          {c.label}
          <button onClick={c.onRemove} className="hover:text-danger-600">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
    </>
  );
}

function countActive(filters: FilterConfig): number {
  let n = 0;
  Object.values(filters).forEach((v) => {
    if (Array.isArray(v)) n += v.length;
    else if (v !== undefined && v !== null && v !== "" && v !== false) n += 1;
  });
  return n;
}

function useTextDraft(): [string, (v: string) => void] {
  const [draft, setDraft] = useState("");
  return [draft, setDraft];
}

// URL <-> FilterConfig helpers ----------------------------------------------

/**
 * Sync filter state with URL query params, so refresh/share preserves the view.
 * Usage:
 *   const [filters, setFilters] = useFiltersFromUrl();
 */
export function useFiltersFromUrl(): [
  FilterConfig,
  (next: FilterConfig) => void,
] {
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState<FilterConfig>(() =>
    parseFiltersFromParams(params)
  );

  useEffect(() => {
    setFilters(parseFiltersFromParams(params));
    // Listen only when URL search string changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  const update = (next: FilterConfig) => {
    setFilters(next);
    const p = new URLSearchParams(params);
    // Remove existing filter params, then write new ones
    FILTER_KEYS.forEach((k) => p.delete(k));
    Object.entries(next).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "" || v === false) return;
      if (Array.isArray(v)) {
        if (v.length > 0) p.set(k, v.join(","));
      } else {
        p.set(k, String(v));
      }
    });
    setParams(p, { replace: true });
  };

  return [filters, update];
}

const FILTER_KEYS: (keyof FilterConfig)[] = [
  "projects",
  "lists",
  "statuses",
  "urgencyMin",
  "urgencyMax",
  "tags",
  "assignees",
  "sources",
  "dueBefore",
  "dueAfter",
  "scheduledBefore",
  "scheduledAfter",
  "onlyMine",
  "onlyWithTimer",
  "onlyOverBudget",
  "pricingModes",
];

function parseFiltersFromParams(params: URLSearchParams): FilterConfig {
  const r: FilterConfig = {};
  for (const k of FILTER_KEYS) {
    const v = params.get(k);
    if (v === null) continue;
    if (
      k === "urgencyMin" ||
      k === "urgencyMax"
    ) {
      r[k] = Number(v);
    } else if (k === "onlyMine" || k === "onlyWithTimer" || k === "onlyOverBudget") {
      r[k] = v === "true";
    } else if (
      k === "projects" ||
      k === "lists" ||
      k === "statuses" ||
      k === "tags" ||
      k === "assignees" ||
      k === "sources" ||
      k === "pricingModes"
    ) {
      (r[k] as string[]) = v.split(",").filter(Boolean);
    } else {
      (r[k] as string) = v;
    }
  }
  return r;
}
