// Pleasant three-note chime (C-E-G) synthesized with the Web Audio API, so no
// audio asset is needed. Safe to call from a user gesture or a timer; failures
// (autoplay policy, no AudioContext) are swallowed.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = ctx ?? new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/** Warm up / unlock the audio context from within a user gesture (e.g. the
 *  "start" click), so the end-of-timer chime can play later without a gesture. */
export function primeChime(): void {
  const ac = getCtx();
  if (ac && ac.state === "suspended") void ac.resume();
}

export function playPleasantChime(): void {
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume();
  const now = ac.currentTime;
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  notes.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t0 = now + i * 0.18;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(0.18, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + 0.6);
  });
}
