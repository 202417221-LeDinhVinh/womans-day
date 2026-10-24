export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;
export const DEFAULT_STORY_ACCENT = "#e0b354";

// Clock colours are applied over the photograph only. Brand gold is the default;
// the other presets offer contrast for varied backgrounds.
export const STORY_ACCENT_SWATCHES = [
  { id: "brand", label: "Ronan SAT gold", color: DEFAULT_STORY_ACCENT },
  { id: "white", label: "White", color: "#ffffff" },
  { id: "orange", label: "Orange", color: "#fc5200" },
  { id: "volt", label: "Volt", color: "#c8ff00" },
  { id: "cyan", label: "Cyan", color: "#00e5ff" },
  { id: "magenta", label: "Magenta", color: "#ff1f8f" },
  { id: "violet", label: "Violet", color: "#b026ff" },
] as const;

export type StoryAccentId = (typeof STORY_ACCENT_SWATCHES)[number]["id"];

export type StoryCaptureTheme = "light" | "dark";
export type StoryOverlayTransform = {
  centerX: number;
  centerY: number;
  widthRatio: number;
};

export const DEFAULT_STORY_OVERLAY_TRANSFORM: StoryOverlayTransform = {
  centerX: 0.5,
  centerY: 0.5,
  widthRatio: 0.82,
};

export type StoryPhotoAnalysis = {
  averageLuminance: number;
  suggestedTheme: StoryCaptureTheme;
};

export type StudyRingColorScale = {
  low: string;
  mid: string;
  high: string;
};

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function channelToHex(value: number): string {
  return Math.round(clamp(value, 0, 255))
    .toString(16)
    .padStart(2, "0");
}

function rgbToHex({ r, g, b }: Rgb): string {
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}

function hexToRgb(value: string): Rgb | null {
  const match = /^#([\da-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const packed = Number.parseInt(match[1], 16);
  return { r: (packed >> 16) & 255, g: (packed >> 8) & 255, b: packed & 255 };
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;

  if (delta > 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }

  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return { h: hue, s: saturation * 100, l: lightness * 100 };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = (((h % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  let values: [number, number, number];
  if (segment < 1) values = [chroma, x, 0];
  else if (segment < 2) values = [x, chroma, 0];
  else if (segment < 3) values = [0, chroma, x];
  else if (segment < 4) values = [0, x, chroma];
  else if (segment < 5) values = [x, 0, chroma];
  else values = [chroma, 0, x];
  const match = lightness - chroma / 2;
  return {
    r: (values[0] + match) * 255,
    g: (values[1] + match) * 255,
    b: (values[2] + match) * 255,
  };
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const linearize = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function themeForPhotoLuminance(luminance: number): StoryCaptureTheme {
  return luminance < 0.34 ? "dark" : "light";
}

export function themeForInkColor(color: string): StoryCaptureTheme {
  return relativeLuminance(hexToRgb(color) ?? { r: 255, g: 255, b: 255 }) >= 0.45
    ? "dark"
    : "light";
}

// The picked colour is ALWAYS the middle stop, verbatim — a swatch that does not
// appear in the ring reads as a broken control. Only the short/long stops are
// derived, and they move in whichever direction the accent has headroom for:
// pushing a near-white accent "lighter" would collapse two stops together, and
// pushing a mid-toned neon 20% darker turns it into mud on a photograph. The deep
// stop is therefore floored well above black and keeps the accent's chroma, so
// the whole ramp stays legible over a busy image.
export function buildStudyRingColorScale(
  accent: string,
  backgroundLuminance = 0.5
): StudyRingColorScale {
  const rgb = hexToRgb(accent) ?? { r: 255, g: 90, b: 31 };
  const hsl = rgbToHsl(rgb);
  // A bright photo needs a slightly tighter ramp than a dark one, where the glow
  // does more of the separation work.
  const spread = backgroundLuminance >= 0.55 ? 15 : 18;
  const headroomUp = 94 - hsl.l;
  const headroomDown = hsl.l - 40;
  const chroma = hsl.s > 12 ? Math.max(hsl.s, 88) : hsl.s;

  const stops =
    headroomUp < 6
      ? // Near-white accent: run the whole ramp downward from it.
        { low: hsl.l - spread * 0.5, high: hsl.l - spread * 1.5 }
      : headroomDown < 6
        ? // Very dark accent: run the whole ramp upward from it.
          { low: hsl.l + spread * 1.5, high: hsl.l + spread * 0.5 }
        : {
            low: hsl.l + Math.min(spread, headroomUp),
            high: hsl.l - Math.min(spread, headroomDown),
          };

  return {
    low: rgbToHex(hslToRgb({ h: hsl.h, s: chroma, l: clamp(stops.low, 6, 96) })),
    mid: rgbToHex(rgb),
    high: rgbToHex(hslToRgb({ h: hsl.h, s: chroma, l: clamp(stops.high, 6, 96) })),
  };
}

function loadBlobImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("This image format could not be opened."));
    };
    image.src = objectUrl;
  });
}

function loadUrlImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The story branding could not be loaded."));
    image.src = source;
  });
}

export function coverRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
) {
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return { x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height };
}

export async function analyseStoryPhoto(photo: Blob): Promise<StoryPhotoAnalysis> {
  const image = await loadBlobImage(photo);
  const canvas = document.createElement("canvas");
  canvas.width = 56;
  canvas.height = 56;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Image colour analysis is unavailable in this browser.");

  const rect = coverRect(image.naturalWidth, image.naturalHeight, canvas.width, canvas.height);
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let luminanceTotal = 0;
  let visiblePixels = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 200) continue;
    const rgb = { r: pixels[index], g: pixels[index + 1], b: pixels[index + 2] };
    luminanceTotal += relativeLuminance(rgb);
    visiblePixels += 1;
  }

  const averageLuminance = visiblePixels ? luminanceTotal / visiblePixels : 0.5;
  return {
    averageLuminance,
    suggestedTheme: themeForPhotoLuminance(averageLuminance),
  };
}

export async function trimTransparentPng(imageBlob: Blob): Promise<Blob> {
  const image = await loadBlobImage(imageBlob);
  const source = document.createElement("canvas");
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) return imageBlob;
  sourceContext.drawImage(image, 0, 0);
  const pixels = sourceContext.getImageData(0, 0, source.width, source.height).data;
  let minX = source.width;
  let minY = source.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      if (pixels[(y * source.width + x) * 4 + 3] <= 8) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return imageBlob;
  const padding = Math.max(4, Math.round(Math.max(source.width, source.height) * 0.01));
  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(source.width, maxX + padding + 1);
  const bottom = Math.min(source.height, maxY + padding + 1);
  const output = document.createElement("canvas");
  output.width = right - left;
  output.height = bottom - top;
  const outputContext = output.getContext("2d");
  if (!outputContext) return imageBlob;
  outputContext.drawImage(
    source,
    left,
    top,
    output.width,
    output.height,
    0,
    0,
    output.width,
    output.height
  );

  return await new Promise<Blob>((resolve) => {
    output.toBlob((blob) => resolve(blob ?? imageBlob), "image/png");
  });
}

export function storyOverlayRect(
  overlayWidth: number,
  overlayHeight: number,
  transform: StoryOverlayTransform
) {
  const aspect = overlayHeight / overlayWidth;
  const safeTransform = clampStoryOverlayTransform(transform, aspect);
  const widthRatio = safeTransform.widthRatio;
  const width = STORY_WIDTH * widthRatio;
  const height = width * aspect;
  const x = safeTransform.centerX * STORY_WIDTH - width / 2;
  const y = safeTransform.centerY * STORY_HEIGHT - height / 2;
  return { x, y, width, height };
}

export function clampStoryOverlayTransform(
  transform: StoryOverlayTransform,
  overlayAspect: number
): StoryOverlayTransform {
  const aspect = Number.isFinite(overlayAspect) && overlayAspect > 0 ? overlayAspect : 1;
  const maxWidthRatioForHeight = STORY_HEIGHT / (STORY_WIDTH * aspect);
  const widthRatio = clamp(transform.widthRatio, 0.28, Math.min(0.96, maxWidthRatioForHeight));
  const heightRatio = (widthRatio * STORY_WIDTH * aspect) / STORY_HEIGHT;
  return {
    centerX: clamp(transform.centerX, widthRatio / 2, 1 - widthRatio / 2),
    centerY: clamp(transform.centerY, heightRatio / 2, 1 - heightRatio / 2),
    widthRatio,
  };
}

// A dimmer, not a card. On a busy, mid-toned photograph — a café with chairs and
// table edges running through the frame — white type does not fail because it is
// too thin, it fails because the LOCAL background behind it is the same value. A
// soft dark tint under the widgets fixes the cause: it lowers that local value
// while leaving the photograph itself readable, which is why the ceiling here is
// well under half opacity.
//
// The tint is anchored to the OVERLAY's rect rather than to a fixed lower-left
// region, because the student drags the clock wherever they like and a hardcoded
// corner would dim empty sky while leaving the widgets on top of the furniture.
// It is an ellipse with a feathered edge for the same reason a rectangle is wrong:
// a visible border reads as a black box pasted onto the photo, which is the exact
// "card behind the group" this design forbids. Radial gradients in canvas are
// circular, so the ellipse comes from scaling the space before filling.
export const DEFAULT_STORY_DIM_STRENGTH = 0.3;
export const MAX_STORY_DIM_STRENGTH = 0.5;
// How far past the overlay's own box the tint reaches. Exported so the editor can
// size its dimmer element to exactly the ellipse the canvas fills — a CSS gradient
// is clipped to its element, so a box the same size as the overlay would cut the
// feathered edge off and reintroduce the visible rectangle this is avoiding.
export const STORY_DIM_SCALE_X = 1.55;
export const STORY_DIM_SCALE_Y = 1.35;

function drawOverlayDimmer(
  context: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  strength: number
) {
  const amount = clamp(strength, 0, MAX_STORY_DIM_STRENGTH);
  if (amount <= 0) return;
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const radiusX = (rect.width / 2) * STORY_DIM_SCALE_X;
  const radiusY = (rect.height / 2) * STORY_DIM_SCALE_Y;
  const radius = Math.max(radiusX, radiusY);
  context.save();
  context.translate(centerX, centerY);
  context.scale(radiusX / radius, radiusY / radius);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, `rgba(0, 0, 0, ${amount.toFixed(3)})`);
  gradient.addColorStop(0.45, `rgba(0, 0, 0, ${(amount * 0.82).toFixed(3)})`);
  gradient.addColorStop(0.75, `rgba(0, 0, 0, ${(amount * 0.38).toFixed(3)})`);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

// The editor mirror of `drawOverlayDimmer`. `closest-side` makes the gradient end
// exactly at the element's edges, so an element sized by `STORY_DIM_SCALE_*` holds
// the same ellipse the canvas draws, with the same stops and no clipped falloff.
export function storyDimmerStyle(strength: number): string {
  const amount = clamp(strength, 0, MAX_STORY_DIM_STRENGTH);
  if (amount <= 0) return "none";
  return [
    "radial-gradient(ellipse closest-side at 50% 50%,",
    `rgba(0, 0, 0, ${amount.toFixed(3)}) 0%,`,
    `rgba(0, 0, 0, ${(amount * 0.82).toFixed(3)}) 45%,`,
    `rgba(0, 0, 0, ${(amount * 0.38).toFixed(3)}) 75%,`,
    "rgba(0, 0, 0, 0) 100%)",
  ].join(" ");
}

// Strava's stats stickers are CRISP — flat vector art with a tight contact shadow
// and nothing else. An earlier version blurred a dark silhouette at ~1.8% of the
// overlay width and then bloomed the overlay's own pixels back additively; that
// reads as haze, not as neon, and it softens exactly the thin ring strokes and
// small stat labels that need to stay legible. So there is no bloom and no coloured
// halo — separation is two stacked dark shadows and nothing more. How soft they are
// is the STUDENT's call, because how much a shadow is needed depends entirely on
// the photo behind it: a busy, mid-toned picture wants more than a clean dark one.
// `strength` runs 0 (no shadow at all) to 1 (the widest setting), and every radius
// is expressed as a share of the rendered width so the editor preview and the
// 1080-wide export describe the same shadow at their own scales.
const SHADOW_REFERENCE_PREVIEW_WIDTH = 320;

export type OverlayShadowLayer = { blur: number; offsetY: number; color: string };

export function overlayShadowLayers(strength: number, width: number): OverlayShadowLayer[] {
  const amount = clamp(strength, 0, 1);
  if (amount <= 0) return [];
  const lerp = (from: number, to: number) => from + (to - from) * amount;
  return [
    {
      blur: width * lerp(0.004, 0.0183),
      offsetY: width * lerp(0.002, 0.006),
      color: `rgba(0, 0, 0, ${lerp(0.2, 0.66).toFixed(3)})`,
    },
    {
      blur: width * lerp(0.002, 0.0049),
      offsetY: width * lerp(0.001, 0.0025),
      color: `rgba(0, 0, 0, ${lerp(0.4, 0.83).toFixed(3)})`,
    },
  ];
}

// A shadowed `drawImage` leaves the source pixels untouched, where a
// `filter: blur()` pass over them does not; the final unshadowed pass then
// guarantees the visible edges are the originals.
function drawOverlayWithShadow(
  context: CanvasRenderingContext2D,
  overlayImage: HTMLImageElement,
  rect: { x: number; y: number; width: number; height: number },
  strength: number
) {
  context.save();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  for (const layer of overlayShadowLayers(strength, rect.width)) {
    context.shadowColor = layer.color;
    context.shadowBlur = layer.blur;
    context.shadowOffsetY = layer.offsetY;
    context.drawImage(overlayImage, rect.x, rect.y, rect.width, rect.height);
  }
  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;
  context.drawImage(overlayImage, rect.x, rect.y, rect.width, rect.height);
  context.restore();
}

// The editor mirror of `drawOverlayWithShadow`, from the same layer definition so
// the two cannot drift in shape. The reference width is the preview's own rendered
// size rather than the export's, which is why the pixel values are smaller.
export function storyShadowFilter(strength: number): string {
  const layers = overlayShadowLayers(strength, SHADOW_REFERENCE_PREVIEW_WIDTH);
  if (layers.length === 0) return "none";
  return layers
    .map(
      (layer) =>
        `drop-shadow(0 ${layer.offsetY.toFixed(2)}px ${layer.blur.toFixed(2)}px ${layer.color})`
    )
    .join(" ");
}

// The repo's sans is DM Sans, exposed as `--font-sans` (see `app/layout.tsx`:
// `--font-workbook-body`). That is the face the story's numbers must use — it is
// the neutral geometric grotesque in the same family as Helvetica Neue / SF Pro,
// whereas `--font-display` (Bricolage Grotesque) is the quirky headline face and
// reads as decorative on a numeric stat. `components/adaptive/scoreReport/ShareCard.tsx`
// already proves `--font-sans` survives the html-to-image pass, so the previous
// hardcoded `"Inter"` here was simply drift: Inter is not loaded anywhere in this
// app, so the brand wordmark was silently falling through to `system-ui`.
//
// Resolved through `getComputedStyle` rather than written into the font string,
// because `context.font` is parsed by the CSS font shorthand grammar, which does
// NOT resolve `var()` — assigning a string containing one is a parse failure that
// leaves the previous font in place, silently.
function storySansFamily(): string {
  const fallback = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
  if (typeof window === "undefined") return fallback;
  const resolved = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue("--font-sans")
    .trim();
  return resolved ? `${resolved}, ${fallback}` : fallback;
}

function drawFixedStoryBrand(context: CanvasRenderingContext2D, logoImage: HTMLImageElement) {
  const left = 64;
  const top = 64;
  const iconSize = 56;
  context.save();
  context.shadowColor = "rgba(0, 0, 0, 0.5)";
  context.shadowBlur = 6;
  context.shadowOffsetY = 2;
  context.drawImage(logoImage, left, top, iconSize, iconSize);
  context.fillStyle = "#ffffff";
  context.font = `700 32px ${storySansFamily()}`;
  context.textBaseline = "middle";
  context.fillText("RONAN SAT", left + iconSize + 14, top + iconSize / 2);
  context.restore();
}

// Soft and blurred by default, because the photos students actually use are busy.
// The slider still reaches 0 for the clean, unshadowed look on a photo with real
// natural contrast, and reaches 1 when the background is truly hostile.
export const DEFAULT_STORY_SHADOW_STRENGTH = 0.45;

export async function composePhotoStory({
  photo,
  overlay,
  transform,
  shadowStrength,
  dimStrength,
}: {
  photo: Blob;
  overlay: Blob;
  transform: StoryOverlayTransform;
  shadowStrength: number;
  dimStrength: number;
}): Promise<Blob> {
  const [photoImage, overlayImage, logoImage] = await Promise.all([
    loadBlobImage(photo),
    loadBlobImage(overlay),
    loadUrlImage("/brand/logo-white.svg"),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo stories are unavailable in this browser.");

  const photoRect = coverRect(
    photoImage.naturalWidth,
    photoImage.naturalHeight,
    STORY_WIDTH,
    STORY_HEIGHT
  );
  context.drawImage(photoImage, photoRect.x, photoRect.y, photoRect.width, photoRect.height);
  const overlayRect = storyOverlayRect(
    overlayImage.naturalWidth,
    overlayImage.naturalHeight,
    transform
  );
  // Dimmer first, then the brand, then the clock. The brand must sit ABOVE the tint
  // so a dimmer that happens to reach the top-left corner only ever helps the
  // wordmark's legibility instead of fading it.
  drawOverlayDimmer(context, overlayRect, dimStrength);
  drawFixedStoryBrand(context, logoImage);
  drawOverlayWithShadow(context, overlayImage, overlayRect, shadowStrength);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not render the photo story."))),
      "image/png",
      0.96
    );
  });
}
