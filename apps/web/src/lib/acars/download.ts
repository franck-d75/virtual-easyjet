import { getAcarsCurrentVersion } from "@/lib/config/env";

export type AcarsDownloadVariant = "installer" | "portable";

export type AcarsDownloadTarget =
  | {
      status: "redirect";
      source: "configured-url" | "github-release";
      variant: AcarsDownloadVariant;
      fileName: string;
      downloadUrl: string;
      version: string;
    }
  | {
      status: "missing";
      source: "missing";
      variant: AcarsDownloadVariant;
      fileName: null;
      version: string;
      message: string;
    };

const INSTALLER_FILE_PREFIX = "Virtual-Easyjet-ACARS-Setup-";
const PORTABLE_FILE_PREFIX = "Virtual-Easyjet-ACARS-Portable-";
const GITHUB_RELEASE_DOWNLOAD_BASE_URL =
  "https://github.com/franck-d75/virtual-easyjet/releases/download";

function getConfiguredDownloadUrl(variant: AcarsDownloadVariant): string | null {
  const value =
    variant === "portable"
      ? process.env.ACARS_PORTABLE_DOWNLOAD_URL?.trim() ||
        process.env.NEXT_PUBLIC_ACARS_PORTABLE_DOWNLOAD_URL?.trim() ||
        ""
      : process.env.ACARS_INSTALLER_DOWNLOAD_URL?.trim() ||
        process.env.NEXT_PUBLIC_ACARS_INSTALLER_DOWNLOAD_URL?.trim() ||
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

function getFilePrefix(variant: AcarsDownloadVariant): string {
  return variant === "portable" ? PORTABLE_FILE_PREFIX : INSTALLER_FILE_PREFIX;
}

function getPreferredFileNames(
  version: string,
  variant: AcarsDownloadVariant,
): string[] {
  const prefix = getFilePrefix(variant);

  return [`${prefix}${version}-x64.exe`, `${prefix}${version}.exe`];
}

function getGithubReleaseDownloadUrl(
  version: string,
  variant: AcarsDownloadVariant,
): string {
  const [fileName] = getPreferredFileNames(version, variant);

  return `${GITHUB_RELEASE_DOWNLOAD_BASE_URL}/v${version}/${fileName}`;
}

export function resolveAcarsDownloadTarget(
  variant: AcarsDownloadVariant = "installer",
): AcarsDownloadTarget {
  const version = getAcarsCurrentVersion();
  const configuredDownloadUrl = getConfiguredDownloadUrl(variant);

  if (configuredDownloadUrl) {
    return {
      status: "redirect",
      source: "configured-url",
      variant,
      fileName: getFileNameFromUrl(configuredDownloadUrl),
      downloadUrl: configuredDownloadUrl,
      version,
    };
  }

  const githubReleaseDownloadUrl = getGithubReleaseDownloadUrl(version, variant);

  return {
    status: "redirect",
    source: "github-release",
    variant,
    fileName: getFileNameFromUrl(githubReleaseDownloadUrl),
    downloadUrl: githubReleaseDownloadUrl,
    version,
  };
}

export function resolveAcarsDownloadTargets(): Record<
  AcarsDownloadVariant,
  AcarsDownloadTarget
> {
  return {
    installer: resolveAcarsDownloadTarget("installer"),
    portable: resolveAcarsDownloadTarget("portable"),
  };
}
