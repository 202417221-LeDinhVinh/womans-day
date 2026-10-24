/**
 * Tiny audio player for the celebration route.
 *
 * Audio is OFF until the first user gesture unlocks the browser. Nothing is fetched
 * before that: elements are created lazily, with `preload = "none"`, so the first-load
 * budget never pays for the music. The speaker toggle in the corner flips `enabled` and
 * persists the choice; muting stops the loop immediately.
 *
 * This is deliberately an external store (not React state) because the scroll engine and
 * the parcel state machine call `playSound()` from event handlers outside React's tree.
 */

const STORAGE_KEY = "womans-day:sound";

export type SoundName = "pop" | "shake" | "flip" | "chime" | "stem" | "sprout" | "scratch";

const SFX: Record<Exclude<SoundName, "flip">, string> = {
  pop: "/womans-day/audio/cardboard-pop.wav",
  shake: "/womans-day/audio/box-shake.wav",
  chime: "/womans-day/audio/chime.wav",
  stem: "/womans-day/audio/stem-pop.wav",
  sprout: "/womans-day/audio/sprout.wav",
  scratch: "/womans-day/audio/scratch.wav",
};

const FLIP_VARIANTS = [
  "/womans-day/audio/paper-flip-1.wav",
  "/womans-day/audio/paper-flip-2.wav",
  "/womans-day/audio/paper-flip-3.wav",
];

const MUSIC_SRC = "/womans-day/audio/autumn-prelude.wav";

const listeners = new Set<() => void>();

let enabled = true;
let unlocked = false;
let hydrated = false;
let musicWanted = false;
let music: HTMLAudioElement | null = null;

// Decoded SFX, keyed by source URL. After the unlock gesture we fetch each effect ONCE and
// decode it into an AudioBuffer, so a mid-turn flip never issues a network request (the WAV
// files were being re-fetched under `max-age=0` on first use). Overlapping flips also
// become possible because each playback is its own `AudioBufferSourceNode`.
let audioContext: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
const bufferPromises = new Map<string, Promise<AudioBuffer | null>>();
const effects = new Map<string, HTMLAudioElement>();

function notify() {
  for (const listener of listeners) listener();
}

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) audioContext = new Ctor();
  return audioContext;
}

function loadBuffer(src: string): Promise<AudioBuffer | null> {
  if (buffers.has(src)) return Promise.resolve(buffers.get(src) as AudioBuffer);
  if (bufferPromises.has(src)) return bufferPromises.get(src) as Promise<AudioBuffer | null>;
  const promise = (async () => {
    const ctx = getContext();
    if (!ctx) return null;
    try {
      const response = await fetch(src);
      const bytes = await response.arrayBuffer();
      const buffer = await ctx.decodeAudioData(bytes);
      buffers.set(src, buffer);
      return buffer;
    } catch {
      return null;
    }
  })();
  bufferPromises.set(src, promise);
  return promise;
}

/** Fetch + decode every effect once. Called on the unlock gesture; safe to re-call. */
function preloadSfx() {
  for (const src of Object.values(SFX)) void loadBuffer(src);
  for (const src of FLIP_VARIANTS) void loadBuffer(src);
}

export function subscribeSound(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isSoundEnabled(): boolean {
  return enabled;
}

/** Called once on mount to restore the saved preference. */
export function initSound() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "off") {
      enabled = false;
      notify();
    }
  } catch {
    // Private mode / storage disabled: keep the default.
  }
}

/**
 * Attach the one-time gesture listener. Any pointer or key counts; the listener removes
 * itself after the first event, then warms the audio: the SFX decode into buffers and the
 * music loop switches to `preload = "auto"`.
 */
export function unlockSound(): () => void {
  if (typeof window === "undefined" || unlocked) return () => {};

  const unlock = () => {
    unlocked = true;
    const ctx = getContext();
    void ctx?.resume().catch(() => {});
    preloadSfx();
    if (musicWanted) startMusic();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };

  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true, passive: true });

  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
}

export function toggleSound(): boolean {
  enabled = !enabled;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Preference simply will not survive a reload.
  }
  if (!enabled) {
    music?.pause();
  } else if (musicWanted) {
    startMusic();
  }
  notify();
  return enabled;
}

function playViaBuffer(src: string, volume: number): boolean {
  const buffer = buffers.get(src);
  const ctx = getContext();
  if (!buffer || !ctx) return false;
  try {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(ctx.destination);
    source.start();
    return true;
  } catch {
    return false;
  }
}

function playViaElement(src: string, volume: number) {
  let element = effects.get(src);
  if (!element) {
    element = new Audio(src);
    element.preload = "auto";
    element.volume = volume;
    effects.set(src, element);
  }
  try {
    element.currentTime = 0;
    void element.play().catch(() => {
      // Autoplay policy, missing asset, or the tab went to the background. Never fatal.
    });
  } catch {
    // Ignore: a missing sound must not break an interaction.
  }
}

export function playSound(name: SoundName) {
  if (typeof window === "undefined" || !enabled || !unlocked) return;

  const src =
    name === "flip" ? FLIP_VARIANTS[Math.floor(Math.random() * FLIP_VARIANTS.length)] : SFX[name];
  const volume = name === "chime" ? 0.4 : 0.32;

  // Fast path: decoded buffer (no network, overlaps). Warm it, then fall back to the
  // HTMLAudioElement path for the very first play before decode finishes.
  if (buffers.has(src)) {
    playViaBuffer(src, volume);
    return;
  }
  void loadBuffer(src).then((buffer) => {
    if (buffer) playViaBuffer(src, volume);
  });
  playViaElement(src, volume);
}

/** Called when the letter scene becomes visible. Respects the mute preference. */
export function startMusic() {
  musicWanted = true;
  if (typeof window === "undefined" || !enabled || !unlocked) return;

  if (!music) {
    music = new Audio(MUSIC_SRC);
    music.loop = true;
    music.preload = "auto";
    music.volume = 0.22;
  }

  void music.play().catch(() => {});
}

export function stopMusic() {
  musicWanted = false;
  music?.pause();
}

export function isMusicPlaying(): boolean {
  return Boolean(music && !music.paused);
}
