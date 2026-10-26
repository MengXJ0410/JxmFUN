import { NextResponse } from "next/server";
import {
  deleteBackgroundFile,
  getBackgroundState,
  removeBackgroundEntry,
  syncBackgroundConfig,
  updateBackgroundEntry,
} from "@/lib/backgrounds/admin";
import type { BackgroundMutation } from "@/lib/backgrounds/types";
import { isUnlocked } from "@/lib/gate/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }
  try {
    return NextResponse.json({ ok: true, state: getBackgroundState() }, { headers: NO_STORE });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  let body: BackgroundMutation;
  try {
    body = (await request.json()) as BackgroundMutation;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: NO_STORE });
  }

  try {
    if (body.action === "sync") {
      const result = syncBackgroundConfig(body.prune === true);
      return NextResponse.json({ ok: true, ...result }, { headers: NO_STORE });
    }
    if (body.action === "update") {
      const state = updateBackgroundEntry(body.file, { theme: body.theme, platform: body.platform, frame: body.frame });
      return NextResponse.json({ ok: true, state }, { headers: NO_STORE });
    }
    if (body.action === "remove") {
      const state = removeBackgroundEntry(body.file);
      return NextResponse.json({ ok: true, state }, { headers: NO_STORE });
    }
    if (body.action === "delete") {
      const state = deleteBackgroundFile(body.file);
      return NextResponse.json({ ok: true, state }, { headers: NO_STORE });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400, headers: NO_STORE });
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Background operation failed";
  return NextResponse.json({ error: message }, { status: 400, headers: NO_STORE });
}
