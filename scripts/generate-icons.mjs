// Zero-dependency PWA icon generator. Renders the brand mark (yellow→amber→
// pink 135° gradient, white check) into PNGs using nothing but Node's zlib —
// no canvas/sharp in this repo. Run: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- minimal PNG encoder -----------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // raw scanlines, filter byte 0 per row
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- brand mark renderer ------------------------------------------------------

const STOPS = [
  { t: 0.0, c: [250, 204, 21] }, // #facc15
  { t: 0.45, c: [245, 158, 11] }, // #f59e0b
  { t: 1.0, c: [236, 72, 153] }, // #ec4899
];

function gradientAt(t) {
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i].t) {
      const a = STOPS[i - 1];
      const b = STOPS[i];
      const f = (t - a.t) / (b.t - a.t);
      return [0, 1, 2].map((k) => Math.round(a.c[k] + (b.c[k] - a.c[k]) * f));
    }
  }
  return STOPS[STOPS.length - 1].c;
}

/** Signed distance from point to a rounded square centred in [0,size]². */
function roundedRectDist(x, y, size, radius) {
  const half = size / 2;
  const qx = Math.abs(x - half) - (half - radius);
  const qy = Math.abs(y - half) - (half - radius);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - radius;
}

function segDist(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)),
  );
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

/**
 * Render the mark. `maskable` renders a full-bleed background (no rounded
 * corners, glyph inside the 80% safe zone per the maskable spec).
 */
function render(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = maskable ? 0 : size * 0.22;
  const glyphScale = maskable ? 0.72 : 1;
  // Check-mark polyline in unit space, centred.
  const pts = [
    [0.29, 0.53],
    [0.45, 0.68],
    [0.73, 0.37],
  ].map(([ux, uy]) => [
    size / 2 + (ux - 0.5) * size * glyphScale,
    size / 2 + (uy - 0.5) * size * glyphScale,
  ]);
  const stroke = size * 0.075 * glyphScale;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Background alpha from the rounded-rect SDF (1px anti-alias band).
      const bgD = maskable ? -1 : roundedRectDist(x + 0.5, y + 0.5, size, radius);
      const bgA = Math.max(0, Math.min(1, 0.5 - bgD));
      if (bgA <= 0) continue;
      const t = (x + y) / (2 * size);
      let [r, g, b] = gradientAt(t);
      // White check: distance to the two segments.
      const d = Math.min(
        segDist(x + 0.5, y + 0.5, ...pts[0], ...pts[1]),
        segDist(x + 0.5, y + 0.5, ...pts[1], ...pts[2]),
      );
      const glyphA = Math.max(0, Math.min(1, stroke - d + 0.5));
      r = Math.round(r + (255 - r) * glyphA);
      g = Math.round(g + (255 - g) * glyphA);
      b = Math.round(b + (255 - b) * glyphA);
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = Math.round(bgA * 255);
    }
  }
  return encodePng(size, rgba);
}

mkdirSync(join(root, "public", "icons"), { recursive: true });
writeFileSync(join(root, "public", "icons", "icon-192.png"), render(192));
writeFileSync(join(root, "public", "icons", "icon-512.png"), render(512));
writeFileSync(
  join(root, "public", "icons", "icon-maskable-512.png"),
  render(512, { maskable: true }),
);
writeFileSync(join(root, "public", "apple-touch-icon.png"), render(180));
console.log("icons written to public/");
