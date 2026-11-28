import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Liveness for deploy/load balancers — keep cheap and dependency-free. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "vorood",
    ts: new Date().toISOString(),
  });
}
