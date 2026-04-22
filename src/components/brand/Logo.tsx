/**
 * Brand mark — the animated "M" symbol with crossed legs.
 * SVG geometry copied verbatim from design-language.html (section 01).
 * The animated stop-colors cycle through yellow → amber → pink every 6s.
 *
 * Usage:
 *   <LogoMark />                        → animated gradient (default)
 *   <LogoMark variant="white" />        → solid white strokes (on dark bg)
 *   <LogoMark variant="dark" />         → solid ink-900 strokes
 *   <LogoMark size={72} />              → custom pixel size
 */

import { cn } from "@/lib/utils/cn";

interface LogoMarkProps {
  size?: number;
  variant?: "gradient" | "white" | "dark";
  className?: string;
  /** Unique id used to isolate the gradient defs when multiple marks render on one page */
  idKey?: string;
}

export function LogoMark({
  size = 40,
  variant = "gradient",
  className,
  idKey = "mGrad",
}: LogoMarkProps) {
  const height = Math.round(size * (110 / 80));
  const strokeColor =
    variant === "gradient"
      ? `url(#${idKey})`
      : variant === "white"
      ? "#ffffff"
      : "#111118";

  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 80 110"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {variant === "gradient" && (
        <defs>
          <linearGradient
            id={idKey}
            x1="0"
            y1="0"
            x2="80"
            y2="110"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#facc15">
              <animate
                attributeName="stop-color"
                values="#facc15;#f59e0b;#ec4899;#f59e0b;#facc15"
                dur="6s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="50%" stopColor="#f59e0b">
              <animate
                attributeName="stop-color"
                values="#f59e0b;#ec4899;#facc15;#ec4899;#f59e0b"
                dur="6s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor="#ec4899">
              <animate
                attributeName="stop-color"
                values="#ec4899;#facc15;#f59e0b;#facc15;#ec4899"
                dur="6s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
        </defs>
      )}
      <g
        fill="none"
        stroke={strokeColor}
        strokeWidth="7"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      >
        <path d="M 18 95 L 18 20" />
        <path d="M 18 20 L 40 55" />
        <path d="M 40 55 L 60 20" />
        <path d="M 60 20 L 60 60" />
        <path d="M 40 55 L 60 95" />
        <path d="M 60 60 L 60 95" />
      </g>
    </svg>
  );
}

/**
 * Full logo — animated M mark + wordmark "multi" (gradient) + "task" (ink).
 * Wordmark uses Fredoka, weight 600, left-to-right (Latin).
 */
interface LogoProps {
  /** Height of the mark in pixels; wordmark size scales from this */
  markSize?: number;
  variant?: "gradient" | "white" | "dark";
  className?: string;
  /** When true, render only the wordmark (no M mark to its left) */
  wordmarkOnly?: boolean;
  /** When true, render only the M mark */
  markOnly?: boolean;
  idKey?: string;
}

export function Logo({
  markSize = 36,
  variant = "gradient",
  className,
  wordmarkOnly = false,
  markOnly = false,
  idKey = "mGrad",
}: LogoProps) {
  const wordmarkFontSize = Math.round(markSize * 1.1);
  const multiColor =
    variant === "white"
      ? "text-white"
      : variant === "dark"
      ? "text-ink-900"
      : "bg-brand-gradient bg-clip-text text-transparent animate-grad-shift [background-size:200%_200%]";
  const taskColor =
    variant === "white" ? "text-white" : "text-ink-900";

  return (
    <div
      className={cn("inline-flex items-center gap-2.5 select-none", className)}
      dir="ltr"
    >
      {!wordmarkOnly && <LogoMark size={markSize} variant={variant} idKey={idKey} />}
      {!markOnly && (
        <div
          className="font-semibold tracking-tighter leading-none flex"
          style={{ fontSize: wordmarkFontSize }}
        >
          <span className={multiColor}>multi</span>
          <span className={taskColor}>task</span>
        </div>
      )}
    </div>
  );
}
