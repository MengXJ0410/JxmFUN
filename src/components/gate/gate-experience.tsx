"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GateScreen } from "@/components/gate/gate-screen";
import { HomePage } from "@/components/home/home-page";
import { GATE_TIMING } from "@/content/gate";
import { filterBackgrounds, preloadBackgrounds, type BackgroundEntry } from "@/lib/home/backgrounds";
import { useBackgroundEnvironment } from "@/lib/home/use-background-environment";

type GateExperienceProps = {
  unlocked: boolean;
  backgrounds: BackgroundEntry[];
};

export function GateExperience({ unlocked, backgrounds }: GateExperienceProps) {
  const router = useRouter();
  const environment = useBackgroundEnvironment();
  const unlockingRef = useRef(false);
  const [granted, setGranted] = useState(unlocked);
  const [gateMounted, setGateMounted] = useState(!unlocked);
  const [leaving, setLeaving] = useState(false);
  const showHome = granted || unlocked;
  const showGate = gateMounted && !unlocked;

  useEffect(() => {
    const candidates = filterBackgrounds(backgrounds, environment);
    void preloadBackgrounds(candidates);
  }, [backgrounds, environment]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => {
      setGateMounted(false);
      startTransition(() => router.refresh());
    }, GATE_TIMING.exitMs + 300);
    return () => window.clearTimeout(timer);
  }, [leaving, router]);

  const onUnlocked = useCallback(() => {
    if (unlockingRef.current) return;
    unlockingRef.current = true;
    setGranted(true);
    setLeaving(true);
  }, []);

  return (
    <>
      {showHome ? <HomePage key="home" backgrounds={backgrounds} /> : null}
      {showGate ? <GateScreen key="gate" onUnlocked={onUnlocked} leaving={leaving} /> : null}
    </>
  );
}
