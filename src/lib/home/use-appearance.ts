"use client";

import { useSyncExternalStore } from "react";
import {
  APPEARANCE_CHANGE_EVENT,
  APPEARANCE_STORAGE_KEY,
  defaultAppearance,
  parseAppearance,
  type AppearancePreferences,
} from "@/lib/appearance";

let cachedRaw: string | null | undefined;
let cachedAppearance: AppearancePreferences = defaultAppearance;

function getSnapshot(): AppearancePreferences {
  const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedAppearance = parseAppearance(raw);
  }
  return cachedAppearance;
}

function getServerSnapshot(): AppearancePreferences {
  return defaultAppearance;
}

function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === APPEARANCE_STORAGE_KEY) callback();
  };
  window.addEventListener(APPEARANCE_CHANGE_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(APPEARANCE_CHANGE_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAppearancePreferences() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
