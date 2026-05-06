/**
 * Half-checkmark icon — used for tasks awaiting approval.
 * The first segment of the ✓ is drawn solid; the second is dashed,
 * indicating an incomplete / pending state.
 *
 * When `onApprove` is provided (i.e. the current user is the approver)
 * the icon renders as a clickable button; otherwise it's a static badge.
 */
interface HalfCheckIconProps {
  size?: number;
  className?: string;
  /** If provided, renders as a button and calls this on click. */
  onApprove?: (e: React.MouseEvent) => void;
  title?: string;
}

export function HalfCheckIcon({
  size = 14,
  className,
  onApprove,
  title = "ממתין לאישור",
}: HalfCheckIconProps) {
  const svg = (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* First (solid) segment of the checkmark */}
      <path
        d="M 2 8.5 L 6.5 13"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Second (dashed) segment — "not yet done" */}
      <path
        d="M 6.5 13 L 14 4.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="2.5 2"
      />
    </svg>
  );

  if (onApprove) {
    return (
      <button
        type="button"
        onClick={onApprove}
        title={title + " — לחץ לאישור"}
        className="shrink-0 inline-flex items-center justify-center text-amber-500 hover:text-amber-600 transition-colors"
        aria-label="אשר משימה"
      >
        {svg}
      </button>
    );
  }

  return (
    <span
      title={title}
      className="shrink-0 inline-flex items-center justify-center text-pink-500"
    >
      {svg}
    </span>
  );
}
