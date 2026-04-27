import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { getAcarsCurrentVersion } from "@/lib/config/env";

export type AcarsDownloadTarget =
  | {
      status: "redirect";
      source: "configured-url";
      fileName: string;
      downloadUrl: string;
      version: string;
    }
  | {
      status: "local";
      source: "local-build";
      fileName: string;
      filePath: string;
      version: string;
    }
  | {
      status: "missing";
      source: "missing";
      fileName: null;
      version: string;
      message: string;
    };

const INSTALLER_FILE_PREFIX = "Virtual-Easyjet-ACARS-Setup-";

function getCandidateDirectories(): string[] {
  return [
    join(process.cwd(), "public", "downloads"),
    join(process.cwd(), "..", "acars-desktop", "release"),
  ];
}

function getConfiguredDownloadUrl(): string | null {
  const value =
    process.env.ACARS_DOWNLOAD_URL?.trim() ||
    process.env.NEXT_PUBLIC_ACARS_DOWNLOAD_URL?.trim() ||
    "";

  if (!value || !/^https?:\/\//i.test(value)) {
    return null;
  }

  return value;
}

function getFileNameFromUrl(downloadUrl: string): string {
  try {
    const url = new URL(downloadUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    return segments.at(-1) ?? "Virtual-Easyjet-ACARS-Setup.exe";
  } catch {
    return "Virtual-Easyjet-ACARS-Setup.exe";
  }
}

function resolveLocalInstaller(version: string): AcarsDownloadTarget | null {
  const preferredNames = [
    `${INSTALLER_FILE_PREFIX}${version}-x64.exe`,
    `${INSTALLER_FILE_PREFIX}${version}.exe`,
  ];

  for (const directory of getCandidateDirectories()) {
    for (const preferredName of preferredNames) {
      const candidatePath = join(directory, preferredName);

      if (existsSync(candidatePath)) {
        return {
          status: "local",
          source: "local-build",
          fileName: preferredName,
          filePath: candidatePath,
          version,
        };
      }
    }

    if (!existsSync(directory)) {
      continue;
    }

    const fallbackName = readdirSync(directory).find(
      (entry) =>
        entry.startsWith(INSTALLER_FILE_PREFIX) &&
        entry.endsWith(".exe") &&
        !entry.includes("Portable"),
    );

    if (fallbackName) {
      return {
        status: "local",
        source: "local-build",
        fileName: fallbackName,
        filePath: join(directory, fallbackName),
        version,
      };
    }
  }

  return null;
}

export function resolveAcarsDownloadTarget(): AcarsDownloadTarget {
  const version = getAcarsCurrentVersion();
  const configuredDownloadUrl = getConfiguredDownloadUrl();

  if (configuredDownloadUrl) {
    return {
      status: "redirect",
      source: "configured-url",
      fileName: getFileNameFromUrl(configuredDownloadUrl),
      downloadUrl: configuredDownloadUrl,
      version,
    };
  }

  const localInstaller = resolveLocalInstaller(version);

  if (localInstaller) {
    return localInstaller;
  }

  return {
    status: "missing",
    source: "missing",
    fileName: null,
    version,
    message:
      "Aucun installateur ACARS Windows n'est disponible pour le moment. Générez un build avec pnpm --filter @va/acars package ou publiez ACARS_DOWNLOAD_URL.",
  };
}
