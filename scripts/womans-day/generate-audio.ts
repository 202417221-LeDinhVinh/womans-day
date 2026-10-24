/**
 * Offline foley + music for /womans-day.
 *
 * Everything here is synthesized into 16-bit mono WAVs at 22.05 kHz: no sampled or
 * downloaded audio, so there is no license to track and the loop ships in ~520 KB.
 * Run after touching the sound design:
 *   bun scripts/womans-day/generate-audio.ts
 *
 * The players in lib/womansDay/sound.ts expect these exact file names.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const RATE = 22050;
const OUT_DIR = path.join(process.cwd(), "public", "womans-day", "audio");

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function writeWav(samples: Float32Array, file: string) {
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(36 + samples.length * 2, 4);
  bytes.write("WAVE", 8);
  bytes.write("fmt ", 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(RATE, 24);
  bytes.writeUInt32LE(RATE * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(samples.length * 2, 40);

  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index]));
    bytes.writeInt16LE(Math.round(value * 32767), 44 + index * 2);
  }

  return writeFile(file, bytes);
}

function buffer(seconds: number) {
  return new Float32Array(Math.round(seconds * RATE));
}

function lowpass(samples: Float32Array, cutoff: number) {
  const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / RATE);
  let previous = 0;
  for (let index = 0; index < samples.length; index += 1) {
    previous += alpha * (samples[index] - previous);
    samples[index] = previous;
  }
  return samples;
}

function fade(samples: Float32Array, inSeconds: number, outSeconds: number) {
  const inSamples = Math.max(1, Math.round(inSeconds * RATE));
  const outSamples = Math.max(1, Math.round(outSeconds * RATE));
  for (let index = 0; index < inSamples && index < samples.length; index += 1) {
    samples[index] *= index / inSamples;
  }
  for (let index = 0; index < outSamples && index < samples.length; index += 1) {
    samples[samples.length - 1 - index] *= index / outSamples;
  }
  return samples;
}

function normalize(samples: Float32Array, peak: number) {
  let max = 0;
  for (const value of samples) max = Math.max(max, Math.abs(value));
  if (max === 0) return samples;
  const gain = peak / max;
  for (let index = 0; index < samples.length; index += 1) samples[index] *= gain;
  return samples;
}

function noteHz(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function cardboardPop() {
  const random = mulberry32(23);
  const samples = buffer(0.18);
  for (let index = 0; index < samples.length; index += 1) {
    const t = index / RATE;
    const thump = Math.sin(2 * Math.PI * 92 * t) * Math.exp(-t * 26) * 0.9;
    const knock = Math.sin(2 * Math.PI * 210 * t) * Math.exp(-t * 48) * 0.5;
    const air = (random() * 2 - 1) * Math.exp(-t * 70) * 0.35;
    samples[index] = thump + knock + air;
  }
  lowpass(samples, 3200);
  return normalize(samples, 0.5);
}

function boxShake() {
  const random = mulberry32(37);
  const samples = buffer(0.75);
  const hits = [0.03, 0.14, 0.24, 0.36, 0.47, 0.59];
  for (let index = 0; index < samples.length; index += 1) {
    const t = index / RATE;
    let value = 0;
    for (const hit of hits) {
      const local = t - hit;
      if (local < 0) continue;
      const envelope = Math.exp(-local * 38);
      value += (random() * 2 - 1) * envelope * 0.5;
      value += Math.sin(2 * Math.PI * (150 + hit * 60) * local) * envelope * 0.22;
    }
    samples[index] = value;
  }
  lowpass(samples, 2400);
  return normalize(fade(samples, 0.01, 0.08), 0.34);
}

function paperFlip(seed: number, length: number, startCutoff: number, endCutoff: number) {
  const random = mulberry32(seed);
  const samples = buffer(length);
  let filtered = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const t = index / RATE;
    const progress = t / length;
    const cutoff = startCutoff + (endCutoff - startCutoff) * progress;
    const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / RATE);
    filtered += alpha * (random() * 2 - 1 - filtered);
    const envelope = Math.sin(Math.PI * Math.min(1, progress)) ** 1.4;
    const flutter = 0.75 + 0.25 * Math.sin(2 * Math.PI * 9 * t + seed);
    samples[index] = filtered * envelope * flutter;
  }
  const thump = buffer(length);
  for (let index = 0; index < thump.length; index += 1) {
    const t = index / RATE;
    const local = t - length * 0.82;
    if (local < 0) continue;
    thump[index] = Math.sin(2 * Math.PI * 110 * local) * Math.exp(-local * 40) * 0.35;
  }
  for (let index = 0; index < samples.length; index += 1) samples[index] += thump[index];
  return normalize(fade(samples, 0.03, length * 0.25), 0.34);
}

function chime() {
  const samples = buffer(2.1);
  const partials = [
    { hz: 1046.5, gain: 0.42, decay: 0.7 },
    { hz: 1568, gain: 0.24, decay: 0.95 },
    { hz: 2093, gain: 0.14, decay: 0.7 },
    { hz: 2637, gain: 0.08, decay: 0.5 },
    { hz: 523.25, gain: 0.18, decay: 1.2 },
  ];
  for (let index = 0; index < samples.length; index += 1) {
    const t = index / RATE;
    let value = 0;
    for (const partial of partials) {
      value +=
        Math.sin(2 * Math.PI * partial.hz * t) *
        partial.gain *
        Math.exp(-t / partial.decay) *
        Math.min(1, t / 0.004);
    }
    samples[index] = value;
  }
  return normalize(fade(samples, 0.002, 0.9), 0.4);
}

function stemPop() {
  const random = mulberry32(53);
  const samples = buffer(0.09);
  for (let index = 0; index < samples.length; index += 1) {
    const t = index / RATE;
    const click = (random() * 2 - 1) * Math.exp(-t * 240) * 0.7;
    const blip = Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 90) * 0.5;
    const body = Math.sin(2 * Math.PI * 320 * t) * Math.exp(-t * 60) * 0.3;
    samples[index] = click + blip + body;
  }
  lowpass(samples, 5200);
  return normalize(samples, 0.4);
}

/**
 * A small soil "sprout": a soft filtered-noise rustle plus a rising two-note pluck, very
 * quiet (Plan 15 §2.4).
 */
function sprout() {
  const random = mulberry32(101);
  const seconds = 0.5;
  const samples = buffer(seconds);
  let filtered = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const t = index / RATE;
    const alpha = 1 - Math.exp((-2 * Math.PI * 1600) / RATE);
    filtered += alpha * (random() * 2 - 1 - filtered);
    // Rustle: a short noise burst under the pluck.
    const rustle = filtered * Math.exp(-t * 9) * 0.35;
    // Two rising plucks (a fifth apart).
    const first = Math.sin(2 * Math.PI * 523 * t) * Math.exp(-t * 12) * 0.4;
    const secondStart = 0.12;
    const second =
      t > secondStart
        ? Math.sin(2 * Math.PI * 784 * (t - secondStart)) * Math.exp(-(t - secondStart) * 11) * 0.36
        : 0;
    samples[index] = rustle + first + second;
  }
  lowpass(samples, 4200);
  return normalize(fade(samples, 0.01, 0.2), 0.28);
}

/**
 * A loopable dry scratch: band-passed noise with a fast amplitude jitter, so it can be
 * played as a loop whose gain follows the pointer speed while scratching the foil.
 */
function scratch() {
  const random = mulberry32(131);
  const seconds = 1.2;
  const samples = buffer(seconds);
  let low = 0;
  let high = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const t = index / RATE;
    const white = random() * 2 - 1;
    // Low-pass ~2.4 kHz then high-pass ~900 Hz → a grainy band.
    const lowAlpha = 1 - Math.exp((-2 * Math.PI * 2400) / RATE);
    low += lowAlpha * (white - low);
    const highAlpha = 1 - Math.exp((-2 * Math.PI * 900) / RATE);
    high += highAlpha * (low - high);
    const band = low - high;
    // Fast jitter (a grainy scrape), + a slow tremolo.
    const jitter = 0.6 + 0.4 * Math.abs(Math.sin(2 * Math.PI * 47 * t + Math.sin(t * 31)));
    const tremolo = 0.8 + 0.2 * Math.sin(2 * Math.PI * 3.3 * t);
    samples[index] = band * jitter * tremolo;
  }
  // Cross-fade the last 60 ms into the first so the loop seam is smooth.
  const seam = Math.round(0.06 * RATE);
  for (let i = 0; i < seam; i += 1) {
    const w = i / seam;
    const a = samples[samples.length - seam + i];
    samples[i] = samples[i] * w + a * (1 - w);
  }
  return normalize(samples, 0.4);
}

function prelude() {
  const seconds = 12;
  const random = mulberry32(97);
  const samples = buffer(seconds + 0.6);
  const wet = new Float32Array(samples.length);

  const chords = [
    [48, 55, 59, 64, 67],
    [45, 52, 55, 60, 64],
    [41, 48, 52, 57, 60],
    [43, 50, 52, 59, 62],
  ];
  const pattern = [0, 2, 1, 3, 2, 0, 3, 1];
  const beat = 0.75;

  function addNote(start: number, hz: number, gain: number, decay: number) {
    const startIndex = Math.round(start * RATE);
    const attack = Math.round(0.012 * RATE);
    const tail = Math.round(decay * 3.5 * RATE);
    for (let offset = 0; offset < tail; offset += 1) {
      const index = startIndex + offset;
      if (index >= samples.length) break;
      const t = offset / RATE;
      const envelope = Math.min(1, offset / attack) * Math.exp(-t / decay);
      const tone =
        Math.sin(2 * Math.PI * hz * t) +
        Math.sin(2 * Math.PI * hz * 2 * t) * 0.24 +
        Math.sin(2 * Math.PI * hz * 3 * t) * 0.08;
      const value = tone * envelope * gain;
      samples[index] += value;
      wet[index] += value * 0.55;
    }
  }

  for (let bar = 0; bar < 4; bar += 1) {
    const chord = chords[bar % chords.length];
    const barStart = bar * 4 * beat;
    addNote(barStart, noteHz(chord[0] - 12), 0.16, 2.4);
    for (let step = 0; step < 8; step += 1) {
      const note = chord[pattern[step] % chord.length] + 12;
      const velocity = 0.1 + (step % 3) * 0.014;
      addNote(barStart + step * beat * 0.5, noteHz(note), velocity, 1.15);
    }
    if (bar % 2 === 1) {
      addNote(barStart + 2.5 * beat, noteHz(chord[3] + 24), 0.07, 1.4);
    }
  }

  const delaySamples = Math.round(0.31 * RATE);
  for (let index = delaySamples; index < samples.length; index += 1) {
    wet[index] += wet[index - delaySamples] * 0.32;
  }
  for (let index = 0; index < samples.length; index += 1) samples[index] += wet[index] * 0.35;

  for (let index = 0; index < samples.length; index += 1) {
    const t = index / RATE;
    const pad =
      Math.sin(2 * Math.PI * 130.81 * t) * 0.018 +
      Math.sin(2 * Math.PI * 196 * t + 0.8) * 0.013 +
      Math.sin(2 * Math.PI * 261.63 * t + 1.9) * 0.01;
    samples[index] += pad * (0.6 + 0.4 * Math.sin(2 * Math.PI * t * 0.083));
  }

  for (let index = 0; index < samples.length; index += 1) {
    if (random() < 0.00035) {
      samples[index] += (random() * 2 - 1) * 0.05;
    } else {
      samples[index] += (random() * 2 - 1) * 0.0016;
    }
  }

  lowpass(samples, 6400);

  // Circular seam: blend the rendered tail into the head, then keep one loop length.
  const loopLength = Math.round(seconds * RATE);
  const seam = Math.round(0.45 * RATE);
  const looped = samples.slice(0, loopLength);
  const tail = samples.slice(loopLength, loopLength + seam);
  for (let index = 0; index < seam; index += 1) {
    const weight = index / seam;
    looped[index] = looped[index] * weight + tail[index] * (1 - weight);
  }
  return normalize(looped, 0.5);
}

await mkdir(OUT_DIR, { recursive: true });

const files: Array<[string, Float32Array]> = [
  ["cardboard-pop.wav", cardboardPop()],
  ["box-shake.wav", boxShake()],
  ["paper-flip-1.wav", paperFlip(71, 0.55, 900, 2600)],
  ["paper-flip-2.wav", paperFlip(73, 0.62, 700, 2200)],
  ["paper-flip-3.wav", paperFlip(79, 0.5, 1100, 3000)],
  ["chime.wav", chime()],
  ["stem-pop.wav", stemPop()],
  ["sprout.wav", sprout()],
  ["scratch.wav", scratch()],
  ["autumn-prelude.wav", prelude()],
];

for (const [name, data] of files) {
  await writeWav(data, path.join(OUT_DIR, name));
  console.log(`wrote ${name} (${(data.length / RATE).toFixed(2)}s)`);
}
