"use client";

import { useEffect, useState } from "react";
import {
  defaultBackground,
  filterBackgrounds,
  preloadBackgrounds,
  type BackgroundEntry,
  type BackgroundEnvironment,
} from "@/lib/home/backgrounds";

export function useSelectedBackground(backgrounds: BackgroundEntry[], environment: BackgroundEnvironment) {
  const [src, setSrc] = useState(() => defaultBackground(backgrounds)?.src ?? null);

  useEffect(() => {
    let cancelled = false;
    const candidates = filterBackgrounds(backgrounds, environment);
    const selected = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : null;
    void preloadBackgrounds(candidates).then(() => {
      if (!cancelled) setSrc(selected?.src ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [backgrounds, environment]);

  return src;
}
