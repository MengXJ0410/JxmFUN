import { existsSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
  isBackgroundPlatform,
  isBackgroundTheme,
  type BackgroundPlatform,
  type BackgroundTheme,
} from "@/lib/home/backgrounds";
import type { BackgroundImage, BackgroundState } from "@/lib/backgrounds/types";

const CONFIG_PATH = join(process.cwd(), "config", "backgrounds.json");
const IMAGES_DIR = join(process.cwd(), "public", "images", "backgrounds");
const IMAGE_FILE = /^[^/\\]+\.(?:webp|png|jpe?g|avif|gif)$/i;
const SYNC_FILE = /^bg_[^/\\]+\.webp$/i;
const UPLOAD_LIMIT = 20 * 1024 * 1024;
const UPLOAD_NAME = /^bg_(\d+)\.webp$/i;

type StoredEntry = {
  file: string;
  theme: BackgroundTheme;
  platform: BackgroundPlatform;
  [key: string]: unknown;
};

type StoredConfig = {
  backgrounds: StoredEntry[];
  [key: string]: unknown;
};

function isFileEntry(value: unknown): value is StoredEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as { file?: unknown; theme?: unknown; platform?: unknown };
  return (
    typeof entry.file === "string" &&
    entry.file.length > 0 &&
    entry.file === basename(entry.file) &&
    IMAGE_FILE.test(entry.file) &&
    isBackgroundTheme(entry.theme) &&
    isBackgroundPlatform(entry.platform)
  );
}

function readConfig(): StoredConfig {
  if (!existsSync(CONFIG_PATH)) throw new Error("backgrounds.json not found");
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    throw new Error("backgrounds.json is not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as { backgrounds?: unknown }).backgrounds)) {
    throw new Error("backgrounds.json must contain a backgrounds array");
  }
  return parsed as StoredConfig;
}

function writeConfig(config: StoredConfig) {
  const data = `${JSON.stringify(config, null, 2)}\n`;
  const tempPath = `${CONFIG_PATH}.${process.pid}.tmp`;
  writeFileSync(tempPath, data, "utf8");
  try {
    renameSync(tempPath, CONFIG_PATH);
  } catch {
    writeFileSync(CONFIG_PATH, data, "utf8");
    try {
      unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors after the fallback write.
    }
  }
}

function listImages(): BackgroundImage[] {
  if (!existsSync(IMAGES_DIR)) return [];
  return readdirSync(IMAGES_DIR)
    .filter((file) => IMAGE_FILE.test(file))
    .sort((a, b) => a.localeCompare(b, "zh-CN"))
    .map((file) => {
      const stats = statSync(join(IMAGES_DIR, file));
      return { file, size: stats.size, modified: stats.mtimeMs };
    });
}

function imageUrl(file: string) {
  return `/images/backgrounds/${encodeURIComponent(file)}`;
}

function toState(config: StoredConfig): BackgroundState {
  const images = listImages();
  const available = new Set(images.map((image) => image.file));
  const entries = config.backgrounds.filter(isFileEntry).map((entry) => ({
    file: entry.file,
    src: imageUrl(entry.file),
    theme: entry.theme,
    platform: entry.platform,
    exists: available.has(entry.file),
  }));
  return {
    images,
    entries,
    missing: entries.filter((entry) => !entry.exists),
  };
}

export function getBackgroundState() {
  return toState(readConfig());
}

export function updateBackgroundEntry(file: unknown, values: { theme?: unknown; platform?: unknown }) {
  if (
    typeof file !== "string" ||
    file.length === 0 ||
    file !== basename(file) ||
    !IMAGE_FILE.test(file) ||
    !existsSync(join(IMAGES_DIR, file))
  ) {
    throw new Error("Invalid background file");
  }
  if (values.theme !== undefined && !isBackgroundTheme(values.theme)) throw new Error("Invalid theme");
  if (values.platform !== undefined && !isBackgroundPlatform(values.platform)) throw new Error("Invalid platform");

  const config = readConfig();
  let entry = config.backgrounds.find((item) => item.file === file);
  if (!entry) {
    entry = { file, theme: "both", platform: "both" };
    config.backgrounds.push(entry);
  }
  if (values.theme !== undefined) entry.theme = values.theme as BackgroundTheme;
  if (values.platform !== undefined) entry.platform = values.platform as BackgroundPlatform;
  writeConfig(config);
  return toState(config);
}

export function removeBackgroundEntry(file: unknown) {
  if (typeof file !== "string" || file.length === 0) throw new Error("Invalid background file");
  const config = readConfig();
  const before = config.backgrounds.length;
  config.backgrounds = config.backgrounds.filter((entry) => entry.file !== file);
  if (config.backgrounds.length === before) throw new Error("Background entry not found");
  writeConfig(config);
  return toState(config);
}

export function syncBackgroundConfig(prune: boolean) {
  const config = readConfig();
  const images = listImages();
  const syncFiles = images.map((image) => image.file).filter((file) => SYNC_FILE.test(file));
  const existing = new Set(config.backgrounds.map((entry) => entry.file));
  let added = 0;
  let removed = 0;

  for (const file of syncFiles) {
    if (existing.has(file)) continue;
    config.backgrounds.push({ file, theme: "both", platform: "both" });
    existing.add(file);
    added += 1;
  }

  if (prune) {
    const available = new Set(images.map((image) => image.file));
    const before = config.backgrounds.length;
    config.backgrounds = config.backgrounds.filter((entry) => available.has(entry.file));
    removed = before - config.backgrounds.length;
  }

  writeConfig(config);
  return { state: toState(config), added, removed };
}

export function uploadBackground(buffer: Buffer, values: { theme?: unknown; platform?: unknown } = {}) {
  if (buffer.length === 0) throw new Error("Empty file");
  if (buffer.length > UPLOAD_LIMIT) throw new Error("File is larger than 20MB");
  if (
    buffer.length < 12 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    throw new Error("Only WebP images are supported");
  }
  if (values.theme !== undefined && !isBackgroundTheme(values.theme)) throw new Error("Invalid theme");
  if (values.platform !== undefined && !isBackgroundPlatform(values.platform)) throw new Error("Invalid platform");

  const file = nextUploadName();
  const fullPath = join(IMAGES_DIR, file);
  writeFileSync(fullPath, buffer, { flag: "wx" });

  try {
    const config = readConfig();
    config.backgrounds.push({
      file,
      theme: (values.theme as BackgroundTheme | undefined) ?? "both",
      platform: (values.platform as BackgroundPlatform | undefined) ?? "both",
    });
    writeConfig(config);
    return { file, state: toState(config) };
  } catch (error) {
    try {
      unlinkSync(fullPath);
    } catch {
      // Keep the original error.
    }
    throw error;
  }
}

function nextUploadName() {
  const existing = new Set(existsSync(IMAGES_DIR) ? readdirSync(IMAGES_DIR) : []);
  for (let index = 1; index < 100000; index += 1) {
    const file = `bg_${String(index).padStart(3, "0")}.webp`;
    if (!existing.has(file)) return file;
  }
  throw new Error("No available background file name");
}

export function isUploadName(file: string) {
  return UPLOAD_NAME.test(file);
}