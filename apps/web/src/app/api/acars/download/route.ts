import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";
import { resolveAcarsDownloadTarget } from "@/lib/acars/download";

export async function GET() {
  const target = resolveAcarsDownloadTarget();

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

  const installerBuffer = await readFile(target.filePath);

  return new NextResponse(new Uint8Array(installerBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.microsoft.portable-executable",
      "Content-Disposition": `attachment; filename="${target.fileName}"`,
      "Cache-Control": "public, max-age=300",
      "Content-Length": String(installerBuffer.byteLength),
    },
  });
}
