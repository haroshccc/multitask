/**
 * Deterministic HSL-shade generator for phase coloring.
 *
 * A task list has a single color; its phases should look clearly related
 * (same hue family) but distinguishable from each other. We generate N
 * shades from the list color and stable-assign one shade per phase via a
 * simple hash of the phase id.
 *
 * Design: we shift both hue (±10°) and lightness (±10%) around the base,
 * creating a small palette that stays in the list's color family but is
 * visually distinct row-to-row.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return {
    r: parseInt(full.substring(0, 2), 16),
    g: parseInt(full.substring(2, 4), 16),
    b: parseInt(full.substring(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
        break;
      case gn:
        h = ((bn - rn) / d + 2) * 60;
        break;
      default:
        h = ((rn - gn) / d + 4) * 60;
    }
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const sN = Math.max(0, Math.min(100, s)) / 100;
  const lN = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = lN - c / 2;
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

export function hexToHsl(hex: string): HSL {
  return rgbToHsl(hexToRgb(hex));
}

export function hslToHex(hsl: HSL): string {
  return rgbToHex(hslToRgb(hsl));
}

/**
 * Generate a palette of shades around a base hex color.
 * `count` defines the palette size; the palette is symmetric around the base
 * (index `floor(count/2)` ≈ the original color).
 */
export function generateShades(baseHex: string, count = 5): string[] {
  const base = hexToHsl(baseHex);
  const half = Math.floor(count / 2);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const offset = i - half; // -2..+2 for count=5
    out.push(
      hslToHex({
        h: base.h + offset * 8,
        s: Math.max(40, base.s), // keep at least some saturation
        l: Math.max(25, Math.min(85, base.l + offset * 6)),
      })
    );
  }
  return out;
}

/** Stable hash → index in the palette. */
export function pickShade(id: string, palette: string[]): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return palette[Math.abs(h) % palette.length]!;
}
