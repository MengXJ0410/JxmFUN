import { NextResponse } from "next/server";
import { uploadBackground } from "@/lib/backgrounds/admin";
import { isUnlocked } from "@/lib/gate/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BYTES) {
    return NextResponse.json({ error: "File is larger than 20MB" }, { status: 413, headers: NO_STORE });
  }

  try {
    const buffer = await readLimited(request);
    const result = uploadBackground(buffer);
    return NextResponse.json({ ok: true, file: result.file, state: result.state }, { headers: NO_STORE });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    const status = message.includes("20MB") ? 413 : 400;
    return NextResponse.json({ error: message }, { status, headers: NO_STORE });
  }
}
async function readLimited(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error("File is larger than 20MB");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}