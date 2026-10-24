"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GateScreen } from "@/components/gate/gate-screen";
import { HomePage } from "@/components/home/home-page";
import { GATE_TIMING } from "@/content/gate";
import { filterBackgrounds, preloadBackgrounds, type BackgroundEntry } from "@/lib/home/backgrounds";
import { useBackgroundEnvironment } from "@/lib/home/use-background-environment";

const GATE_EXIT_MS = GATE_TIMING.exitMs;

type GateExperienceProps = {
  unlocked: boolean;
  backgrounds: BackgroundEntry[];
};

export function GateExperience({ unlocked, backgrounds }: GateExperienceProps) {
  const router = useRouter();
  const environment = useBackgroundEnvironment();
  const [refreshing, setRefreshing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [dismissed, setDismissed] = useState(unlocked);

  useEffect(() => {
    const candidates = filterBackgrounds(backgrounds, environment);
    void preloadBackgrounds(candidates);
  }, [backgrounds, environment]);

  useEffect(() => {
    if (!unlocked || !refreshing || dismissed) return;
    const frame = window.requestAnimationFrame(() => setLeaving(true));
    return () => window.cancelAnimationFrame(frame);
  }, [unlocked, refreshing, dismissed]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setDismissed(true), GATE_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  const onUnlocked = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    startTransition(() => router.refresh());
  }, [refreshing, router]);

  return (
    <>
      {unlocked ? <HomePage key="home" backgrounds={backgrounds} /> : null}
      {!dismissed ? <GateScreen key="gate" onUnlocked={onUnlocked} leaving={leaving} /> : null}
    </>
  );
}