export const APPEARANCE_STORAGE_KEY = "jxmfun-appearance-v1";
export const APPEARANCE_CHANGE_EVENT = "jxmfun:appearance-change";
export const DEFAULT_ACCENT = "#1fbbbb";
export type AppearanceMode = "system" | "light" | "dark";
export type ResolvedAppearanceMode = Exclude<AppearanceMode, "system">;
export type AppearancePreferences = { colorMode: AppearanceMode; accent: string; bubbleColorRange: number; bubbleActivity: number };
export type AppearanceChangeDetail = AppearancePreferences & { colorMode: ResolvedAppearanceMode };
export type BubbleColorFactors = { redFactor: number; greenFactor: number; blueFactor: number };
export type DerivedBubbleColor = { highlight: string; base: string; shadow: string; text: string };
export const defaultAppearance: AppearancePreferences = { colorMode: "system", accent: DEFAULT_ACCENT, bubbleColorRange: 60, bubbleActivity: 70 };
export const ACCENT_SWATCHES = ["#1fbbbb", "#2f63c8", "#9f3f68", "#c25d22", "#7057b8"];

export function isHexColor(value: unknown): value is string { return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value); }
export function isAppearanceMode(value: unknown): value is AppearanceMode { return value === "system" || value === "light" || value === "dark"; }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function channels(hex: string) { return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)); }
function toHex(values: number[]) { return `#${values.map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0")).join("")}`; }
function mix(a: number[], b: number[], amount: number) { return a.map((value, index) => value * (1 - amount) + b[index] * amount); }

export function deriveBubbleColor(factors: BubbleColorFactors, accent: string, range = defaultAppearance.bubbleColorRange): DerivedBubbleColor {
  const base = channels(isHexColor(accent) ? accent : DEFAULT_ACCENT);
  const color = base.map((value, index) => value + [factors.redFactor, factors.greenFactor, factors.blueFactor][index] * range);
  const luminance = color[0] * .2126 + color[1] * .7152 + color[2] * .0722;
  return {
    highlight: toHex(mix(color, [255, 255, 255], .34)),
    base: toHex(color),
    shadow: toHex(mix(color, [5, 10, 24], .38)),
    text: luminance > 145 ? "#122033" : "#ffffff",
  };
}

export function parseAppearance(value: string | null): AppearancePreferences {
  if (!value) return defaultAppearance;
  const data = JSON.parse(value) as Partial<AppearancePreferences>;
  return {
    colorMode: isAppearanceMode(data.colorMode) ? data.colorMode : "system",
    accent: isHexColor(data.accent) ? data.accent : DEFAULT_ACCENT,
    bubbleColorRange: typeof data.bubbleColorRange === "number" ? clamp(data.bubbleColorRange, 0, 100) : defaultAppearance.bubbleColorRange,
    bubbleActivity: typeof data.bubbleActivity === "number" ? clamp(data.bubbleActivity, 0, 200) : defaultAppearance.bubbleActivity,
  };
}
