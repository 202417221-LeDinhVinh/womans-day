/**
 * Turn a semantic CSS token into a concrete rgb() value for canvas / SVG code
 * that cannot use `var()` directly.
 *
 * After the theme engine landed, `getPropertyValue("--color-brand")` returns the
 * literal text `light-dark(#e0b354, #e0b354)` (or `var(--accent-brand)`), not a
 * colour — every caller that parsed it with a hex regex silently fell back. This
 * helper paints a throwaway probe and reads the browser's resolved `color`, so
 * the value is correct in both themes, inside theme islands, and for any future
 * colour syntax.
 *
 * Callers that cache must key on the resolved theme; `useThemeColors` does that.
 */

export type ResolvedColor = {
  r: number;
  g: number;
  b: number;
  /** 0–1. */
  a: number;
  /** Canonical `rgb(...)` / `rgba(...)` string. */
  css: string;
};

const cache = new WeakMap<Element, Map<string, ResolvedColor | null>>();

export function parseCssColor(input: string): ResolvedColor | null {
  const value = input.trim();
  if (!value) return null;

  if (value.startsWith("#")) {
    const hex = value.slice(1);
    const expand = (part: string) => (part.length === 1 ? `${part}${part}` : part);
    let r: number;
    let g: number;
    let b: number;
    let a = 1;
    if (hex.length === 3 || hex.length === 4) {
      r = parseInt(expand(hex[0]), 16);
      g = parseInt(expand(hex[1]), 16);
      b = parseInt(expand(hex[2]), 16);
      if (hex.length === 4) a = parseInt(expand(hex[3]), 16) / 255;
    } else if (hex.length === 6 || hex.length === 8) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
      if (hex.length === 8) a = parseInt(hex.slice(6, 8), 16) / 255;
    } else {
      return null;
    }
    if (![r, g, b].every(Number.isFinite)) return null;
    return withCss(r, g, b, a);
  }

  const rgbMatch = value.match(/^rgba?\((.*)\)$/i);
  if (rgbMatch) {
    const body = rgbMatch[1].replace(/\//g, " ").replace(/,/g, " ");
    const parts = body.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 3) return null;
    const channel = (part: string) => {
      if (part.endsWith("%")) return (parseFloat(part) / 100) * 255;
      return parseFloat(part);
    };
    const r = channel(parts[0]);
    const g = channel(parts[1]);
    const b = channel(parts[2]);
    const a = parts[3] === undefined ? 1 : parseFloat(parts[3].replace("%", ""));
    if (![r, g, b, a].every(Number.isFinite)) return null;
    return withCss(r, g, b, parts[3]?.endsWith("%") ? a / 100 : a);
  }

  // `color(srgb …)` / `color(display-p3 …)`: resolved values of wide-gamut
  // tokens (C-3.13). Channels are 0–1 floats; p3 is approximated as sRGB —
  // close enough for canvas dots and chart strokes.
  const colorFnMatch = value.match(/^color\(\s*([a-z0-9-]+)\s+(.*)\)$/i);
  if (colorFnMatch) {
    const body = colorFnMatch[2].replace(/\//g, " ").replace(/,/g, " ");
    const parts = body.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 3) return null;
    const nums = parts.slice(0, 4).map(Number);
    if (!nums.slice(0, 3).every(Number.isFinite)) return null;
    const [r, g, b, a = 1] = nums;
    if (r < 0 || r > 1 || g < 0 || g > 1 || b < 0 || b > 1) return null;
    return withCss(r * 255, g * 255, b * 255, a);
  }

  return null;
}

function withCss(r: number, g: number, b: number, a: number): ResolvedColor {
  const rr = Math.round(Math.min(255, Math.max(0, r)));
  const gg = Math.round(Math.min(255, Math.max(0, g)));
  const bb = Math.round(Math.min(255, Math.max(0, b)));
  const aa = Math.min(1, Math.max(0, a));
  const css =
    aa >= 1 ? `rgb(${rr}, ${gg}, ${bb})` : `rgba(${rr}, ${gg}, ${bb}, ${Number(aa.toFixed(3))})`;
  return { r: rr, g: gg, b: bb, a: aa, css };
}

function mediaPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Cache key must include the colour-scheme actually in effect for this subtree:
 * an island (`only light`) resolves different tokens than the dark document.
 * Derived from the DOM (attribute + island ancestry + media) instead of
 * `getComputedStyle` so a cache HIT costs no style recalc (C-3.13).
 */
function themeCacheKey(el: Element): string {
  if (typeof window === "undefined" || typeof document === "undefined") return "ssr";
  let inIsland = false;
  try {
    inIsland =
      el instanceof HTMLElement && el.closest("[data-theme-island], .scheme-only-light") !== null;
  } catch {
    inIsland = false;
  }
  const pref = document.documentElement.dataset.themePref;
  let scheme: string;
  if (inIsland || pref === "light") scheme = "light";
  else if (pref === "dark") scheme = "dark";
  else scheme = mediaPrefersDark() ? "dark" : "light";
  return `${scheme}`;
}

/**
 * Read one token. Pass the element whose subtree defines the wanted scheme
 * (e.g. an island root); defaults to `<html>`.
 */
export function resolveColorToken(
  name: string,
  el: Element | null = typeof document === "undefined" ? null : document.documentElement
): ResolvedColor | null {
  if (!el || typeof window === "undefined" || typeof document === "undefined") return null;

  const property = name.startsWith("--") ? name : `--${name}`;
  let perElement = cache.get(el);
  if (!perElement) {
    perElement = new Map();
    cache.set(el, perElement);
  }
  const key = `${themeCacheKey(el)}|${property}`;
  if (perElement.has(key)) return perElement.get(key) ?? null;

  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position:absolute;left:-9999px;top:-9999px;width:0;height:0;visibility:hidden;pointer-events:none";
  // Sentinel fallback: an undefined token is invalid at computed-value time
  // and inherits the parent colour — without the fallback it would resolve to
  // whatever the host paints instead of null (C-3.13).
  probe.style.color = `var(${property}, rgb(1, 2, 3))`;
  el.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();

  if (computed.replace(/\s+/g, "") === "rgb(1,2,3)") {
    perElement.set(key, null);
    return null;
  }
  const parsed = parseCssColor(computed);
  perElement.set(key, parsed);
  return parsed;
}
