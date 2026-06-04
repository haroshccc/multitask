import type { ChatImage } from "./types";

// Claude vision works best with images whose longest edge is <= ~1568px; bigger
// images are downscaled by the API anyway and just bloat the request. We also
// re-encode to JPEG to keep the base64 payload (sent through the Edge Function)
// small. PNGs with transparency are flattened onto white.
const MAX_DIM = 1568;
const JPEG_QUALITY = 0.85;

/** Reads an image File, downscales it to fit MAX_DIM on its longest edge, and
 *  returns base64 JPEG data (no `data:` prefix) suitable for Claude vision. */
export async function fileToChatImage(file: File): Promise<ChatImage> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error ?? new Error("read_failed"));
    fr.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("image_decode_failed"));
    im.src = dataUrl;
  });

  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height || 1));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const out = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const base64 = out.split(",")[1] ?? "";
  return { mediaType: "image/jpeg", data: base64 };
}

/** Reconstructs a displayable data URL from a stored ChatImage. */
export function chatImageSrc(img: ChatImage): string {
  return `data:${img.mediaType};base64,${img.data}`;
}
