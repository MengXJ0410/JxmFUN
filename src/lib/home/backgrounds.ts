export type BackgroundTheme = "day" | "night" | "both";
export type BackgroundPlatform = "computer" | "phone" | "both";
export type ResolvedTheme = Exclude<BackgroundTheme, "both">;
export type ResolvedPlatform = Exclude<BackgroundPlatform, "both">;

export type BackgroundEntry = {
  file: string;
  src: string;
  theme: BackgroundTheme;
  platform: BackgroundPlatform;
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
