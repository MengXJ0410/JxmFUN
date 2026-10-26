import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { isUnlocked } from "@/lib/gate/server";
import type { MonitorSnapshot } from "@/lib/monitor/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONITOR_FILE = join(process.cwd(), ".runtime", "monitor.json");
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  if (!(await isUnlocked())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  try {
    const raw = await readFile(MONITOR_FILE, "utf8");
    const data = JSON.parse(raw) as MonitorSnapshot;
    if (!data || typeof data.updatedAt !== "number" || !data.host || !data.docker) {
      throw new Error("Invalid monitor snapshot");
    }
    return NextResponse.json({
      ok: true,
      data,
      stale: Date.now() - data.updatedAt > 15_000,
    }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({
      error: "监控数据尚未生成，请等待 mxjmonitor 启动。",
    }, { status: 503, headers: NO_STORE });
  }
}
