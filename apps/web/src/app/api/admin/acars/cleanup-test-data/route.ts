import { NextResponse } from "next/server";

import { cleanupAdminAcarsTestData } from "@/lib/api/admin";
import {
  createBackendErrorResponse,
  createBackendJsonResponse,
  executeWithBackendAccess,
} from "@/lib/auth/backend-access";
import { logWebError } from "@/lib/observability/log";

export async function POST() {
  try {
    const result = await executeWithBackendAccess((accessToken) =>
      cleanupAdminAcarsTestData(accessToken),
    );

    return createBackendJsonResponse(result.data, result.refreshedSession, 200);
  } catch (error) {
    logWebError("admin acars cleanup failed", error);
    return createBackendErrorResponse(error);
  }
}
