import { NextResponse } from "next/server";

const NEW_DOWNLOAD_PATH = "/api/acars/download";

export function GET(request: Request) {
  return NextResponse.redirect(new URL(NEW_DOWNLOAD_PATH, request.url));
}
