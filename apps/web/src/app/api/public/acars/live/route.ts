import { NextResponse } from "next/server";

import { getBackendAcarsLiveTraffic } from "@/lib/api/public";
import { logWebError } from "@/lib/observability/log";

export async function GET() {
  try {
    const traffic = await getBackendAcarsLiveTraffic();
    return NextResponse.json(traffic, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logWebError("public acars live proxy failed", error);
    return NextResponse.json([], {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Live-Map-Warning": "live-traffic-unavailable",
      },
    });
  }
}
