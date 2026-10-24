"use client";

import { useSyncExternalStore } from "react";
import { APPEARANCE_CHANGE_EVENT, APPEARANCE_STORAGE_KEY, parseAppearance } from "@/lib/appearance";
import {
  BACKGROUND_MOBILE_MAX_WIDTH,
  DEFAULT_BACKGROUND_ENVIRONMENT,
  type BackgroundEnvironment,
} from "@/lib/home/backgrounds";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const PHONE_QUERY = `(max-width: ${BACKGROUND_MOBILE_MAX_WIDTH}px)`;

let cachedEnvironment: BackgroundEnvironment | null = null;

function resolveTheme(): BackgroundEnvironment["theme"] {
  const mode = parseAppearance(window.localStorage.getItem(APPEARANCE_STORAGE_KEY)).colorMode;
  const resolved = mode === "system"
    ? window.matchMedia(DARK_QUERY).matches ? "dark" : "light"
    : mode;
  return resolved === "dark" ? "night" : "day";
}

function getSnapshot(): BackgroundEnvironment {
  const theme = resolveTheme();
  const platform = window.matchMedia(PHONE_QUERY).matches ? "phone" : "computer";
  if (!cachedEnvironment || cachedEnvironment.theme !== theme || cachedEnvironment.platform !== platform) {
    cachedEnvironment = { theme, platform };
  }
  return cachedEnvironment;
}

function getServerSnapshot(): BackgroundEnvironment {
  return DEFAULT_BACKGROUND_ENVIRONMENT;
}

function subscribe(callback: () => void) {
  const darkMedia = window.matchMedia(DARK_QUERY);
  const phoneMedia = window.matchMedia(PHONE_QUERY);
  const onMediaChange = () => callback();
  const onStorageChange = () => callback();
  darkMedia.addEventListener("change", onMediaChange);
  phoneMedia.addEventListener("change", onMediaChange);
  window.addEventListener(APPEARANCE_CHANGE_EVENT, onStorageChange);
  window.addEventListener("storage", onStorageChange);
  return () => {
    darkMedia.removeEventListener("change", onMediaChange);
    phoneMedia.removeEventListener("change", onMediaChange);
    window.removeEventListener(APPEARANCE_CHANGE_EVENT, onStorageChange);
    window.removeEventListener("storage", onStorageChange);
  };
}

export function useBackgroundEnvironment() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
