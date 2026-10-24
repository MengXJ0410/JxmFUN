"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  filterBackgrounds,
  preloadBackgrounds,
  type BackgroundEntry,
  type BackgroundEnvironment,
} from "@/lib/home/backgrounds";

export const BACKGROUND_ROTATION_MS = 5000;

type RotationState = {
  index: number;
  previous: number | null;
  cycle: number;
};

export function useBackgroundRotation(backgrounds: BackgroundEntry[], environment: BackgroundEnvironment) {
  const candidates = useMemo(
    () => filterBackgrounds(backgrounds, environment),
    [backgrounds, environment],
  );
  const indexRef = useRef(0);
  const [rotation, setRotation] = useState<RotationState>({ index: 0, previous: null, cycle: 0 });

  useEffect(() => {
    void preloadBackgrounds(candidates);
  }, [candidates]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const start = candidates.length > 0 ? Math.floor(Math.random() * candidates.length) : 0;
      indexRef.current = start;
      setRotation((current) => ({ index: start, previous: null, cycle: current.cycle + 1 }));
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [candidates]);

  useEffect(() => {
    if (candidates.length < 2) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const current = indexRef.current % candidates.length;
      const next = (current + 1) % candidates.length;
      indexRef.current = next;
      setRotation((state) => ({ index: next, previous: current, cycle: state.cycle + 1 }));
    }, BACKGROUND_ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [candidates]);

  const current = candidates[rotation.index % Math.max(1, candidates.length)] ?? null;
  const previous = rotation.previous === null ? null : candidates[rotation.previous] ?? null;

  return { current, previous, cycle: rotation.cycle };
}