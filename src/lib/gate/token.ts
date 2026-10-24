import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const UNCONFIGURED_SECRET = "mxj-gate-unconfigured-v1";
const SESSION_TOKEN_MESSAGE = "mxj-gate-session-v1";

let warnedMissingKey = false;

export function getSiteAccessKey() {
  const key = process.env.SITE_ACCESS_KEY;
  if (key && key.length > 0) return key;
  if (!warnedMissingKey) {
    warnedMissingKey = true;
    console.warn("[gate] SITE_ACCESS_KEY is not set; any key will unlock the gate.");
  }
  return null;
}

export function isAccessKeyMatch(input: string, key: string) {
  return safeEqual(sha256(input), sha256(key));
}

export function createGateToken() {
  const key = getSiteAccessKey() ?? UNCONFIGURED_SECRET;
  return createHmac("sha256", key).update(SESSION_TOKEN_MESSAGE).digest("hex");
}

export function isGateTokenValid(token: string | undefined) {
  if (!token) return false;
  return safeEqual(token, createGateToken());
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

function safeEqual(left: string | Buffer, right: string | Buffer) {
  const leftBuffer = typeof left === "string" ? Buffer.from(left, "utf8") : left;
  const rightBuffer = typeof right === "string" ? Buffer.from(right, "utf8") : right;
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}
