// Client-side audio concatenation. Decodes each recording's audio (any codec
// the browser supports — opus/m4a/mp3/wav/…), resamples every part to mono
// 16 kHz (ideal for speech + transcription, and keeps the output size sane),
// and stitches them into a single 16-bit PCM WAV blob in the given order.
//
// Why client-side: Supabase Edge (Deno) has no ffmpeg, and parts can be in
// different codecs so a byte-concat won't work — they must be decoded to PCM
// and re-encoded. The browser's Web Audio API does exactly that.

const TARGET_RATE = 16000; // mono 16 kHz

export interface ConcatResult {
  blob: Blob;
  durationSeconds: number;
}

export interface ConcatProgress {
  done: number;
  total: number;
}

export async function concatToWav(
  urls: string[],
  onProgress?: (p: ConcatProgress) => void,
): Promise<ConcatResult> {
  if (urls.length === 0) throw new Error("no_audio_to_merge");

  const Ctx: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) throw new Error("web_audio_unsupported");

  const decodeCtx = new Ctx();
  const chunks: Int16Array[] = [];
  let totalSamples = 0;

  try {
    for (let i = 0; i < urls.length; i++) {
      const res = await fetch(urls[i]);
      if (!res.ok) throw new Error(`audio_fetch_${res.status}`);
      const arrayBuf = await res.arrayBuffer();

      // decodeAudioData resamples to decodeCtx's rate; then we resample to
      // TARGET_RATE mono via an OfflineAudioContext (handles rate + downmix).
      const decoded = await decodeCtx.decodeAudioData(arrayBuf);
      const length = Math.max(1, Math.ceil(decoded.duration * TARGET_RATE));
      const offline = new OfflineAudioContext(1, length, TARGET_RATE);
      const src = offline.createBufferSource();
      src.buffer = decoded;
      src.connect(offline.destination);
      src.start();
      const rendered = await offline.startRendering();

      const mono = rendered.getChannelData(0);
      chunks.push(floatToInt16(mono));
      totalSamples += mono.length;
      onProgress?.({ done: i + 1, total: urls.length });
    }
  } finally {
    // Release the decode context's hardware resources.
    void decodeCtx.close().catch(() => {});
  }

  const blob = encodeWav(chunks, totalSamples, TARGET_RATE);
  return { blob, durationSeconds: totalSamples / TARGET_RATE };
}

function floatToInt16(f: Float32Array): Int16Array {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) {
    const s = Math.max(-1, Math.min(1, f[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function encodeWav(
  chunks: Int16Array[],
  totalSamples: number,
  sampleRate: number,
): Blob {
  const dataBytes = totalSamples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  let p = 0;
  const writeStr = (s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i));
  };

  writeStr("RIFF");
  view.setUint32(p, 36 + dataBytes, true);
  p += 4;
  writeStr("WAVE");
  writeStr("fmt ");
  view.setUint32(p, 16, true);
  p += 4;
  view.setUint16(p, 1, true); // PCM
  p += 2;
  view.setUint16(p, 1, true); // mono
  p += 2;
  view.setUint32(p, sampleRate, true);
  p += 4;
  view.setUint32(p, sampleRate * 2, true); // byte rate (mono · 16-bit)
  p += 4;
  view.setUint16(p, 2, true); // block align
  p += 2;
  view.setUint16(p, 16, true); // bits per sample
  p += 2;
  writeStr("data");
  view.setUint32(p, dataBytes, true);
  p += 4;

  let offset = 44;
  for (const ch of chunks) {
    for (let i = 0; i < ch.length; i++) {
      view.setInt16(offset, ch[i], true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}
