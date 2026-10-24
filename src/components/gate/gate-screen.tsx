"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Eye, EyeOff } from "lucide-react";
import { GATE_COPY, GATE_TIMING } from "@/content/gate";
import { GATE_KEY_STORAGE_KEY, GATE_LOCK_STORAGE_KEY } from "@/lib/gate/constants";
import { MatrixRain } from "@/components/gate/matrix-rain";
import styles from "./gate.module.css";

type Phase = "boot" | "auth" | "verifying" | "granted";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(callback: () => void) {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

function readStoredLockUntil() {
  if (typeof window === "undefined") return 0;
  const stored = Number(window.sessionStorage.getItem(GATE_LOCK_STORAGE_KEY));
  return Number.isFinite(stored) && stored > Date.now() ? stored : 0;
}

function getInitialNow() {
  return typeof window === "undefined" ? 0 : Date.now();
}

function readStoredKey() {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(GATE_KEY_STORAGE_KEY) ?? "";
}

type UnlockResponse = {
  ok?: boolean;
  unconfigured?: boolean;
  code?: string;
  retryAfter?: number;
};

type GateScreenProps = {
  onUnlocked: () => void;
  leaving: boolean;
};

export function GateScreen({ onUnlocked, leaving }: GateScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const bootStartedRef = useRef(0);
  const unmountedRef = useRef(false);
  const grantTimerRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("boot");
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [typingDone, setTypingDone] = useState(false);
  const reduceMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, getReducedMotionServerSnapshot);
  const [keyValue, setKeyValue] = useState(readStoredKey);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [lockedUntil, setLockedUntil] = useState(readStoredLockUntil);
  const [now, setNow] = useState(getInitialNow);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lines = GATE_COPY.bootLines;
    bootStartedRef.current = performance.now();

    if (reduced) {
      const timer = window.setTimeout(() => {
        setVisibleLines([...lines]);
        setTypingDone(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let lineIndex = 0;
    let charIndex = 0;
    let timer = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      if (lineIndex >= lines.length) {
        setTypingDone(true);
        return;
      }

      const line = lines[lineIndex] ?? "";
      charIndex += 1;
      setVisibleLines((current) => {
        const next = [...current];
        next[lineIndex] = line.slice(0, charIndex);
        return next;
      });

      if (charIndex >= line.length) {
        lineIndex += 1;
        charIndex = 0;
        if (lineIndex >= lines.length) {
          setTypingDone(true);
          return;
        }
        timer = window.setTimeout(tick, GATE_TIMING.linePauseMs);
        return;
      }

      timer = window.setTimeout(tick, GATE_TIMING.typeSpeedMs);
    };

    timer = window.setTimeout(tick, GATE_TIMING.initialDelayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!typingDone || phase !== "boot") return;
    const elapsed = performance.now() - bootStartedRef.current;
    const remaining = Math.max(0, GATE_TIMING.minBootMs - elapsed);
    const timer = window.setTimeout(() => setPhase("auth"), remaining);
    return () => window.clearTimeout(timer);
  }, [phase, typingDone]);

  useEffect(() => {
    if (!lockedUntil) return;
    const update = () => {
      const current = Date.now();
      if (current >= lockedUntil) {
        setLockedUntil(0);
        setNow(0);
        window.sessionStorage.removeItem(GATE_LOCK_STORAGE_KEY);
        setStatus(GATE_COPY.lockExpired);
        return;
      }
      setNow(current);
    };
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      window.clearTimeout(grantTimerRef.current);
    };
  }, []);

  const remainingSeconds = lockedUntil > 0 && now > 0 ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;
  const lockCountdown = `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`;
  const isLocked = remainingSeconds > 0;
  const inputDisabled = phase !== "auth" || isLocked;
  const submitDisabled = phase !== "auth" || isLocked;
  const warningText = isLocked ? `${GATE_COPY.locked} ${GATE_COPY.lockCountdown} ${lockCountdown}` : error;

  const grantAccess = (delay: number) => {
    window.clearTimeout(grantTimerRef.current);
    grantTimerRef.current = window.setTimeout(() => {
      if (!unmountedRef.current) onUnlocked();
    }, delay);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inputDisabled || phase !== "auth" || composingRef.current) return;

    setPhase("verifying");
    setError("");
    setStatus(GATE_COPY.verifying);

    try {
      const response = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: keyValue }),
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as UnlockResponse | null;

      if (response.ok) {
        if (!data?.unconfigured && keyValue) {
          window.sessionStorage.setItem(GATE_KEY_STORAGE_KEY, keyValue);
        } else {
          window.sessionStorage.removeItem(GATE_KEY_STORAGE_KEY);
        }
        setStatus(data?.unconfigured ? GATE_COPY.unconfigured : GATE_COPY.granted);
        setPhase("granted");
        grantAccess(data?.unconfigured ? GATE_TIMING.unconfiguredHoldMs : GATE_TIMING.grantedHoldMs);
        return;
      }

      if (response.status === 429) {
        const retryAfter = typeof data?.retryAfter === "number" ? data.retryAfter : 300;
        const until = Date.now() + retryAfter * 1000;
        setLockedUntil(until);
        setNow(Date.now());
        window.sessionStorage.setItem(GATE_LOCK_STORAGE_KEY, String(until));
        setStatus("");
        setError("");
        setPhase("auth");
        return;
      }

      setPhase("auth");
      setStatus("");
      setError(response.status === 401 ? GATE_COPY.invalid : GATE_COPY.requestError);
    } catch {
      setPhase("auth");
      setStatus("");
      setError(GATE_COPY.networkError);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && composingRef.current) event.preventDefault();
  };

  return (
    <div
      className={`${styles.screen} ${leaving ? styles.screenLeaving : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={GATE_COPY.gateLabel}
      aria-busy={phase === "verifying"}
      aria-hidden={leaving || undefined}
    >
      <div className={styles.aurora} aria-hidden="true" />
      <MatrixRain reduceMotion={reduceMotion} />
      <div className={styles.vignette} aria-hidden="true" />

      <div className={styles.terminal} aria-label={GATE_COPY.terminalLabel}>
        <div className={styles.titleBar}>
          <span className={styles.dots} aria-hidden="true"><i /><i /><i /></span>
          <span className={styles.title}>{GATE_COPY.title}</span>
          <span className={styles.subtitle}>{GATE_COPY.subtitle}</span>
        </div>

        <div className={styles.body}>
          <div className={styles.boot} aria-label={GATE_COPY.bootAriaLabel}>
            {visibleLines.map((line, index) => (
              <p key={index} className={styles.line}>{line || "\u00a0"}</p>
            ))}
            {phase === "boot" ? <span className={styles.cursor} aria-hidden="true">{"\u258c"}</span> : null}
          </div>

          {phase !== "boot" ? (
            <div className={styles.auth}>
              <p className={styles.prompt}>{GATE_COPY.prompt}</p>
              <form className={styles.form} onSubmit={handleSubmit}>
                <span className={styles.promptMark} aria-hidden="true">&gt;</span>
                <div className={styles.inputWrap}>
                  <input
                    ref={inputRef}
                    className={styles.input}
                    type={showKey ? "text" : "password"}
                    value={keyValue}
                    onChange={(event) => setKeyValue(event.target.value)}
                    onKeyDown={handleKeyDown}
                    onCompositionStart={() => { composingRef.current = true; }}
                    onCompositionEnd={() => { composingRef.current = false; }}
                    placeholder={GATE_COPY.inputPlaceholder}
                    aria-label={GATE_COPY.inputAriaLabel}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    disabled={inputDisabled}
                  />
                  <button
                    className={styles.eye}
                    type="button"
                    onClick={() => setShowKey((current) => !current)}
                    aria-label={showKey ? GATE_COPY.hideKey : GATE_COPY.showKey}
                    aria-pressed={showKey}
                    tabIndex={inputDisabled ? -1 : 0}
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button
                  className={styles.submit}
                  type="submit"
                  disabled={submitDisabled}
                  aria-label={GATE_COPY.submitAriaLabel}
                >
                  {phase === "verifying" ? "..." : GATE_COPY.submitLabel}
                </button>
              </form>

              {warningText ? <p className={styles.warning} role="alert">{warningText}</p> : null}
              {status ? <p className={styles.status} aria-live="polite">{status}</p> : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className={styles.scanlines} aria-hidden="true" />
      {phase === "granted" ? <div className={styles.glitch} aria-hidden="true" /> : null}
      {leaving ? (
        <div className={styles.exitCurtain} aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => <span key={index} />)}
        </div>
      ) : null}
      <noscript><p className={styles.noscript}>{GATE_COPY.noscript}</p></noscript>
    </div>
  );
}
