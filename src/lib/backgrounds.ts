import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
  isBackgroundPlatform,
  isBackgroundTheme,
  type BackgroundEntry,
} from "@/lib/home/backgrounds";

const IMAGE_EXTENSION = /\.(?:png|jpe?g|webp|avif|gif)$/i;
const warned = new Set<string>();

function warn(message: string) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[backgrounds] ${message}`);
}

export function getHomeBackgrounds(): BackgroundEntry[] {
  const configPath = join(process.cwd(), "config", "backgrounds.json");
  const imagesDir = join(process.cwd(), "public", "images", "backgrounds");

  if (!existsSync(configPath)) {
    warn(`Config not found: ${configPath}`);
    return [];
  }

  let config: unknown;
  try {
    config = JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    warn(`Invalid JSON: ${configPath}`);
    return [];
  }

  const rawEntries = typeof config === "object" && config !== null && "backgrounds" in config
    ? (config as { backgrounds?: unknown }).backgrounds
    : null;

  if (!Array.isArray(rawEntries)) {
    warn("Config must contain a backgrounds array");
    return [];
  }

  const entries: BackgroundEntry[] = [];
  for (const raw of rawEntries) {
    if (typeof raw !== "object" || raw === null) {
      warn("Skipped a non-object background entry");
      continue;
    }
    const entry = raw as { file?: unknown; theme?: unknown; platform?: unknown };
    const file = entry.file;
    if (typeof file !== "string" || file.length === 0 || file !== basename(file) || !IMAGE_EXTENSION.test(file)) {
      warn(`Skipped invalid file entry: ${String(file)}`);
      continue;
    }
    if (!isBackgroundTheme(entry.theme)) {
      warn(`Skipped ${file}: invalid theme`);
      continue;
    }
    if (!isBackgroundPlatform(entry.platform)) {
      warn(`Skipped ${file}: invalid platform`);
      continue;
    }
    if (!existsSync(join(imagesDir, file))) {
      warn(`Skipped ${file}: file not found`);
      continue;
    }
    entries.push({
      file,
      src: `/images/backgrounds/${encodeURIComponent(file)}`,
      theme: entry.theme,
      platform: entry.platform,
    });
  }

  return entries;
}
