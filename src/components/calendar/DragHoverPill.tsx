import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { type HoverInfo, subscribeHover } from "./calendar-drag";

/**
 * Single floating "08:00 — 09:00" label that tracks the cursor while a
 * calendar drag is in progress. Mounted once per Calendar page; drop
 * targets emit hover updates via `emitHover()`.
 *
 * Why a portal? The pill should sit above all other UI and not be clipped
 * by the calendar's `overflow-hidden` cards.
 */
export function DragHoverPill() {
  const [info, setInfo] = useState<HoverInfo | null>(null);

  useEffect(() => subscribeHover(setInfo), []);

  if (!info || typeof document === "undefined") return null;

  return createPortal(
    <div
      // Below the cursor, slightly to the side, with `pointer-events-none`
      // so the label never absorbs the drop event.
      style={{
        position: "fixed",
        left: info.x + 14,
        top: info.y + 14,
        zIndex: 9999,
        pointerEvents: "none",
      }}
      className="rounded-md bg-ink-900 text-white text-xs font-semibold px-2 py-1 shadow-lift tabular-nums"
    >
      {info.label}
    </div>,
    document.body
  );
}
