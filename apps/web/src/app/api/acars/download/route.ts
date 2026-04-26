import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";

const ARCHIVE_FILENAME = "virtual-easyjet-acars-preview.zip";

export async function GET() {
  const archivePath = join(
    process.cwd(),
    "public",
    "downloads",
    ARCHIVE_FILENAME,
  );

  const archiveBuffer = await readFile(archivePath);

  return new NextResponse(new Uint8Array(archiveBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${ARCHIVE_FILENAME}"`,
      "Cache-Control": "public, max-age=300",
      "Content-Length": String(archiveBuffer.byteLength),
    },
  });
}
