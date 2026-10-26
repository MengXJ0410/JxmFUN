"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { HOME_BUBBLE_TERMS } from "@/content/home";
import { APPEARANCE_CHANGE_EVENT, APPEARANCE_STORAGE_KEY, DEFAULT_ACCENT, defaultAppearance, deriveBubbleColor, parseAppearance, type AppearanceChangeDetail } from "@/lib/appearance";
import { advanceParticles, createBubbleVisuals, placeBubbleParticles, type BubbleParticle, type BubbleRect } from "@/lib/home/bubbles";
import { filterBackgrounds, type BackgroundEntry } from "@/lib/home/backgrounds";
import { useBackgroundEnvironment } from "@/lib/home/use-background-environment";
import { useBackgroundRotation } from "@/lib/home/use-background-rotation";
import { HOME_PAGE_COUNT, getHomePageIndexFromScroll, nextHomePageIndex } from "@/lib/home/sections";
import { AboutSection } from "@/components/home/about-section";
import { AppearanceControl } from "@/components/home/appearance-control";
import { HeroSection } from "@/components/home/hero-section";
import { MoreSection } from "@/components/home/more-section";
import { PageDots } from "@/components/home/page-dots";

type HomePageProps = { backgrounds: BackgroundEntry[] };

export function HomePage({ backgrounds }: HomePageProps) {
  const environment = useBackgroundEnvironment();
  const backgroundCandidates = filterBackgrounds(backgrounds, environment);
  const rotation = useBackgroundRotation(backgrounds, environment);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<BubbleParticle[]>([]);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const activityRef = useRef(defaultAppearance.bubbleActivity);
  const wheelLockRef = useRef(false);
  const [bubbles] = useState(() => createBubbleVisuals(HOME_BUBBLE_TERMS, () => 0.5));
  const [activePage, setActivePage] = useState(0);
  const [returning, setReturning] = useState(false);
  const [accent, setAccent] = useState(() => typeof window === "undefined" ? DEFAULT_ACCENT : parseAppearance(localStorage.getItem(APPEARANCE_STORAGE_KEY)).accent);
  const [bubbleColorRange, setBubbleColorRange] = useState(() => typeof window === "undefined" ? defaultAppearance.bubbleColorRange : parseAppearance(localStorage.getItem(APPEARANCE_STORAGE_KEY)).bubbleColorRange);

  const scrollToPage = useCallback((index: number) => {
    const root = scrollRef.current;
    if (!root) return;
    const target = Math.max(0, Math.min(HOME_PAGE_COUNT - 1, index));
    root.scrollTo({ top: root.clientHeight * target, behavior: "smooth" });
    setActivePage(target);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (stored) activityRef.current = parseAppearance(stored).bubbleActivity;
    const onAppearanceChange = (event: Event) => {
      const detail = (event as CustomEvent<AppearanceChangeDetail>).detail;
      setAccent(detail.accent);
      setBubbleColorRange(detail.bubbleColorRange);
      activityRef.current = detail.bubbleActivity;
    };
    window.addEventListener(APPEARANCE_CHANGE_EVENT, onAppearanceChange);
    return () => window.removeEventListener(APPEARANCE_CHANGE_EVENT, onAppearanceChange);
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    let scrollTimer = 0;
    let wheelTimer = 0;
    const onScroll = () => {
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => setActivePage(getHomePageIndexFromScroll(root.scrollTop, root.clientHeight)), 70);
    };
    const onWheel = (event: WheelEvent) => {
      const current = getHomePageIndexFromScroll(root.scrollTop, root.clientHeight);
      const target = nextHomePageIndex(current, event.deltaY);
      if (target === current || wheelLockRef.current) return;
      event.preventDefault();
      wheelLockRef.current = true;
      scrollToPage(target);
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => { wheelLockRef.current = false; }, 680);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const current = getHomePageIndexFromScroll(root.scrollTop, root.clientHeight);
      if (["ArrowDown", "PageDown"].includes(event.key)) {
        event.preventDefault();
        scrollToPage(current + 1);
      } else if (["ArrowUp", "PageUp"].includes(event.key)) {
        event.preventDefault();
        scrollToPage(current - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        scrollToPage(0);
      } else if (event.key === "End") {
        event.preventDefault();
        scrollToPage(HOME_PAGE_COUNT - 1);
      }
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    root.addEventListener("wheel", onWheel, { passive: false });
    root.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(wheelTimer);
      root.removeEventListener("scroll", onScroll);
      root.removeEventListener("wheel", onWheel);
      root.removeEventListener("keydown", onKeyDown);
    };
  }, [scrollToPage]);

  useEffect(() => {
    const root = scrollRef.current, canvas = canvasRef.current;
    if (!root || !canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, paused = reducedMotion.matches || document.hidden, previousTime = 0;
    const shell = root, drawingCanvas = canvas, ctx = context;
    function bounds() { return { width: shell.clientWidth, height: shell.clientHeight, padding: 16 }; }
    function stageRect(): BubbleRect {
      const stage = shell.querySelector<HTMLElement>(".home-stage-content")?.getBoundingClientRect(), box = shell.getBoundingClientRect();
      return stage ? { left: stage.left - box.left, top: stage.top - box.top, right: stage.right - box.left, bottom: stage.bottom - box.top } : { left: shell.clientWidth / 2 - 130, top: shell.clientHeight / 2 - 70, right: shell.clientWidth / 2 + 130, bottom: shell.clientHeight / 2 + 70 };
    }
    function syncColors() {
      shell.querySelectorAll<HTMLElement>("[data-bubble-index]").forEach((element) => {
        const bubble = bubbles[Number(element.dataset.bubbleIndex)];
        if (!bubble) return;
        const color = deriveBubbleColor(bubble, accent, bubbleColorRange);
        element.style.setProperty("--bubble-gradient", `radial-gradient(circle at 30% 25%,${color.highlight},${color.base} 72%,${color.shadow})`);
        element.style.setProperty("--bubble-text", color.text);
      });
    }
    function draw() {
      ctx.clearRect(0, 0, shell.clientWidth, shell.clientHeight);
      particlesRef.current.forEach((particle) => {
        const tint = `hsla(${particle.gradientAngle},85%,65%,`;
        const gradient = ctx.createRadialGradient(particle.x - particle.radius * .3, particle.y - particle.radius * .36, particle.radius * .04, particle.x, particle.y, particle.radius);
        gradient.addColorStop(0, `${tint}.38)`);
        gradient.addColorStop(.68, `${tint}.22)`);
        gradient.addColorStop(1, `${tint}.08)`);
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = `hsla(${particle.gradientAngle},90%,82%,.52)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }
    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      drawingCanvas.width = Math.round(shell.clientWidth * ratio);
      drawingCanvas.height = Math.round(shell.clientHeight * ratio);
      drawingCanvas.style.width = `${shell.clientWidth}px`;
      drawingCanvas.style.height = `${shell.clientHeight}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      particlesRef.current = placeBubbleParticles(bubbles, bounds(), stageRect());
      syncColors();
      draw();
    }
    function animate(time: number) {
      frame = 0;
      if (paused) return;
      const elapsed = Math.min((time - (previousTime || time)) / 1000, .05);
      previousTime = time;
      const activity = activityRef.current / 100, pointer = pointerRef.current;
      if (pointer && activity > 0) {
        for (const particle of particlesRef.current) {
          const dx = particle.x - pointer.x, dy = particle.y - pointer.y, distance = Math.hypot(dx, dy), influence = particle.radius + 112;
          if (distance > 0 && distance < influence) {
            const force = (1 - distance / influence) * (20 + 34 * activity) * elapsed;
            particle.vx += dx / distance * force;
            particle.vy += dy / distance * force;
          }
        }
      }
      if (activity > 0) advanceParticles(particlesRef.current, elapsed * (.45 + activity * 1.1), bounds(), stageRect());
      particlesRef.current.forEach((particle, index) => {
        const element = shell.querySelector<HTMLElement>(`[data-bubble-index="${index}"]`);
        if (!element) return;
        element.style.setProperty("--bubble-x", `${particle.x - particle.radius}px`);
        element.style.setProperty("--bubble-y", `${particle.y - particle.radius}px`);
        element.style.setProperty("--squash-angle", `${particle.squashAngle}rad`);
        element.style.setProperty("--squash-x", `${1 + particle.squash}px`);
        element.style.setProperty("--squash-y", `${1 - particle.squash}px`);
        element.style.setProperty("--bubble-ready", "1");
      });
      draw();
      frame = window.requestAnimationFrame(animate);
    }
    const syncMotion = () => {
      paused = reducedMotion.matches || document.hidden;
      if (paused) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      } else if (!frame) {
        frame = window.requestAnimationFrame(animate);
      }
    };
    reducedMotion.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncMotion);
    const observer = new ResizeObserver(resize);
    observer.observe(shell);
    resize();
    if (!paused) frame = window.requestAnimationFrame(animate);
    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncMotion);
      window.cancelAnimationFrame(frame);
    };
  }, [accent, bubbleColorRange, bubbles]);

  const returnToGate = async () => {
    if (returning) return;
    setReturning(true);
    try {
      const response = await fetch("/api/lock", { method: "POST", cache: "no-store" });
      if (!response.ok) throw new Error("Unable to lock session");
      window.location.replace("/");
    } catch {
      setReturning(false);
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointerRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const node = event.currentTarget;
    const x = (event.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
    const y = (event.clientY - rect.top) / Math.max(1, rect.height) - 0.5;
    node.style.setProperty("--bg-shift-x", `${(x * -3.2).toFixed(2)}%`);
    node.style.setProperty("--bg-shift-y", `${(y * -2).toFixed(2)}%`);
  };
  const pageStyle = { "--accent": accent } as CSSProperties;

  return (
    <main
      className="home-scroll-shell"
      ref={scrollRef}
      tabIndex={0}
      onPointerMove={onPointerMove}
      onPointerLeave={(event) => {
        pointerRef.current = null;
        event.currentTarget.style.setProperty("--bg-shift-x", "0%");
        event.currentTarget.style.setProperty("--bg-shift-y", "0%");
      }}
      style={pageStyle}
    >
      <HeroSection
        backgrounds={backgroundCandidates}
        currentFile={rotation.current?.file ?? null}
        previousFile={rotation.previous?.file ?? null}
        environment={environment}
        bubbles={bubbles}
        canvasRef={canvasRef}
        onExplore={() => scrollToPage(1)}
        onReturnToGate={returnToGate}
        returning={returning}
      />
      <AboutSection onExplore={() => scrollToPage(2)} />
      <MoreSection onHome={() => scrollToPage(0)} />
      <PageDots activePage={activePage} onSelect={scrollToPage} />
      <AppearanceControl />
    </main>
  );
}
