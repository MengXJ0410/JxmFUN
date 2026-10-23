import { readdirSync } from "node:fs";
import { join } from "node:path";
import { HomeHero } from "@/components/home/home-hero";

const IMAGE_EXTENSION = /\.(?:png|jpe?g|webp|avif|gif)$/i;

function getBackgrounds() {
  try {
    return readdirSync(join(process.cwd(), "public", "home-backgrounds"))
      .filter((file) => IMAGE_EXTENSION.test(file))
      .sort((a, b) => a.localeCompare(b, "zh-CN"))
      .map((file) => `/home-backgrounds/${encodeURIComponent(file)}`);
  } catch {
    return [];
  }
}

export default function HomePage() {
  return <HomeHero backgrounds={getBackgrounds()} />;
}
