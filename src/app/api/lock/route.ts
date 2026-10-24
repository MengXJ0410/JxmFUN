import { NextResponse } from "next/server";
import { GATE_COOKIE_NAME } from "@/lib/gate/constants";
import { isSecureRequest } from "@/lib/gate/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  response.cookies.set({
    name: GATE_COOKIE_NAME,
    value: "",
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    path: "/",
  });
  return response;
}
