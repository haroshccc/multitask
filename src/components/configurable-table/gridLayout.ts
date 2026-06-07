// Generic grid-layout helpers for the configurable table. Extracted verbatim
// from TasksBlock.tsx; parameterized so callers pass their control/actions
// column templates and dynamic column width to preserve identical output.

export interface FixedColumnDescriptor<TKey extends string = string> {
  key: TKey;
  width: string;
  defaultLabel: string;
  align: "start" | "end" | "center";
  sortable: boolean;
  sortKey: string | null;
}

export function buildGridCols<TKey extends string>(
  orderedFixedKeys: TKey[],
  dynColCount: number,
  fixedWidths: Record<TKey, string>,
  opts: { controlCols: string; actionsCol: string; dynColWidth: number }
): string {
  const fixed = orderedFixedKeys.map((k) => fixedWidths[k]).join(" ");
  const dyn = Array.from(
    { length: dynColCount },
    () => `${opts.dynColWidth}px`
  ).join(" ");
  return [opts.controlCols, fixed, dyn, opts.actionsCol]
    .filter(Boolean)
    .join(" ");
}

export function buildGridMinWidth<TKey extends string>(
  orderedFixedKeys: TKey[],
  dynColCount: number,
  fixedWidths: Record<TKey, string>,
  opts: { controlAndActionsWidth: number; dynColWidth: number }
): number {
  // Sum widths roughly: title contributes ~200, others their fixed pixel.
  const fixedTotal = orderedFixedKeys.reduce((sum, k) => {
    const w = fixedWidths[k];
    if (w.includes("minmax")) return sum + 200;
    return sum + parseInt(w, 10);
  }, 0);
  return opts.controlAndActionsWidth + fixedTotal + dynColCount * opts.dynColWidth;
}

export function normalizeFixedOrder<TKey extends string>(
  raw: unknown,
  defaultOrder: TKey[]
): TKey[] {
  if (!Array.isArray(raw) || raw.length === 0) return defaultOrder;
  const valid = raw.filter((k): k is TKey =>
    defaultOrder.includes(k as TKey)
  );
  // Append any default keys missing from the saved order so a future column
  // addition is still discoverable.
  const present = new Set(valid);
  for (const k of defaultOrder) if (!present.has(k)) valid.push(k);
  return valid;
}
