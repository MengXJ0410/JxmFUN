import { cookies } from "next/headers";
import { GATE_COOKIE_NAME } from "@/lib/gate/constants";
import { isGateTokenValid } from "@/lib/gate/token";

export async function isUnlocked() {
  const token = (await cookies()).get(GATE_COOKIE_NAME)?.value;
  return isGateTokenValid(token);
}

export function getClientIp(headers: Headers) {
  const cloudflareIp = headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return cloudflareIp;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "local";
}

export function isSecureRequest(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedProto) return forwardedProto === "https";
  const cfVisitor = request.headers.get("cf-visitor");
  if (cfVisitor) {
    try {
      const scheme = (JSON.parse(cfVisitor) as { scheme?: string }).scheme;
      if (scheme) return scheme === "https";
    } catch {
      // Fall through to the request URL when the header is malformed.
    }
  }
  return new URL(request.url).protocol === "https:";
}
