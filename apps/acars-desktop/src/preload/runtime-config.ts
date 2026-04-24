import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_DESKTOP_CONFIG,
  normalizeBaseUrl,
} from "../shared/defaults.js";
import type { BackendMode, DesktopConfig } from "../shared/types.js";

const WORKSPACE_MARKER = "pnpm-workspace.yaml";

function findWorkspaceRoot(startDirectory: string): string {
  let currentDirectory = startDirectory;

  while (true) {
    if (existsSync(resolve(currentDirectory, WORKSPACE_MARKER))) {
      return currentDirectory;
    }

    const parentDirectory = resolve(currentDirectory, "..");

    if (parentDirectory === currentDirectory) {
      return startDirectory;
    }

    currentDirectory = parentDirectory;
  }
}

function normalizeBackendMode(value: string | undefined): BackendMode {
  return value?.trim().toLowerCase() === "live" ? "live" : "mock";
}

function parseEnvFile(fileContents: string): Record<string, string> {
  return fileContents
    .split(/\r?\n/u)
    .reduce<Record<string, string>>((environment, rawLine) => {
      const line = rawLine.trim();

      if (line.length === 0 || line.startsWith("#")) {
        return environment;
      }

      const separatorIndex = line.indexOf("=");

      if (separatorIndex <= 0) {
        return environment;
      }

      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();

      if (!key) {
        return environment;
      }

      const hasMatchingQuotes =
        (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'"));

      environment[key] = hasMatchingQuotes
        ? rawValue.slice(1, -1)
        : rawValue;

      return environment;
    }, {});
}

function readEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }

  return parseEnvFile(readFileSync(filePath, "utf8"));
}

export function loadDesktopRuntimeConfig(): DesktopConfig {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = findWorkspaceRoot(moduleDirectory);
  const environment = {
    ...readEnvFile(resolve(workspaceRoot, ".env")),
    ...readEnvFile(resolve(workspaceRoot, ".env.local")),
    ...process.env,
  };

  const apiBaseUrl =
    normalizeBaseUrl(
      environment.DESKTOP_API_BASE_URL ??
        environment.NEXT_PUBLIC_API_BASE_URL ??
        DEFAULT_DESKTOP_CONFIG.apiBaseUrl,
    ) || DEFAULT_DESKTOP_CONFIG.apiBaseUrl;
  const acarsBaseUrl =
    normalizeBaseUrl(
      environment.DESKTOP_ACARS_BASE_URL ??
        environment.NEXT_PUBLIC_ACARS_BASE_URL ??
        DEFAULT_DESKTOP_CONFIG.acarsBaseUrl,
    ) || DEFAULT_DESKTOP_CONFIG.acarsBaseUrl;

  return {
    ...DEFAULT_DESKTOP_CONFIG,
    apiBaseUrl,
    acarsBaseUrl,
    clientVersion:
      environment.DESKTOP_CLIENT_VERSION?.trim() ||
      DEFAULT_DESKTOP_CONFIG.clientVersion,
    simulatorProvider:
      environment.DESKTOP_SIMULATOR_PROVIDER?.trim() ||
      DEFAULT_DESKTOP_CONFIG.simulatorProvider,
    backendMode: normalizeBackendMode(environment.DESKTOP_BACKEND_MODE),
  };
}
