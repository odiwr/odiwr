"use client";

// The Web Audio graph behind OdiAMP:
//
//   <audio> → MediaElementSource → preamp → band0 … band9 → panner → analyser → out
//
// Built lazily on the first play, because an AudioContext created before a user
// gesture starts suspended and browsers will not resume it on their own.
//
// The <audio> element must be same-origin (see /audio route) — connecting a
// tainted cross-origin element produces silence, not an error.

/** Winamp's classic 10-band centre frequencies. */
export const BANDS = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000] as const;

export const BAND_LABELS = ["60", "170", "310", "600", "1K", "3K", "6K", "12K", "14K", "16K"];

/** Gain range per band, in dB, matching Winamp. */
export const MAX_DB = 12;

export type Preset = { name: string; preamp: number; gains: number[] };

export const PRESETS: Preset[] = [
  { name: "flat", preamp: 0, gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: "rock", preamp: 2, gains: [6, 4, -2, -4, -1, 2, 5, 7, 7, 7] },
  { name: "bass", preamp: 3, gains: [9, 7, 5, 2, 0, 0, 0, 0, 0, 0] },
  { name: "treble", preamp: 2, gains: [0, 0, 0, 0, 0, 2, 5, 8, 9, 9] },
  { name: "vocal", preamp: 1, gains: [-3, -2, 0, 3, 5, 5, 3, 0, -1, -2] },
  { name: "club", preamp: 2, gains: [0, 0, 4, 5, 5, 4, 2, 0, 0, 0] },
  { name: "vhs", preamp: 1, gains: [4, 3, 0, -2, -3, -2, 1, 4, 5, 3] },
];

/** dB → linear gain, for the preamp GainNode. */
function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

export type Engine = {
  ctx: AudioContext;
  preamp: GainNode;
  bands: BiquadFilterNode[];
  /** Left/right balance. Null where StereoPannerNode isn't implemented. */
  panner: StereoPannerNode | null;
  analyser: AnalyserNode;
};

let engine: Engine | null = null;
let attachedTo: HTMLAudioElement | null = null;

/**
 * Create (once) and return the graph for this audio element.
 *
 * An element can only ever be passed to createMediaElementSource once — calling
 * it twice throws — so the engine is a module-level singleton keyed on the
 * element it was built for.
 */
export function getEngine(el: HTMLAudioElement): Engine | null {
  if (engine && attachedTo === el) return engine;
  if (engine) return engine; // already built for a different element; reuse it

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  try {
    const ctx = new Ctor();
    const source = ctx.createMediaElementSource(el);

    const preamp = ctx.createGain();
    const bands = BANDS.map((freq) => {
      const f = ctx.createBiquadFilter();
      f.type = "peaking";
      f.frequency.value = freq;
      f.Q.value = 1.1;
      f.gain.value = 0;
      return f;
    });

    // <audio>.volume handles level; balance needs a node of its own.
    const panner = typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;
    // The defaults (-100…-30 dB) are far too narrow for music: normal material
    // sits well above -30 dBFS across the low and mid bands, so every bin
    // saturates at 255 and the analyser reads as a solid block. Opening the
    // window up gives the bars somewhere to move.
    analyser.minDecibels = -90;
    analyser.maxDecibels = -8;

    // Chain: preamp → each band in series → panner → analyser → speakers.
    source.connect(preamp);
    const lastBand = bands.reduce<AudioNode>((prev, node) => {
      prev.connect(node);
      return node;
    }, preamp);
    if (panner) {
      lastBand.connect(panner);
      panner.connect(analyser);
    } else {
      lastBand.connect(analyser);
    }
    analyser.connect(ctx.destination);

    engine = { ctx, preamp, bands, panner, analyser };
    attachedTo = el;
    return engine;
  } catch {
    // Autoplay policy, unsupported browser, or a re-attach race — the player
    // still works, just without EQ or a live spectrum.
    return null;
  }
}

export function applyEq(e: Engine | null, preampDb: number, gains: number[], enabled: boolean) {
  if (!e) return;
  e.preamp.gain.value = dbToGain(enabled ? preampDb : 0);
  e.bands.forEach((band, i) => {
    band.gain.value = enabled ? (gains[i] ?? 0) : 0;
  });
}

/** Byte spectrum, 0–255 per bin. Returns null when the graph isn't up yet. */
export function readSpectrum(e: Engine | null, into: Uint8Array): boolean {
  if (!e) return false;
  // The DOM typings want a plain Uint8Array<ArrayBuffer>; the cast keeps this
  // working across lib.dom versions without widening the caller's type.
  e.analyser.getByteFrequencyData(into as Uint8Array<ArrayBuffer>);
  return true;
}

/** Balance, −1 (hard left) … +1 (hard right). */
export function applyBalance(e: Engine | null, balance: number) {
  if (e?.panner) e.panner.pan.value = Math.max(-1, Math.min(1, balance));
}

/**
 * Time-domain samples, 0–255 centred on 128. Same contract as readSpectrum:
 * false when the graph isn't up yet, so callers can skip the frame.
 *
 * fftSize is 256, so `into` wants to be 256 bytes.
 */
export function readWaveform(e: Engine | null, into: Uint8Array): boolean {
  if (!e) return false;
  e.analyser.getByteTimeDomainData(into as Uint8Array<ArrayBuffer>);
  return true;
}
