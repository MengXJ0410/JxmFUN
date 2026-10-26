"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Settings } from "lucide-react";
import type { Application } from "pixi.js";
import type { Live2DModel } from "untitled-pixi-live2d-engine/cubism";
import {
  LIVE2D_CLICK_EXPRESSIONS,
  LIVE2D_CLICK_HOLD_MS,
  LIVE2D_CORE_PATH,
  LIVE2D_EXPRESSION_LINES,
  LIVE2D_GREETINGS,
  LIVE2D_IDLE_LEAVE_MS,
  LIVE2D_IDLE_LINES,
  LIVE2D_IDLE_POSE,
  LIVE2D_IDLE_POSE_FIRST_MAX_MS,
  LIVE2D_IDLE_POSE_FIRST_MIN_MS,
  LIVE2D_IDLE_POSE_HOLD_MAX_MS,
  LIVE2D_IDLE_POSE_HOLD_MIN_MS,
  LIVE2D_IDLE_POSE_REPEAT_MAX_MS,
  LIVE2D_IDLE_POSE_REPEAT_MIN_MS,
  LIVE2D_IDLE_POSE_RETRY_MAX_MS,
  LIVE2D_IDLE_POSE_RETRY_MIN_MS,
  LIVE2D_IDLE_STILL_MS,
  LIVE2D_MIN_TOP_PX,
  LIVE2D_MODEL_PATH,
  LIVE2D_MODEL_PATH_FALLBACK,
  LIVE2D_PASSTHROUGH_STORAGE_KEY,
  LIVE2D_POSITION_STORAGE_KEY,
  LIVE2D_SCALE_STORAGE_KEY,
  LIVE2D_SESSION_KEY,
  LIVE2D_SIZE_DEFAULT,
  LIVE2D_SIZE_MAX,
  LIVE2D_SIZE_MIN,
  LIVE2D_STORAGE_KEY,
  LIVE2D_TAP_LINES,
  type Live2DExpression,
} from "@/content/live2d";
import { advanceIdleGaze, createIdleGaze, type IdleGazeState } from "@/lib/live2d/idle";
import { Live2DSettingsPanel } from "@/components/live2d/live2d-settings-panel";
import styles from "./live2d-companion.module.css";

type CompanionStatus = "idle" | "loading" | "ready" | "error";

type StoredPosition = { left: number; top: number };

type ParameterCore = {
  setParameterValueById: (id: unknown, value: number, weight?: number) => void;
};

type ParameterHandleSource = {
  getIdSafe?: (id: string) => unknown;
  idManager?: { getId: (id: string) => unknown };
};

let corePromise: Promise<void> | null = null;
let pluginRegistered = false;
let cubismConfigured = false;

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function loadCubismCore(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Live2D core needs a browser"));
  }
  const scope = window as Window & { Live2DCubismCore?: unknown };
  if (scope.Live2DCubismCore) return Promise.resolve();
  if (corePromise) return corePromise;

  corePromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = LIVE2D_CORE_PATH;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      corePromise = null;
      script.remove();
      reject(new Error("Failed to load Live2D Cubism Core"));
    };
    document.head.appendChild(script);
  });

  return corePromise;
}

function getParameterId(model: Live2DModel, name: string): unknown {
  const internal = model.internalModel as unknown as ParameterHandleSource;
  if (internal.getIdSafe) return internal.getIdSafe(name);
  if (internal.idManager) return internal.idManager.getId(name);
  return name;
}

function safeDestroy(action: () => void) {
  try {
    action();
  } catch (error) {
    console.warn("[live2d] cleanup failed", error);
  }
}

function readStoredPosition(): StoredPosition | null {
  try {
    const raw = window.localStorage.getItem(LIVE2D_POSITION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { left?: unknown; top?: unknown };
    if (typeof parsed.left !== "number" || typeof parsed.top !== "number") return null;
    if (!Number.isFinite(parsed.left) || !Number.isFinite(parsed.top)) return null;
    return { left: parsed.left, top: parsed.top };
  } catch {
    return null;
  }
}

function readStoredScale() {
  const raw = Number(window.localStorage.getItem(LIVE2D_SCALE_STORAGE_KEY));
  if (!Number.isFinite(raw) || raw <= 0) return LIVE2D_SIZE_DEFAULT;
  return clamp(raw, LIVE2D_SIZE_MIN, LIVE2D_SIZE_MAX);
}

export function Live2DCompanion() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLButtonElement>(null);
  const bubbleTimerRef = useRef<number | null>(null);

  const [initialized, setInitialized] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [passthrough, setPassthrough] = useState(false);
  const [scale, setScale] = useState(LIVE2D_SIZE_DEFAULT);
  const [position, setPosition] = useState<StoredPosition | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState({ x: 12, y: 12 });
  const [status, setStatus] = useState<CompanionStatus>("idle");
  const [bubble, setBubble] = useState<string | null>(null);

  const showBubble = useCallback((text: string, duration = 6200) => {
    if (bubbleTimerRef.current) window.clearTimeout(bubbleTimerRef.current);
    setBubble(text);
    bubbleTimerRef.current = window.setTimeout(() => {
      setBubble(null);
      bubbleTimerRef.current = null;
    }, duration);
  }, []);

  const clearBubble = useCallback(() => {
    if (bubbleTimerRef.current) {
      window.clearTimeout(bubbleTimerRef.current);
      bubbleTimerRef.current = null;
    }
    setBubble(null);
  }, []);

  const openSettingsAt = useCallback((x: number, y: number) => {
    setSettingsAnchor({ x, y });
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const persistPosition = useCallback((value: StoredPosition) => {
    try {
      window.localStorage.setItem(LIVE2D_POSITION_STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Storage can be unavailable in private browsing; the position still works in memory.
    }
  }, []);

  const persistEnabled = useCallback((next: boolean) => {
    setEnabled(next);
    try {
      window.localStorage.setItem(LIVE2D_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const toggleEnabled = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(LIVE2D_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Ignore storage failures.
      }
      return next;
    });
  }, []);

  const showCompanion = useCallback(() => {
    persistEnabled(true);
  }, [persistEnabled]);

  const togglePassthrough = useCallback(() => {
    setPassthrough((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(LIVE2D_PASSTHROUGH_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Ignore storage failures.
      }
      return next;
    });
  }, []);

  const changeScale = useCallback((value: number) => {
    const next = clamp(Math.round(value), LIVE2D_SIZE_MIN, LIVE2D_SIZE_MAX);
    setScale(next);
    try {
      window.localStorage.setItem(LIVE2D_SCALE_STORAGE_KEY, String(next));
    } catch {
      // Ignore storage failures.
    }
  }, []);

  useEffect(() => {
    const apply = () => {
      const mobile = window.matchMedia("(max-width: 760px)").matches;
      const storedEnabled = window.localStorage.getItem(LIVE2D_STORAGE_KEY);
      const storedPassthrough = window.localStorage.getItem(LIVE2D_PASSTHROUGH_STORAGE_KEY);
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setEnabled(storedEnabled === "1" ? true : storedEnabled === "0" ? false : !mobile);
      setPassthrough(storedPassthrough === "1");
      setScale(readStoredScale());
      setPosition(readStoredPosition());
      setInitialized(true);
    };
    const timer = window.setTimeout(apply, 0);
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const layout = useMemo(() => {
    if (!viewport.width || !viewport.height) return null;
    const mobile = viewport.width <= 760;
    const baseHeight = Math.min(
      mobile ? 380 : 640,
      viewport.height * (mobile ? 0.46 : 0.72),
    );
    const height = Math.max(
      200,
      Math.min(baseHeight * (scale / 100), viewport.height * 0.95),
    );
    const width = mobile
      ? Math.min(viewport.width * 0.76, 340)
      : Math.min(420, viewport.width * 0.4);
    const defaultLeft = Math.max(0, viewport.width - width);
    const defaultTop = Math.max(
      LIVE2D_MIN_TOP_PX,
      viewport.height - (height * 2) / 3,
    );
    const maxTop = Math.max(
      LIVE2D_MIN_TOP_PX,
      viewport.height - height / 3,
    );
    const left = position
      ? clamp(position.left, 0, viewport.width - width)
      : defaultLeft;
    const top = position
      ? clamp(position.top, LIVE2D_MIN_TOP_PX, maxTop)
      : defaultTop;
    return { left, top, width, height };
  }, [position, scale, viewport]);

  useEffect(() => {
    if (!enabled) return;
    const mount = mountRef.current;
    if (!mount) return;

    let cancelled = false;
    let app: Application | null = null;
    let model: Live2DModel | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let idleSpeechTimer: number | null = null;
    let idlePoseTimer: number | null = null;
    let expressionTimer: number | null = null;
    let greetingTimer: number | null = null;
    let startTimer: number | null = null;
    let removePointer: (() => void) | null = null;
    let removeVisibility: (() => void) | null = null;
    let removeWheel: (() => void) | null = null;
    let removeCanvasPointer: (() => void) | null = null;
    let removeCanvasMouse: (() => void) | null = null;
    let removeWindowResize: (() => void) | null = null;
    let targetX = 0;
    let targetY = 0;
    let smoothX = 0;
    let smoothY = 0;
    let gazeMode: "follow" | "idle" = "follow";
    let expressionMode: "none" | "idle-pose" | "click" = "none";
    let idleGazeState: IdleGazeState | null = null;
    let lastPointerAt = performance.now();
    let pointerLeftAt = performance.now();

    const pointerRef: { current: { x: number; y: number } | null } = { current: null };
    const headAnchorRef: { current: { x: number; y: number } | null } = { current: null };

    const fitModel = () => {
      if (!model || !app) return;
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      const bounds = model.getLocalBounds();
      const modelWidth = Math.max(1, bounds.width || model.width);
      const modelHeight = Math.max(1, bounds.height || model.height);
      const nextScale = Math.min(width / modelWidth, height / modelHeight) * 0.98;
      model.scale.set(nextScale, nextScale);
      model.anchor.set(0.5, 1);
      model.position.set(width / 2, height);
    };

    const updateGaze = () => {
      const pointer = pointerRef.current;
      const head = headAnchorRef.current;
      if (!pointer || !head) return;
      targetX = clamp(
        (pointer.x - head.x) / (window.innerWidth * 0.5),
        -1,
        1,
      );
      targetY = clamp(
        (pointer.y - head.y) / (window.innerHeight * 0.5),
        -1,
        1,
      );
    };

    const scheduleIdleSpeech = () => {
      if (idleSpeechTimer) window.clearTimeout(idleSpeechTimer);
      idleSpeechTimer = window.setTimeout(() => {
        if (!cancelled && document.visibilityState === "visible") {
          showBubble(pick(LIVE2D_IDLE_LINES));
        }
        scheduleIdleSpeech();
      }, 25000 + Math.random() * 20000);
    };

    function startExpression(
      name: Live2DExpression,
      holdMs: number,
      mode: "idle-pose" | "click",
    ) {
      if (cancelled || !model) return;
      if (expressionTimer) {
        window.clearTimeout(expressionTimer);
        expressionTimer = null;
      }
      expressionMode = mode;
      void model.expression(name).catch((error: unknown) => {
        console.warn("[live2d] expression failed", error);
      });
      expressionTimer = window.setTimeout(() => {
        expressionTimer = null;
        if (cancelled) return;
        model?.internalModel.motionManager.expressionManager?.resetExpression();
        expressionMode = "none";
        if (gazeMode === "idle") {
          scheduleIdlePose(
            LIVE2D_IDLE_POSE_REPEAT_MIN_MS,
            LIVE2D_IDLE_POSE_REPEAT_MAX_MS,
          );
        }
      }, holdMs);
    }

    function scheduleIdlePose(minimumMs: number, maximumMs: number) {
      if (idlePoseTimer) {
        window.clearTimeout(idlePoseTimer);
        idlePoseTimer = null;
      }
      if (cancelled || gazeMode !== "idle") return;
      const delay =
        minimumMs + Math.random() * Math.max(0, maximumMs - minimumMs);
      idlePoseTimer = window.setTimeout(() => {
        idlePoseTimer = null;
        if (cancelled || gazeMode !== "idle") return;
        if (document.visibilityState !== "visible") return;
        if (expressionMode !== "none") {
          scheduleIdlePose(
            LIVE2D_IDLE_POSE_RETRY_MIN_MS,
            LIVE2D_IDLE_POSE_RETRY_MAX_MS,
          );
          return;
        }
        const hold =
          LIVE2D_IDLE_POSE_HOLD_MIN_MS +
          Math.random() *
            Math.max(
              0,
              LIVE2D_IDLE_POSE_HOLD_MAX_MS - LIVE2D_IDLE_POSE_HOLD_MIN_MS,
            );
        startExpression(LIVE2D_IDLE_POSE, hold, "idle-pose");
      }, delay);
    }

    function enterIdle() {
      if (cancelled || gazeMode === "idle") return;
      gazeMode = "idle";
      const step = createIdleGaze(performance.now(), targetX, targetY);
      idleGazeState = step.state;
      targetX = step.x;
      targetY = step.y;
      scheduleIdlePose(
        LIVE2D_IDLE_POSE_FIRST_MIN_MS,
        LIVE2D_IDLE_POSE_FIRST_MAX_MS,
      );
    }

    function leaveIdle() {
      if (gazeMode === "follow") return;
      gazeMode = "follow";
      idleGazeState = null;
      if (idlePoseTimer) {
        window.clearTimeout(idlePoseTimer);
        idlePoseTimer = null;
      }
    }

    const start = async () => {
      setStatus("loading");
      try {
        await loadCubismCore();
        if (cancelled) return;

        const PIXI = await import("pixi.js");
        if (cancelled) return;
        const LIVE2D = await import("untitled-pixi-live2d-engine/cubism");
        if (cancelled) return;

        if (!pluginRegistered) {
          PIXI.extensions.add(LIVE2D.Live2DPlugin);
          pluginRegistered = true;
        }
        if (!cubismConfigured) {
          LIVE2D.configureCubismSDK({ memorySizeMB: 32 });
          cubismConfigured = true;
        }

        const pixiApp = new PIXI.Application();
        app = pixiApp;
        await pixiApp.init({
          resizeTo: mount,
          backgroundAlpha: 0,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          preference: "webgl",
          antialias: true,
        });
        if (cancelled) {
          pixiApp.destroy(true);
          return;
        }

        const canvas = pixiApp.canvas as HTMLCanvasElement;
        mount.appendChild(canvas);
        canvas.style.touchAction = "pan-y";
        canvas.setAttribute("aria-hidden", "true");
        pixiApp.ticker.maxFPS = window.matchMedia("(max-width: 760px)").matches ? 30 : 60;

        const renderer = pixiApp.renderer as unknown as {
          gl?: WebGL2RenderingContext | WebGLRenderingContext;
        };
        const maxTextureSize = renderer.gl
          ? renderer.gl.getParameter(renderer.gl.MAX_TEXTURE_SIZE)
          : 4096;
        const modelPath =
          maxTextureSize >= 8192 ? LIVE2D_MODEL_PATH : LIVE2D_MODEL_PATH_FALLBACK;

        const live2dModel = await LIVE2D.Live2DModel.from(modelPath, {
          autoFocus: false,
          autoHitTest: false,
          anchorMode: "drawable",
          textureOptions: { lod: "full" },
        });
        model = live2dModel;
        if (cancelled) {
          live2dModel.destroy();
          pixiApp.destroy(true);
          return;
        }

        pixiApp.stage.addChild(live2dModel);
        fitModel();
        setStatus("ready");

        const core = live2dModel.internalModel.coreModel as unknown as ParameterCore;
        const idHeadX = getParameterId(live2dModel, "Param85");
        const idHeadY = getParameterId(live2dModel, "Param86");
        const idHeadZ = getParameterId(live2dModel, "Param87");
        const idEyeX = getParameterId(live2dModel, "ParamEyeBallX");
        const idEyeY = getParameterId(live2dModel, "ParamEyeBallY");

        const updateHeadAnchor = () => {
          if (!model) return;
          const rect = canvas.getBoundingClientRect();
          const bounds = model.getBounds();
          headAnchorRef.current = {
            x: rect.left + bounds.x + bounds.width / 2,
            y: rect.top + bounds.y + bounds.height * 0.12,
          };
          if (gazeMode === "follow") updateGaze();
        };

        updateHeadAnchor();

        pixiApp.ticker.add((ticker) => {
          const now = performance.now();
          if (gazeMode === "follow") {
            if (pointerRef.current) {
              if (now - lastPointerAt > LIVE2D_IDLE_STILL_MS) enterIdle();
            } else if (now - pointerLeftAt > LIVE2D_IDLE_LEAVE_MS) {
              enterIdle();
            }
          }
          if (gazeMode === "idle" && idleGazeState) {
            const step = advanceIdleGaze(idleGazeState, now);
            idleGazeState = step.state;
            targetX = step.x;
            targetY = step.y;
          }

          const delta = Math.min(ticker.deltaMS, 50);
          const ease = 1 - Math.exp(-delta / 140);
          smoothX += (targetX - smoothX) * ease;
          smoothY += (targetY - smoothY) * ease;
          core.setParameterValueById(idHeadX, smoothX * 28);
          core.setParameterValueById(idHeadY, smoothY * -24);
          core.setParameterValueById(idHeadZ, smoothX * 6);
          core.setParameterValueById(idEyeX, smoothX * 0.8);
          core.setParameterValueById(idEyeY, smoothY * -0.8);
        });

        const onPointerMove = (event: PointerEvent) => {
          pointerRef.current = { x: event.clientX, y: event.clientY };
          lastPointerAt = performance.now();
          if (gazeMode === "idle") leaveIdle();
          updateGaze();
        };
        const resetPointer = () => {
          pointerRef.current = null;
          pointerLeftAt = performance.now();
        };
        window.addEventListener("pointermove", onPointerMove, { passive: true });
        window.addEventListener("blur", resetPointer);
        document.addEventListener("pointerleave", resetPointer);
        removePointer = () => {
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("blur", resetPointer);
          document.removeEventListener("pointerleave", resetPointer);
        };

        const react = () => {
          if (cancelled || !model) return;
          if (idlePoseTimer) {
            window.clearTimeout(idlePoseTimer);
            idlePoseTimer = null;
          }
          const expression = pick(LIVE2D_CLICK_EXPRESSIONS);
          showBubble(LIVE2D_EXPRESSION_LINES[expression] ?? pick(LIVE2D_TAP_LINES));
          startExpression(expression, LIVE2D_CLICK_HOLD_MS, "click");
          scheduleIdleSpeech();
        };

        const startDrag = (event: PointerEvent) => {
          const wrapper = wrapperRef.current;
          if (!wrapper) return;
          const rect = wrapper.getBoundingClientRect();
          const startLeft = rect.left;
          const startTop = rect.top;
          const startX = event.clientX;
          const startY = event.clientY;
          const maxLeft = Math.max(0, window.innerWidth - rect.width);
          const maxTop = Math.max(
            LIVE2D_MIN_TOP_PX,
            window.innerHeight - rect.height / 3,
          );
          let latest: StoredPosition = { left: startLeft, top: startTop };
          let moved = false;

          setSettingsOpen(false);

          const onMove = (moveEvent: PointerEvent) => {
            if (moveEvent.pointerId !== event.pointerId) return;
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            if (!moved && Math.abs(dx) + Math.abs(dy) < 2) return;
            moved = true;
            const left = clamp(startLeft + dx, 0, maxLeft);
            const top = clamp(startTop + dy, LIVE2D_MIN_TOP_PX, maxTop);
            latest = { left, top };
            setPosition({ left, top });
            window.requestAnimationFrame(() => {
              if (!cancelled) updateHeadAnchor();
            });
          };

          const finish = (finishEvent: PointerEvent) => {
            if (finishEvent.pointerId !== event.pointerId) return;
            canvas.removeEventListener("pointermove", onMove);
            canvas.removeEventListener("pointerup", finish);
            canvas.removeEventListener("pointercancel", finish);
            try {
              canvas.releasePointerCapture(event.pointerId);
            } catch {
              // The pointer may already be released.
            }
            if (moved) persistPosition(latest);
          };

          try {
            canvas.setPointerCapture(event.pointerId);
          } catch {
            // Pointer capture is best-effort.
          }
          canvas.addEventListener("pointermove", onMove);
          canvas.addEventListener("pointerup", finish);
          canvas.addEventListener("pointercancel", finish);
        };

        const noteInteraction = (event: PointerEvent) => {
          pointerRef.current = { x: event.clientX, y: event.clientY };
          lastPointerAt = performance.now();
          if (gazeMode === "idle") leaveIdle();
          updateGaze();
        };
        const onCanvasPointerDown = (event: PointerEvent) => {
          noteInteraction(event);
          if (event.pointerType === "mouse" && event.button === 1) {
            event.preventDefault();
            startDrag(event);
            return;
          }
          if (event.pointerType === "mouse" && event.button !== 0) return;
          react();
        };
        canvas.addEventListener("pointerdown", onCanvasPointerDown);
        removeCanvasPointer = () => canvas.removeEventListener("pointerdown", onCanvasPointerDown);

        const onMouseDown = (event: MouseEvent) => {
          if (event.button === 1) event.preventDefault();
        };
        const onAuxClick = (event: MouseEvent) => {
          if (event.button === 1) event.preventDefault();
        };
        canvas.addEventListener("mousedown", onMouseDown);
        canvas.addEventListener("auxclick", onAuxClick);
        removeCanvasMouse = () => {
          canvas.removeEventListener("mousedown", onMouseDown);
          canvas.removeEventListener("auxclick", onAuxClick);
        };

        const onVisibility = () => {
          if (!app) return;
          if (document.hidden) {
            app.ticker.stop();
            return;
          }
          app.ticker.start();
          if (
            gazeMode === "idle" &&
            !idlePoseTimer &&
            expressionMode === "none"
          ) {
            scheduleIdlePose(
              LIVE2D_IDLE_POSE_FIRST_MIN_MS,
              LIVE2D_IDLE_POSE_FIRST_MAX_MS,
            );
          }
        };
        document.addEventListener("visibilitychange", onVisibility);
        removeVisibility = () => document.removeEventListener("visibilitychange", onVisibility);

        const onWheel = (event: WheelEvent) => {
          const scrollTarget = document.querySelector<HTMLElement>(".real-home, .home-scroll-shell");
          if (scrollTarget && scrollTarget.scrollHeight > scrollTarget.clientHeight) {
            scrollTarget.scrollBy({ top: event.deltaY });
            event.preventDefault();
            return;
          }
          if (document.scrollingElement) {
            document.scrollingElement.scrollBy({ top: event.deltaY });
            event.preventDefault();
          }
        };
        mount.addEventListener("wheel", onWheel, { passive: false });
        removeWheel = () => mount.removeEventListener("wheel", onWheel);

        const onWindowResize = () => {
          window.requestAnimationFrame(() => {
            if (!cancelled) updateHeadAnchor();
          });
        };
        window.addEventListener("resize", onWindowResize);
        removeWindowResize = () => window.removeEventListener("resize", onWindowResize);

        resizeObserver = new ResizeObserver(() => {
          if (!app) return;
          app.resize();
          fitModel();
          updateHeadAnchor();
        });
        resizeObserver.observe(mount);

        scheduleIdleSpeech();
        greetingTimer = window.setTimeout(() => {
          if (cancelled) return;
          if (!window.sessionStorage.getItem(LIVE2D_SESSION_KEY)) {
            window.sessionStorage.setItem(LIVE2D_SESSION_KEY, "1");
            showBubble(pick(LIVE2D_GREETINGS), 7200);
          }
        }, 900);
      } catch (error) {
        console.error("[live2d] failed to start", error);
        if (!cancelled) setStatus("error");
      }
    };

    startTimer = window.setTimeout(() => {
      void start();
    }, 900);

    return () => {
      cancelled = true;
      if (startTimer) window.clearTimeout(startTimer);
      if (idleSpeechTimer) window.clearTimeout(idleSpeechTimer);
      if (idlePoseTimer) window.clearTimeout(idlePoseTimer);
      if (expressionTimer) window.clearTimeout(expressionTimer);
      if (greetingTimer) window.clearTimeout(greetingTimer);
      removePointer?.();
      removeVisibility?.();
      removeWheel?.();
      removeCanvasPointer?.();
      removeCanvasMouse?.();
      removeWindowResize?.();
      resizeObserver?.disconnect();
      if (model) {
        safeDestroy(() => model?.destroy());
        model = null;
      }
      if (app) {
        safeDestroy(() => app?.destroy(true, { children: true }));
        app = null;
      }
      setStatus("idle");
      clearBubble();
    };
  }, [enabled, showBubble, clearBubble, persistPosition]);

  useEffect(() => {
    return () => {
      if (bubbleTimerRef.current) window.clearTimeout(bubbleTimerRef.current);
    };
  }, []);

  const onStageContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (passthrough) return;
    event.preventDefault();
    openSettingsAt(event.clientX, event.clientY);
  };

  const toggleSettingsFromGear = () => {
    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }
    const rect = gearRef.current?.getBoundingClientRect();
    if (!rect) return;
    openSettingsAt(Math.max(12, rect.left - 316), Math.max(12, rect.top - 8));
  };

  return (
    <>
      {initialized && enabled && layout ? (
        <div
          ref={wrapperRef}
          className={styles.companion}
          style={{
            left: layout.left,
            top: layout.top,
            width: layout.width,
            height: layout.height,
          }}
        >
          {bubble ? (
            <p className={styles.bubble} role="status" aria-live="polite">
              {bubble}
            </p>
          ) : null}
          <div
            ref={mountRef}
            className={`${styles.stage}${passthrough ? ` ${styles.stagePassthrough}` : ""}`}
            onContextMenu={onStageContextMenu}
          >
            {status === "loading" ? <span className={styles.loading}>加载中</span> : null}
            {status === "error" ? <span className={styles.error}>希罗加载失败</span> : null}
          </div>
          <div className={styles.controls}>
            <button
              type="button"
              className={styles.passthroughToggle}
              aria-pressed={passthrough}
              aria-label="鼠标穿透"
              title="鼠标穿透"
              onClick={togglePassthrough}
            >
              <span className={styles.passthroughDot} aria-hidden="true" />
              鼠标穿透
            </button>
            <button
              ref={gearRef}
              type="button"
              className={`appearance-trigger ${styles.settingsButton}`}
              aria-label="希罗设置"
              aria-expanded={settingsOpen}
              title="希罗设置"
              onClick={toggleSettingsFromGear}
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      ) : null}
      {initialized && !enabled ? (
        <button
          type="button"
          className={styles.showButton}
          onClick={showCompanion}
          aria-label="显示希罗"
        >
          希罗
        </button>
      ) : null}
      {settingsOpen ? (
        <Live2DSettingsPanel
          anchor={settingsAnchor}
          viewport={viewport}
          enabled={enabled}
          scale={scale}
          ignoreRef={gearRef}
          onClose={closeSettings}
          onToggleEnabled={toggleEnabled}
          onScaleChange={changeScale}
        />
      ) : null}
    </>
  );
}
