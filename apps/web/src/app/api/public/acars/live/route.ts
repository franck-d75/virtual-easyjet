import { NextResponse } from "next/server";

import { getBackendAcarsLiveTraffic } from "@/lib/api/public";
import { logWebError } from "@/lib/observability/log";

export async function GET() {
  try {
    const traffic = await getBackendAcarsLiveTraffic();
    return NextResponse.json(traffic, {
      status: 200,
    });
  } catch (error) {
    logWebError("public acars live proxy failed", error);
    return NextResponse.json(
      {
        message: "Le flux ACARS live n'a pas pu être chargé.",
      },
      {
        status: 502,
      },
    );
  }
}
