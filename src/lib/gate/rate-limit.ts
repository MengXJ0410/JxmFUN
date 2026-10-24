import { GATE_LOCKOUT_MS, GATE_MAX_ATTEMPTS } from "@/lib/gate/constants";

type AttemptState = {
  failures: number;
  lockedUntil: number;
};

export type LockState = { locked: false } | { locked: true; retryAfter: number };

const attempts = new Map<string, AttemptState>();

export function getLockState(ip: string, now = Date.now()): LockState {
  const state = attempts.get(ip);
  if (!state) return { locked: false };
  if (state.lockedUntil > now) {
    return { locked: true, retryAfter: Math.max(1, Math.ceil((state.lockedUntil - now) / 1000)) };
  }
  if (state.lockedUntil > 0) attempts.delete(ip);
  return { locked: false };
}

export function registerFailure(ip: string, now = Date.now()): LockState {
  const current = getLockState(ip, now);
  if (current.locked) return current;

  const state = attempts.get(ip) ?? { failures: 0, lockedUntil: 0 };
  state.failures += 1;

  if (state.failures >= GATE_MAX_ATTEMPTS) {
    state.failures = 0;
    state.lockedUntil = now + GATE_LOCKOUT_MS;
    attempts.set(ip, state);
    cleanup(now);
    return { locked: true, retryAfter: Math.ceil(GATE_LOCKOUT_MS / 1000) };
  }

  attempts.set(ip, state);
  return { locked: false };
}

export function clearFailures(ip: string) {
  attempts.delete(ip);
}

function cleanup(now: number) {
  if (attempts.size < 512) return;
  for (const [ip, state] of attempts) {
    if (state.lockedUntil > 0 && state.lockedUntil <= now) attempts.delete(ip);
  }
}
