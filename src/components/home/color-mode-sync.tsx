"use client";

import { useEffect } from "react";
import {
  APPEARANCE_CHANGE_EVENT,
  APPEARANCE_STORAGE_KEY,
  DARK_MODE_QUERY,
  parseAppearance,
  resolveColorMode,
} from "@/lib/appearance";

function applyStoredColorMode() {
  const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
  const resolved = resolveColorMode(parseAppearance(stored).colorMode);
  document.documentElement.dataset.colorMode = resolved;
}

export function ColorModeSync() {
  useEffect(() => {
    const darkMedia = window.matchMedia(DARK_MODE_QUERY);
    const sync = () => applyStoredColorMode();
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === APPEARANCE_STORAGE_KEY) sync();
    };

    sync();
    darkMedia.addEventListener("change", sync);
    window.addEventListener("storage", onStorage);
    window.addEventListener(APPEARANCE_CHANGE_EVENT, sync);
    return () => {
      darkMedia.removeEventListener("change", sync);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(APPEARANCE_CHANGE_EVENT, sync);
    };
  }, []);

  return null;
}
