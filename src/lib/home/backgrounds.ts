export type BackgroundTheme = "day" | "night" | "both";
export type BackgroundPlatform = "computer" | "phone" | "both";
export type ResolvedTheme = Exclude<BackgroundTheme, "both">;
export type ResolvedPlatform = Exclude<BackgroundPlatform, "both">;

export type BackgroundFrame = {
  zoom: number;
  x: number;
  y: number;
};

export const DEFAULT_BACKGROUND_FRAME: BackgroundFrame = { zoom: 1, x: 50, y: 50 };

export type BackgroundEntry = {
  file: string;
  src: string;
  theme: BackgroundTheme;
  platform: BackgroundPlatform;
  frame: BackgroundFrame;
};

export type BackgroundEnvironment = {
  theme: ResolvedTheme;
  platform: ResolvedPlatform;
};

export const BACKGROUND_MOBILE_MAX_WIDTH = 760;

export const DEFAULT_BACKGROUND_ENVIRONMENT: BackgroundEnvironment = {
  theme: "day",
  platform: "computer",
};

export function isBackgroundTheme(value: unknown): value is BackgroundTheme {
  return value === "day" || value === "night" || value === "both";
}

export function isBackgroundPlatform(value: unknown): value is BackgroundPlatform {
  return value === "computer" || value === "phone" || value === "both";
}

function clampFrame(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function isBackgroundFrame(value: unknown): value is BackgroundFrame {
  if (typeof value !== "object" || value === null) return false;
  const frame = value as { zoom?: unknown; x?: unknown; y?: unknown };
  return (
    typeof frame.zoom === "number" && Number.isFinite(frame.zoom) && frame.zoom >= 1 && frame.zoom <= 2 &&
    typeof frame.x === "number" && Number.isFinite(frame.x) && frame.x >= 0 && frame.x <= 100 &&
    typeof frame.y === "number" && Number.isFinite(frame.y) && frame.y >= 0 && frame.y <= 100
  );
}

export function normalizeBackgroundFrame(value: unknown): BackgroundFrame {
  if (typeof value !== "object" || value === null) return DEFAULT_BACKGROUND_FRAME;
  const frame = value as { zoom?: unknown; x?: unknown; y?: unknown };
  return {
    zoom: clampFrame(frame.zoom, 1, 2, DEFAULT_BACKGROUND_FRAME.zoom),
    x: clampFrame(frame.x, 0, 100, DEFAULT_BACKGROUND_FRAME.x),
    y: clampFrame(frame.y, 0, 100, DEFAULT_BACKGROUND_FRAME.y),
  };
}

export function matchesEnvironment(entry: BackgroundEntry, environment: BackgroundEnvironment) {
  return (
    (entry.theme === "both" || entry.theme === environment.theme) &&
    (entry.platform === "both" || entry.platform === environment.platform)
  );
}

export function filterBackgrounds(entries: BackgroundEntry[], environment: BackgroundEnvironment) {
  const matching = entries.filter((entry) => matchesEnvironment(entry, environment));
  if (matching.length > 0) return matching;
  return entries.filter((entry) => entry.theme === "both" && entry.platform === "both");
}

export function pickBackground(entries: BackgroundEntry[], environment: BackgroundEnvironment, random = Math.random) {
  const candidates = filterBackgrounds(entries, environment);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(random() * candidates.length)] ?? null;
}

export function defaultBackground(entries: BackgroundEntry[]) {
  return entries.find((entry) => entry.theme === "both" && entry.platform === "both") ?? null;
}

export function preloadBackgrounds(entries: BackgroundEntry[]) {
  return Promise.all(
    entries.map(
      (entry) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          const done = () => resolve();
          image.onload = done;
          image.onerror = done;
          image.decoding = "async";
          image.src = entry.src;
          if (image.complete) resolve();
        }),
    ),
  ).then(() => undefined);
}
