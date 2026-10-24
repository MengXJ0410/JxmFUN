import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import process from "node:process";

export const ROOT = process.cwd();
export const CONFIG_PATH = join(ROOT, "config", "backgrounds.json");
export const IMAGES_DIR = join(ROOT, "public", "images", "backgrounds");
export const THEMES = new Set(["day", "night", "both"]);
export const PLATFORMS = new Set(["computer", "phone", "both"]);
export const IMAGE_FILE = /^[^/\\]+\.(?:webp|png|jpe?g|avif|gif)$/i;
export const SYNC_FILE = /^bg_[^/\\]+\.webp$/i;
export const UPLOAD_LIMIT = 20 * 1024 * 1024;

export function readConfig() {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`Config not found: ${relative(ROOT, CONFIG_PATH)}`);
  }
  let config;
  try {
    config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    throw new Error(`Invalid JSON: ${relative(ROOT, CONFIG_PATH)}`);
  }
  if (typeof config !== "object" || config === null || !Array.isArray(config.backgrounds)) {
    throw new Error("Config must contain a backgrounds array");
  }
  return config;
}

export function writeConfig(config) {
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function listImageFiles(pattern = IMAGE_FILE) {
  if (!existsSync(IMAGES_DIR)) return [];
  return readdirSync(IMAGES_DIR)
    .filter((file) => pattern.test(file))
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function imageDetails() {
  return listImageFiles().map((file) => {
    const stats = statSync(join(IMAGES_DIR, file));
    return { file, size: stats.size, modified: stats.mtime.toISOString() };
  });
}

export function syncConfig({ prune = false } = {}) {
  const config = readConfig();
  const files = listImageFiles(SYNC_FILE);
  const existing = new Set(config.backgrounds.map((entry) => entry.file));
  let added = 0;
  let removed = 0;

  for (const file of files) {
    if (existing.has(file)) continue;
    config.backgrounds.push({ file, theme: "both", platform: "both" });
    existing.add(file);
    added += 1;
  }

  if (prune) {
    const available = new Set(listImageFiles());
    const before = config.backgrounds.length;
    config.backgrounds = config.backgrounds.filter((entry) => available.has(entry.file));
    removed = before - config.backgrounds.length;
  }

  writeConfig(config);
  return { added, removed, total: config.backgrounds.length };
}

export function updateEntry(file, values = {}) {
  if (typeof file !== "string" || file.length === 0 || file !== basename(file) || !IMAGE_FILE.test(file)) {
    throw new Error("Invalid background file");
  }
  const config = readConfig();
  let entry = config.backgrounds.find((item) => item.file === file);
  if (!entry) {
    entry = { file, theme: "both", platform: "both" };
    config.backgrounds.push(entry);
  }
  if (values.theme !== undefined) {
    if (!THEMES.has(values.theme)) throw new Error(`Invalid theme: ${values.theme}`);
    entry.theme = values.theme;
  }
  if (values.platform !== undefined) {
    if (!PLATFORMS.has(values.platform)) throw new Error(`Invalid platform: ${values.platform}`);
    entry.platform = values.platform;
  }
  writeConfig(config);
  return entry;
}

export function removeEntry(file) {
  const config = readConfig();
  const before = config.backgrounds.length;
  config.backgrounds = config.backgrounds.filter((entry) => entry.file !== file);
  if (config.backgrounds.length === before) throw new Error(`Entry not found: ${file}`);
  writeConfig(config);
}

export function readState() {
  const config = readConfig();
  const images = imageDetails();
  const available = new Set(images.map((image) => image.file));
  const entries = config.backgrounds.map((entry) => ({
    ...entry,
    exists: available.has(entry.file),
  }));
  return {
    images,
    entries,
    missing: entries.filter((entry) => !entry.exists),
  };
}

export function nextUploadName(config = readConfig()) {
  const existing = new Set(config.backgrounds.map((entry) => entry.file));
  if (existsSync(IMAGES_DIR)) {
    for (const file of readdirSync(IMAGES_DIR)) existing.add(file);
  }
  for (let index = 1; index < 100000; index += 1) {
    const file = `bg_${String(index).padStart(3, "0")}.webp`;
    if (!existing.has(file)) return file;
  }
  throw new Error("No available background file name");
}

export function uploadBackground(buffer) {
  if (buffer.length === 0) throw new Error("Empty file");
  if (buffer.length > UPLOAD_LIMIT) throw new Error("File is larger than 20MB");
  if (
    buffer.length < 12 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    throw new Error("Only WebP images are supported");
  }

  const config = readConfig();
  const file = nextUploadName(config);
  const fullPath = join(IMAGES_DIR, file);
  writeFileSync(fullPath, Buffer.from(buffer), { flag: "wx" });

  try {
    config.backgrounds.push({ file, theme: "both", platform: "both" });
    writeConfig(config);
    return { file, state: readState() };
  } catch (error) {
    try {
      unlinkSync(fullPath);
    } catch {
      // Keep the original error.
    }
    throw error;
  }
}