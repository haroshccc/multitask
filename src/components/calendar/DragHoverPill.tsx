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
    <>
      {/* Horizontal edge line shown during resize — spans the drop column at
          the cursor Y so the user sees exactly where the block edge will land. */}
      {info.resizeEdge && (
        <div
          style={{
            position: "fixed",
            left: info.resizeEdge.left,
            top: info.resizeEdge.top,
            width: info.resizeEdge.right - info.resizeEdge.left,
            height: 2,
            zIndex: 9998,
            pointerEvents: "none",
          }}
          className="bg-primary-500 shadow-sm"
        />
      )}
      {/* Floating time-range pill below-and-LEFT of the cursor, so a
          right-handed user's hand doesn't cover it on touch. translateX(-100%)
          anchors the pill's right edge just left of the pointer. */}
      <div
        style={{
          position: "fixed",
          left: info.x - 14,
          top: info.y + 14,
          transform: "translateX(-100%)",
          zIndex: 9999,
          pointerEvents: "none",
        }}
        className="rounded-md bg-ink-900 text-white text-xs font-semibold px-2 py-1 shadow-lift tabular-nums"
      >
        {info.label}
      </div>
    </>,
    document.body
  );
}
