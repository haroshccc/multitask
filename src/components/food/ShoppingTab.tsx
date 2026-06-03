import { useMemo, useState, useEffect } from "react";
import {
  Check,
  MessageCircle,
  ShoppingCart,
  ChevronLeft,
  Store,
  ListChecks,
  Trash2,
  PackageCheck,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useMealPlanTemplate,
  useMealPlanDays,
  useMeals,
  useIngredients,
  useIngredientCategories,
} from "@/lib/hooks/useFood";
import {
  useHouseholdStaples,
  useStoreConnections,
  useShoppingRuns,
  useShoppingRun,
  useCreateRunFromDrafts,
  useSetRunItemStatus,
  useSetRunItemsStatus,
  useUpdateShoppingRun,
  useDeleteShoppingRun,
  useRunsWithMissingItems,
  useMergeRunItems,
} from "@/lib/hooks/useShopping";
import { useFoodPeople, PersonAvatar } from "@/lib/food/people";
import {
  buildShoppingList,
  shoppingListToRunItems,
  draftsToShoppingListResult,
  type ShoppingRunItemDraft,
} from "@/lib/food/shopping-list";
import {
  buildStapleSuggestions,
  selectedStaplesToRunItems,
} from "@/lib/food/staples-suggest";
import { providerForConnection } from "@/lib/food/providers";
import {
  SHOPPING_RUN_STATUS_LABELS,
  SHOPPING_ITEM_STATUS_LABELS,
  type ShoppingRunItem,
  type ShoppingItemStatus,
  type ShoppingRunStatus,
} from "@/lib/types/domain";
import { pushUndo } from "@/lib/undo/store";
import { toast } from "@/components/ui/Toast";
import * as shoppingService from "@/lib/services/shopping";

// =============================================================================
// Date helpers (mirrors ShoppingListExportModal)
// =============================================================================

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const RANGE_PRESETS = [
  { id: "tomorrow", label: "מחר" },
  { id: "rest_of_week", label: "עד סוף השבוע" },
  { id: "next_7", label: "7 ימים קדימה" },
  { id: "custom", label: "טווח מותאם" },
] as const;
type RangePreset = (typeof RANGE_PRESETS)[number]["id"];

function presetRange(preset: RangePreset): { from: string; to: string } {
  const t = new Date();
  const tom = new Date(t);
  tom.setDate(t.getDate() + 1);
  if (preset === "rest_of_week") {
    const end = new Date(tom);
    while (end.getDay() !== 6) end.setDate(end.getDate() + 1);
    return { from: isoDate(tom), to: isoDate(end) };
  }
  if (preset === "next_7") {
    const end = new Date(tom);
    end.setDate(tom.getDate() + 6);
    return { from: isoDate(tom), to: isoDate(end) };
  }
  // tomorrow / custom default
  return { from: isoDate(tom), to: isoDate(tom) };
}

// =============================================================================
// Main tab — switches between the live list and a selected run's tracker
// =============================================================================

export function ShoppingTab() {
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  if (openRunId) {
    return (
      <RunTracker runId={openRunId} onBack={() => setOpenRunId(null)} />
    );
  }
  return <ShoppingHome onOpenRun={setOpenRunId} />;
}

// =============================================================================
// Home: live "what do I need" + staples suggestion + "buy now" + runs list
// =============================================================================

function ShoppingHome({ onOpenRun }: { onOpenRun: (id: string) => void }) {
  const { people, me } = useFoodPeople();
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelectedUsers(new Set(people.map((p) => p.userId)));
  }, [people]);

  const [preset, setPreset] = useState<RangePreset>("rest_of_week");
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return isoDate(t);
  });
  const [customTo, setCustomTo] = useState<string>(() => {
    const t = new Date();
    t.setDate(t.getDate() + 7);
    return isoDate(t);
  });

  const range = useMemo(() => {
    if (preset === "custom") return { from: customFrom, to: customTo };
    return presetRange(preset);
  }, [preset, customFrom, customTo]);

  const { data: template = [] } = useMealPlanTemplate();
  const { data: dayRows = [] } = useMealPlanDays(range.from, range.to);
  const { data: meals = [] } = useMeals();
  const { data: ingredients = [] } = useIngredients();
  const { data: ingredientCategories = [] } = useIngredientCategories();
  const { data: staples = [] } = useHouseholdStaples();
  const { data: storeConnections = [] } = useStoreConnections();
  const { data: runs = [] } = useShoppingRuns();

  const liveResult = useMemo(
    () =>
      buildShoppingList({
        userIds: Array.from(selectedUsers),
        fromDate: range.from,
        toDate: range.to,
        template,
        dayRows,
        meals,
        ingredients,
        ingredientCategories,
      }),
    [selectedUsers, range, template, dayRows, meals, ingredients, ingredientCategories]
  );

  // Interactive staple suggestions — which ones to add to this run.
  const stapleSuggestions = useMemo(
    () => buildStapleSuggestions(staples, ingredientCategories),
    [staples, ingredientCategories]
  );
  const [pickedStaples, setPickedStaples] = useState<Set<string>>(new Set());
  const toggleStaple = (id: string) =>
    setPickedStaples((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const [storeId, setStoreId] = useState<string>("");
  const createRun = useCreateRunFromDrafts();
  const mergeItems = useMergeRunItems();

  // Carry-over: missing items from earlier open runs.
  const { data: runsWithMissing = [] } = useRunsWithMissingItems();
  const missingCount = runsWithMissing.reduce((n, r) => n + r.items.length, 0);

  const togglePerson = (uid: string) =>
    setSelectedUsers((s) => {
      const next = new Set(s);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });

  const drafts: ShoppingRunItemDraft[] = useMemo(() => {
    const menuItems = shoppingListToRunItems(liveResult);
    const pickedStapleRows = selectedStaplesToRunItems(
      staples.filter((s) => pickedStaples.has(s.id))
    );
    return [...menuItems, ...pickedStapleRows];
  }, [liveResult, staples, pickedStaples]);

  const [carryPrompt, setCarryPrompt] = useState<{
    runId: string;
    items: ShoppingRunItem[];
  } | null>(null);

  const provider = providerForConnection(
    storeConnections.find((c) => c.id === storeId) ?? null
  );

  const handleBuyNow = async () => {
    if (drafts.length === 0) {
      toast("אין מה לקנות — לא נמצאו פריטים בטווח שנבחר.", "info");
      return;
    }
    const sameDay = range.from === range.to;
    const title = sameDay
      ? `קנייה ל-${range.from}`
      : `קנייה ל-${range.from} – ${range.to}`;
    const run = await createRun.mutateAsync({
      title,
      fromDate: range.from,
      toDate: range.to,
      includedUserIds: Array.from(selectedUsers),
      storeConnectionId: storeId || null,
      drafts,
    });
    pushUndo({
      description: `יצירת סבב קנייה: ${title}`,
      undo: () => shoppingService.deleteShoppingRun(run.id),
      redo: () => {}, // recreation is non-trivial; list refresh covers it
    });
    setPickedStaples(new Set());

    // Hand the COMPLETE list off to the chosen store (export / deeplink) —
    // menu items + the household staples the user just ticked, so the message
    // the store/shopper receives matches what's tracked in the run.
    const exportResult = draftsToShoppingListResult(drafts, ingredientCategories);
    const action = provider.exportList(exportResult, range.from, range.to);
    if (action.type === "open_url") {
      window.open(action.url, "_blank");
    } else if (action.type === "copy") {
      navigator.clipboard
        .writeText(action.text)
        .then(() => toast("הרשימה הועתקה", "success"))
        .catch(() => {});
    }

    // Offer to carry over missing items from earlier runs.
    const allMissing = runsWithMissing.flatMap((r) => r.items);
    if (allMissing.length > 0) {
      setCarryPrompt({ runId: run.id, items: allMissing });
    } else {
      onOpenRun(run.id);
    }
  };

  const confirmCarryOver = async (items: ShoppingRunItem[]) => {
    if (!carryPrompt) return;
    const targetRunId = carryPrompt.runId;
    if (items.length > 0) {
      const res = await mergeItems.mutateAsync({ targetRunId, items });
      pushUndo({
        description: `איחוד ${items.length} פריטים חסרים`,
        undo: () =>
          shoppingService.unmergeRunItems({
            createdItemIds: res.createdItemIds,
            movedFromIds: res.movedFromIds,
          }),
        redo: () => {},
      });
    }
    setCarryPrompt(null);
    onOpenRun(targetRunId);
  };

  if (carryPrompt) {
    return (
      <CarryOverPrompt
        items={carryPrompt.items}
        onConfirm={confirmCarryOver}
        onSkip={() => confirmCarryOver([])}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* People + range selectors */}
      <div className="card p-3 space-y-3">
        <div>
          <h3 className="text-xs font-medium text-ink-700 mb-2">לכלול מי?</h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            {people.map((p) => {
              const sel = selectedUsers.has(p.userId);
              return (
                <button
                  key={p.userId}
                  type="button"
                  onClick={() => togglePerson(p.userId)}
                  className={cn(
                    "inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-sm border transition-colors",
                    sel
                      ? `${p.color.bg} ${p.color.border} ${p.color.text} font-medium`
                      : "bg-white border-ink-200 text-ink-500 hover:bg-ink-50"
                  )}
                >
                  <PersonAvatar person={p} size="xs" />
                  <span>{p.userId === me?.userId ? "אני" : p.displayName}</span>
                  {sel && <Check className="w-3 h-3" />}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-medium text-ink-700 mb-2">לאיזה טווח?</h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            {RANGE_PRESETS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setPreset(r.id)}
                className={cn(
                  "px-3 py-1 rounded-md text-sm border",
                  preset === r.id
                    ? "bg-ink-900 text-white border-ink-900"
                    : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="field text-sm py-1.5 w-auto"
              />
              <span className="text-xs text-ink-500">עד</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="field text-sm py-1.5 w-auto"
              />
            </div>
          )}
        </div>
      </div>

      {/* Live "what do I need" preview */}
      <div className="card p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-ink-900 flex items-center gap-1.5">
            <ShoppingCart className="w-4 h-4" /> מה צריך (מתעדכן עם התפריט)
          </h3>
          <span className="text-[10px] text-ink-400">
            {liveResult.totalLines} מצרכים · {liveResult.slotsCovered} ארוחות
          </span>
        </div>
        {liveResult.groups.length === 0 ? (
          <div className="text-sm text-ink-400 px-3 py-4 border border-dashed border-ink-200 rounded-md text-center">
            אין ארוחות מתוכננות בטווח שנבחר. הוסיפי מנות בתפריט השבועי או האישי.
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {liveResult.groups.map((g) => (
              <div key={g.categoryId ?? "none"}>
                <div className="text-xs font-medium text-ink-500 mb-0.5">
                  {g.categoryName}
                </div>
                <ul className="text-sm text-ink-800 space-y-0.5">
                  {g.items.map((it) => (
                    <li key={it.ingredientId + (it.unitName ?? "")} title={it.sourceMeals.join(", ")}>
                      • {it.ingredientName}
                      {" — "}
                      {Number.isInteger(it.totalQuantity)
                        ? it.totalQuantity
                        : Math.round(it.totalQuantity * 100) / 100}
                      {it.unitName ? ` ${it.unitName}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interactive staples suggestion */}
      {stapleSuggestions.length > 0 && (
        <div className="card p-3">
          <h3 className="text-sm font-semibold text-ink-900 mb-2">
            צריך גם משהו מאלה? (מוצרי בית)
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {stapleSuggestions.map(({ staple, daysSinceAdded }) => {
              const picked = pickedStaples.has(staple.id);
              return (
                <button
                  key={staple.id}
                  type="button"
                  onClick={() => toggleStaple(staple.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm border transition-colors",
                    picked
                      ? "bg-ink-900 text-white border-ink-900"
                      : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
                  )}
                  title={
                    daysSinceAdded == null
                      ? "עוד לא נוסף"
                      : `נוסף לפני ${daysSinceAdded} ימים`
                  }
                >
                  {picked && <Check className="w-3 h-3" />}
                  {staple.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Buy now */}
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <Store className="w-4 h-4 text-ink-500" />
        <select
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          className="field text-sm py-1.5 w-44"
        >
          <option value="">ייצוא (וואטסאפ)</option>
          {storeConnections
            .filter((c) => c.enabled)
            .map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
        </select>
        {missingCount > 0 && (
          <span className="text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1">
            {missingCount} פריטים שלא הגיעו מסבב קודם — נציע לאחד
          </span>
        )}
        <button
          type="button"
          onClick={handleBuyNow}
          disabled={createRun.isPending || drafts.length === 0}
          className="btn-dark text-sm gap-1.5 ms-auto disabled:opacity-40"
        >
          <ShoppingCart className="w-4 h-4" />
          אני קונה עכשיו ({drafts.length})
        </button>
        <span className="text-[10px] text-ink-400 basis-full">
          ייצור סבב קנייה קפוא — תצלום של הרשימה הנוכחית למעקב, ופתיחת החנות שנבחרה.
        </span>
      </div>

      {/* Existing runs */}
      <div className="card p-3">
        <h3 className="text-sm font-semibold text-ink-900 mb-2 flex items-center gap-1.5">
          <ListChecks className="w-4 h-4" /> סבבי קנייה
        </h3>
        {runs.length === 0 ? (
          <div className="text-sm text-ink-400 px-3 py-3 text-center">
            עוד אין סבבי קנייה.
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {runs.map((run) => (
              <li key={run.id}>
                <button
                  type="button"
                  onClick={() => onOpenRun(run.id)}
                  className="w-full flex items-center gap-2 py-2.5 text-start hover:bg-ink-50/40 rounded-md px-1"
                >
                  <RunStatusBadge status={run.status as ShoppingRunStatus} />
                  <span className="font-medium text-ink-900 flex-1 min-w-0 truncate">
                    {run.title}
                  </span>
                  <span className="text-[10px] text-ink-400">
                    {new Date(run.created_at).toLocaleDateString("he-IL")}
                  </span>
                  <ChevronLeft className="w-4 h-4 text-ink-300" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RunStatusBadge({ status }: { status: ShoppingRunStatus }) {
  const tone: Record<ShoppingRunStatus, string> = {
    open: "bg-sky-100 text-sky-800",
    sent: "bg-violet-100 text-violet-800",
    ordered: "bg-amber-100 text-amber-800",
    reconciling: "bg-orange-100 text-orange-800",
    closed: "bg-ink-100 text-ink-500",
  };
  return (
    <span className={cn("text-[10px] rounded-md px-1.5 py-0.5 shrink-0", tone[status])}>
      {SHOPPING_RUN_STATUS_LABELS[status]}
    </span>
  );
}

// =============================================================================
// Carry-over prompt — pick which missing items to merge into the new run
// =============================================================================

function CarryOverPrompt({
  items,
  onConfirm,
  onSkip,
}: {
  items: ShoppingRunItem[];
  onConfirm: (items: ShoppingRunItem[]) => void;
  onSkip: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(items.map((i) => i.id))
  );
  const toggle = (id: string) =>
    setPicked((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="card p-4 space-y-3 max-w-lg mx-auto">
      <h3 className="text-base font-semibold text-ink-900">
        יש {items.length} פריטים שלא הגיעו מסבב קודם
      </h3>
      <p className="text-sm text-ink-500">
        לאחד אותם לסבב החדש כדי שלא יישכחו?
      </p>
      <ul className="divide-y divide-ink-100 max-h-72 overflow-y-auto">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              checked={picked.has(it.id)}
              onChange={() => toggle(it.id)}
              className="w-4 h-4"
            />
            <span className="flex-1 text-sm text-ink-800">{it.name}</span>
            <span className="text-xs text-ink-400">
              {Number(it.quantity)}
              {it.unit ? ` ${it.unit}` : ""}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onSkip} className="btn-ghost text-sm">
          דלגי
        </button>
        <button
          type="button"
          onClick={() => onConfirm(items.filter((i) => picked.has(i.id)))}
          className="btn-dark text-sm gap-1.5"
        >
          <Check className="w-4 h-4" />
          אחדי נבחרים ({picked.size})
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Run tracker — per-item status + reconciliation + manual carry-over + export
// =============================================================================

const ITEM_STATUS_FLOW: ShoppingItemStatus[] = [
  "needed",
  "in_cart",
  "ordered",
  "received",
];

function RunTracker({ runId, onBack }: { runId: string; onBack: () => void }) {
  const { data: run, isLoading } = useShoppingRun(runId);
  const setItemStatus = useSetRunItemStatus();
  const setItemsStatus = useSetRunItemsStatus();
  const updateRun = useUpdateShoppingRun();
  const deleteRun = useDeleteShoppingRun();
  const mergeItems = useMergeRunItems();
  const { data: ingredientCategories = [] } = useIngredientCategories();
  const { data: storeConnections = [] } = useStoreConnections();
  const { data: runsWithMissing = [] } = useRunsWithMissingItems(runId);

  const catName = useMemo(
    () => new Map(ingredientCategories.map((c) => [c.id, c.name])),
    [ingredientCategories]
  );

  if (isLoading) return <div className="card p-6 text-center text-ink-400">טוען...</div>;
  if (!run) {
    return (
      <div className="card p-6 text-center text-ink-400 space-y-2">
        <p>הסבב לא נמצא.</p>
        <button onClick={onBack} className="btn-ghost text-sm">חזרה</button>
      </div>
    );
  }

  // Active items exclude 'moved' (carried to another run).
  const activeItems = run.items.filter((i) => i.status !== "moved");
  const grouped = new Map<string, ShoppingRunItem[]>();
  for (const it of activeItems) {
    const key = it.category_id ? catName.get(it.category_id) ?? "אחר" : "ללא קטגוריה";
    const list = grouped.get(key) ?? [];
    list.push(it);
    grouped.set(key, list);
  }

  const cycleStatus = (it: ShoppingRunItem) => {
    const prev = it.status as ShoppingItemStatus;
    const idx = ITEM_STATUS_FLOW.indexOf(prev);
    // 'missing' / 'moved' aren't part of the happy-path flow (indexOf === -1).
    // Cycling them would silently reset to 'needed' and drop the "didn't
    // arrive" record, so ignore the badge tap for those — they're managed via
    // the reconciliation buttons instead.
    if (idx === -1) return;
    const next = ITEM_STATUS_FLOW[(idx + 1) % ITEM_STATUS_FLOW.length];
    setItemStatus.mutate({ itemId: it.id, status: next });
    pushUndo({
      description: `סטטוס: ${it.name} → ${SHOPPING_ITEM_STATUS_LABELS[next]}`,
      undo: () => setItemStatus.mutate({ itemId: it.id, status: prev }),
      redo: () => setItemStatus.mutate({ itemId: it.id, status: next }),
    });
  };

  const setStatus = (it: ShoppingRunItem, status: ShoppingItemStatus) => {
    const prev = it.status as ShoppingItemStatus;
    setItemStatus.mutate({ itemId: it.id, status });
    pushUndo({
      description: `סטטוס: ${it.name} → ${SHOPPING_ITEM_STATUS_LABELS[status]}`,
      undo: () => setItemStatus.mutate({ itemId: it.id, status: prev }),
      redo: () => setItemStatus.mutate({ itemId: it.id, status }),
    });
  };

  const markRunStatus = (status: ShoppingRunStatus) =>
    updateRun.mutate({
      id: run.id,
      patch: {
        status,
        closed_at: status === "closed" ? new Date().toISOString() : null,
      },
    });

  // Reconciliation: send to 'reconciling' for arrival check.
  const beginReconcile = () => {
    // Anything still 'ordered'/'in_cart' is what we expect to arrive.
    markRunStatus("reconciling");
  };

  const markAllRemainingReceived = () => {
    const ids = activeItems
      .filter((i) => i.status !== "received" && i.status !== "missing")
      .map((i) => i.id);
    if (ids.length === 0) return;
    setItemsStatus.mutate({ itemIds: ids, status: "received", runId: run.id });
  };

  const exportRun = () => {
    // Reuse the shared formatter + the run's chosen provider so the run export
    // matches every other shopping export (one WA/text format) and honors the
    // store the run was created for.
    const result = draftsToShoppingListResult(
      activeItems.map((it) => ({
        ingredientId: it.ingredient_id,
        stapleId: it.staple_id,
        name: it.name,
        quantity: Number(it.quantity),
        unit: it.unit,
        categoryId: it.category_id,
        source: "manual" as const,
        sourceMeals: it.source_meals,
      })),
      ingredientCategories
    );
    const conn =
      storeConnections.find((c) => c.id === run.store_connection_id) ?? null;
    const action = providerForConnection(conn).exportList(
      result,
      run.frozen_from_date,
      run.frozen_to_date
    );
    if (action.type === "open_url") {
      window.open(action.url, "_blank");
    } else {
      navigator.clipboard
        .writeText(action.text)
        .then(() => toast("הרשימה הועתקה", "success"))
        .catch(() => {});
    }
  };

  const carryMissingFromOthers = async () => {
    const allMissing = runsWithMissing.flatMap((r) => r.items);
    if (allMissing.length === 0) {
      toast("אין פריטים חסרים בסבבים אחרים.", "info");
      return;
    }
    const res = await mergeItems.mutateAsync({ targetRunId: run.id, items: allMissing });
    pushUndo({
      description: `איחוד ${allMissing.length} פריטים חסרים`,
      undo: () =>
        shoppingService.unmergeRunItems({
          createdItemIds: res.createdItemIds,
          movedFromIds: res.movedFromIds,
        }),
      redo: () => {},
    });
    toast(`${allMissing.length} פריטים אוחדו לסבב.`, "success");
  };

  const reconciling = run.status === "reconciling";
  const otherMissingCount = runsWithMissing.reduce((n, r) => n + r.items.length, 0);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-md text-ink-500 hover:bg-ink-100"
          title="חזרה"
        >
          <ChevronLeft className="w-5 h-5 rotate-180" />
        </button>
        <h2 className="text-base font-semibold text-ink-900 flex-1 min-w-0 truncate">
          {run.title}
        </h2>
        <RunStatusBadge status={run.status as ShoppingRunStatus} />
      </div>

      {/* Run actions */}
      <div className="card p-2 flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={exportRun} className="btn-ghost text-sm gap-1.5">
          <MessageCircle className="w-4 h-4" /> ייצוא
        </button>
        {!reconciling ? (
          <button
            type="button"
            onClick={beginReconcile}
            className="btn-ghost text-sm gap-1.5"
            title="ההזמנה הגיעה — בדקי מה הגיע ומה חסר"
          >
            <PackageCheck className="w-4 h-4" /> ההזמנה הגיעה
          </button>
        ) : (
          <button
            type="button"
            onClick={markAllRemainingReceived}
            className="btn-ghost text-sm gap-1.5"
          >
            <Check className="w-4 h-4" /> סמני הכל כהתקבל
          </button>
        )}
        {otherMissingCount > 0 && (
          <button
            type="button"
            onClick={carryMissingFromOthers}
            className="btn-ghost text-sm gap-1.5"
            title="משכי פריטים שלא הגיעו מסבבים אחרים"
          >
            <ListChecks className="w-4 h-4" /> אחדי חסר ({otherMissingCount})
          </button>
        )}
        <select
          value={run.status}
          onChange={(e) => markRunStatus(e.target.value as ShoppingRunStatus)}
          className="field text-xs py-1 w-28 ms-auto"
        >
          {(Object.keys(SHOPPING_RUN_STATUS_LABELS) as ShoppingRunStatus[]).map((s) => (
            <option key={s} value={s}>{SHOPPING_RUN_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            if (confirm("למחוק את הסבב?")) {
              deleteRun.mutate(run.id);
              onBack();
            }
          }}
          className="p-1.5 rounded-md text-ink-400 hover:text-danger-600 hover:bg-danger-50"
          title="מחק סבב"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {reconciling && (
        <div className="text-xs text-orange-700 bg-orange-50 rounded-md px-3 py-2">
          מצב בדיקת הגעה: סמני כל פריט כ<b>התקבל</b> או <b>לא הגיע</b>. פריט שלא
          הגיע יישאר בסבב כ"חסר" ותוכלי לאחד אותו לקנייה הבאה.
        </div>
      )}

      {/* Items grouped by category */}
      <div className="card divide-y divide-ink-100">
        {activeItems.length === 0 ? (
          <div className="p-6 text-center text-ink-400">אין פריטים בסבב.</div>
        ) : (
          [...grouped.entries()].map(([cat, items]) => (
            <div key={cat} className="p-2">
              <div className="text-xs font-medium text-ink-500 mb-1 px-1">{cat}</div>
              <ul className="space-y-0.5">
                {items.map((it) => (
                  <RunItemRow
                    key={it.id}
                    item={it}
                    reconciling={reconciling}
                    onCycle={() => cycleStatus(it)}
                    onSetStatus={(s) => setStatus(it, s)}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RunItemRow({
  item,
  reconciling,
  onCycle,
  onSetStatus,
}: {
  item: ShoppingRunItem;
  reconciling: boolean;
  onCycle: () => void;
  onSetStatus: (s: ShoppingItemStatus) => void;
}) {
  const status = item.status as ShoppingItemStatus;
  const tone: Record<ShoppingItemStatus, string> = {
    needed: "text-ink-400 border-ink-300",
    in_cart: "bg-sky-100 text-sky-700 border-sky-300",
    ordered: "bg-amber-100 text-amber-700 border-amber-300",
    received: "bg-emerald-100 text-emerald-700 border-emerald-300",
    missing: "bg-danger-50 text-danger-600 border-danger-300",
    moved: "text-ink-300 border-ink-200",
  };
  const isCarry = item.source === "carryover";

  return (
    <li className="flex items-center gap-2 px-1 py-1.5">
      <button
        type="button"
        onClick={onCycle}
        className={cn(
          "text-[11px] rounded-md px-2 py-0.5 border whitespace-nowrap min-w-[3.5rem] text-center",
          tone[status]
        )}
        title="לחצי לקידום הסטטוס"
      >
        {SHOPPING_ITEM_STATUS_LABELS[status]}
      </button>
      <span
        className={cn(
          "flex-1 min-w-0 truncate text-sm",
          status === "received" && "line-through text-ink-400"
        )}
        title={item.source_meals.length ? item.source_meals.join(", ") : undefined}
      >
        {item.name}
        {isCarry && (
          <span className="text-[10px] text-violet-500 ms-1">(מסבב קודם)</span>
        )}
      </span>
      <span className="text-xs text-ink-400 shrink-0">
        {Number(item.quantity)}
        {item.unit ? ` ${item.unit}` : ""}
      </span>
      {reconciling && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onSetStatus("received")}
            className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50"
            title="הגיע"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSetStatus("missing")}
            className="p-1 rounded-md text-danger-500 hover:bg-danger-50"
            title="לא הגיע"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </li>
  );
}
