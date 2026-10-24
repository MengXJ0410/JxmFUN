import { NextResponse } from "next/server";
import { GATE_COOKIE_NAME } from "@/lib/gate/constants";
import { clearFailures, getLockState, registerFailure } from "@/lib/gate/rate-limit";
import { getClientIp, isSecureRequest } from "@/lib/gate/server";
import { createGateToken, getSiteAccessKey, isAccessKeyMatch } from "@/lib/gate/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const configuredKey = getSiteAccessKey();

  if (!configuredKey) {
    const response = NextResponse.json({ ok: true, unconfigured: true }, { headers: NO_STORE });
    setGateCookie(response, request);
    return response;
  }

  const lock = getLockState(ip);
  if (lock.locked) return lockedResponse(lock.retryAfter);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400, headers: NO_STORE });
  }

  const input = readKey(payload);
  if (input === null) {
    return NextResponse.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400, headers: NO_STORE });
  }

  if (!isAccessKeyMatch(input, configuredKey)) {
    const failure = registerFailure(ip);
    if (failure.locked) return lockedResponse(failure.retryAfter);
    return NextResponse.json({ ok: false, code: "INVALID_KEY" }, { status: 401, headers: NO_STORE });
  }

  clearFailures(ip);
  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  setGateCookie(response, request);
  return response;
}

function readKey(payload: unknown) {
  if (typeof payload !== "object" || payload === null || !("key" in payload)) return null;
  const key = (payload as { key?: unknown }).key;
  return typeof key === "string" ? key : null;
}

function setGateCookie(response: NextResponse, request: Request) {
  response.cookies.set({
    name: GATE_COOKIE_NAME,
    value: createGateToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    path: "/",
  });
}

function lockedResponse(retryAfter: number) {
  return NextResponse.json(
    { ok: false, code: "LOCKED", retryAfter },
    { status: 429, headers: { ...NO_STORE, "Retry-After": String(retryAfter) } },
  );
}
