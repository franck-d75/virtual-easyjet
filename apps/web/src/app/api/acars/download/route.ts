import { NextResponse } from "next/server";
import {
  type AcarsDownloadVariant,
  resolveAcarsDownloadTarget,
} from "@/lib/acars/download";

function parseDownloadVariant(request: Request): AcarsDownloadVariant {
  const requestedVariant = new URL(request.url).searchParams.get("variant");

  return requestedVariant === "portable" ? "portable" : "installer";
}

export async function GET(request: Request) {
  const target = resolveAcarsDownloadTarget(parseDownloadVariant(request));

  if (target.status === "redirect") {
    return NextResponse.redirect(target.downloadUrl, 307);
  }

  if (target.status === "missing") {
    return NextResponse.json(
      {
        error: target.message,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return NextResponse.json(
    {
      error: "ACARS download is not available.",
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
