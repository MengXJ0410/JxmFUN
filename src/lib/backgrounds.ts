import { readdirSync } from "node:fs";
import { join } from "node:path";

const IMAGE_EXTENSION = /\.(?:png|jpe?g|webp|avif|gif)$/i;

export function getHomeBackgrounds() {
  try {
    return readdirSync(join(process.cwd(), "public", "images", "backgrounds"))
      .filter((file) => IMAGE_EXTENSION.test(file))
      .sort((a, b) => a.localeCompare(b, "zh-CN"))
      .map((file) => `/images/backgrounds/${encodeURIComponent(file)}`);
  } catch {
    return [];
  }
}
