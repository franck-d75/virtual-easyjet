import { NextResponse } from "next/server";

const FALLBACK_PATH = "/acars?download=unavailable";

export function GET(request: Request) {
  const downloadUrl =
    process.env.ACARS_DOWNLOAD_URL?.trim() ||
    process.env.NEXT_PUBLIC_ACARS_DOWNLOAD_URL?.trim() ||
    "";

  if (downloadUrl) {
    return NextResponse.redirect(downloadUrl);
  }

  return NextResponse.redirect(new URL(FALLBACK_PATH, request.url));
}
