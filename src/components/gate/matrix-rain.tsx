"use client";

import { useEffect, useRef } from "react";
import styles from "./gate.module.css";

const GLYPHS = "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF";
const BASE_FONT_SIZE = 15;
const TRAIL_LENGTH = 14;
const POOL_SIZE = 100;
const MIN_SCALE = 0.75;
const MAX_SCALE = 1.25;
const FRAME_MS = 1000 / 30;
const MAX_DPR = 1.5;

type RainDrop = {
  x: number;
  y: number;
  speed: number;
  color: string;
  fontSize: number;
  font: string;
  glyphs: string[];
};

type MatrixRainProps = {
  reduceMotion: boolean;
};

export function MatrixRain({ reduceMotion }: MatrixRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const drawingCanvas: HTMLCanvasElement = canvas;
    const ctx: CanvasRenderingContext2D = context;
    const stylesheet = getComputedStyle(drawingCanvas);
    const colors = [
      stylesheet.getPropertyValue("--gate-rain-cyan").trim() || "#16d9e3",
      stylesheet.getPropertyValue("--gate-rain-pink").trim() || "#ff5fa2",
      stylesheet.getPropertyValue("--gate-rain-soft").trim() || "#ffd0e2",
    ];

    let width = 1;
    let height = 1;
    let activeCount = 0;
    let frame = 0;
    let lastTime = 0;
    let running = !document.hidden;

    const drops: RainDrop[] = Array.from({ length: POOL_SIZE }, () => ({
      x: 0,
      y: 0,
      speed: 0,
      color: colors[0],
      fontSize: BASE_FONT_SIZE,
      font: `${BASE_FONT_SIZE}px ui-monospace, SFMono-Regular, Consolas, monospace`,
      glyphs: new Array<string>(TRAIL_LENGTH).fill("0"),
    }));

    const randomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    const randomColor = () => colors[Math.floor(Math.random() * colors.length)];

    function resetDrop(drop: RainDrop, index: number, count: number, spreadOnScreen: boolean) {
      const fontSize = BASE_FONT_SIZE * (MIN_SCALE + Math.random() * (MAX_SCALE - MIN_SCALE));
      const slot = width / Math.max(1, count);
      drop.x = (index + 0.2 + Math.random() * 0.6) * slot;
      drop.y = spreadOnScreen
        ? Math.random() * (height + TRAIL_LENGTH * fontSize) - TRAIL_LENGTH * fontSize
        : -Math.random() * (TRAIL_LENGTH * fontSize + 30);
      drop.speed = (0.55 + Math.random() * 0.9) * 0.55 * BASE_FONT_SIZE;
      drop.color = randomColor();
      drop.fontSize = fontSize;
      drop.font = `${fontSize.toFixed(1)}px ui-monospace, SFMono-Regular, Consolas, monospace`;
      for (let glyphIndex = 0; glyphIndex < TRAIL_LENGTH; glyphIndex += 1) {
        drop.glyphs[glyphIndex] = randomGlyph();
      }
    }

    function resize() {
      const rect = drawingCanvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      drawingCanvas.width = Math.round(width * ratio);
      drawingCanvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      const nextCount = Math.max(1, Math.min(POOL_SIZE, Math.ceil(width / BASE_FONT_SIZE)));
      if (nextCount !== activeCount) {
        activeCount = nextCount;
        for (let index = 0; index < activeCount; index += 1) {
          resetDrop(drops[index], index, activeCount, true);
        }
      } else {
        const slot = width / activeCount;
        for (let index = 0; index < activeCount; index += 1) {
          drops[index].x = (index + 0.2 + Math.random() * 0.6) * slot;
        }
      }
      draw();
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      ctx.textBaseline = "top";

      for (let dropIndex = 0; dropIndex < activeCount; dropIndex += 1) {
        const drop = drops[dropIndex];
        ctx.font = drop.font;

        for (let index = TRAIL_LENGTH - 1; index >= 0; index -= 1) {
          const y = drop.y - index * drop.fontSize;
          if (y < -drop.fontSize || y > height) continue;
          const alpha = index === 0 ? 0.95 : Math.max(0.06, 0.6 - index * 0.038);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = index === 0 ? drop.color : index < 3 ? colors[2] : drop.color;
          ctx.fillText(drop.glyphs[index] ?? "0", drop.x, y);
        }
      }
      ctx.globalAlpha = 1;
    }

    function step(time: number) {
      frame = 0;
      if (!running) return;
      if (time - lastTime < FRAME_MS) {
        frame = window.requestAnimationFrame(step);
        return;
      }
      lastTime = time;

      for (let index = 0; index < activeCount; index += 1) {
        const drop = drops[index];
        drop.y += drop.speed;
        if (drop.y - TRAIL_LENGTH * drop.fontSize > height) {
          resetDrop(drop, index, activeCount, false);
        } else if (Math.random() < 0.08) {
          drop.glyphs[0] = randomGlyph();
        }
      }

      draw();
      frame = window.requestAnimationFrame(step);
    }

    function onVisibilityChange() {
      running = !document.hidden;
      if (!running) {
        window.cancelAnimationFrame(frame);
        frame = 0;
        return;
      }
      if (!reduceMotion && !frame) {
        lastTime = 0;
        frame = window.requestAnimationFrame(step);
      }
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    document.addEventListener("visibilitychange", onVisibilityChange);
    resize();

    if (!reduceMotion && running) frame = window.requestAnimationFrame(step);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.cancelAnimationFrame(frame);
    };
  }, [reduceMotion]);

  return <canvas ref={canvasRef} className={styles.matrix} aria-hidden="true" />;
}
