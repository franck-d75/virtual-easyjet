import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

type DesktopDiagnosticLevel = "info" | "warn" | "error";

const DIAGNOSTIC_APP_FOLDER = "Virtual Easyjet ACARS";
const DIAGNOSTIC_LOG_FOLDER = "logs";
const DIAGNOSTIC_LOG_FILENAME = "acars.log";

let ensuredLogDirectory = false;

export function getDesktopDiagnosticsLogPath(): string {
  const appDataDirectory =
    process.env.APPDATA?.trim() ||
    path.join(homedir(), "AppData", "Roaming");

  return path.join(
    appDataDirectory,
    DIAGNOSTIC_APP_FOLDER,
    DIAGNOSTIC_LOG_FOLDER,
    DIAGNOSTIC_LOG_FILENAME,
  );
}

export function appendDesktopDiagnostic(
  scope: string,
  level: DesktopDiagnosticLevel,
  message: string,
  details?: Record<string, unknown>,
): void {
  const logPath = getDesktopDiagnosticsLogPath();

  try {
    if (!ensuredLogDirectory) {
      mkdirSync(path.dirname(logPath), { recursive: true });
      ensuredLogDirectory = true;
    }

    const timestamp = new Date().toISOString();
    const serializedDetails =
      details && Object.keys(details).length > 0
        ? ` ${safeSerialize(details)}`
        : "";

    appendFileSync(
      logPath,
      `[${timestamp}] [${scope}] [${level.toUpperCase()}] ${message}${serializedDetails}\n`,
      "utf8",
    );
  } catch (error) {
    console.error("[desktop-diagnostics] failed to append log", {
      logPath,
      scope,
      level,
      message,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function safeSerialize(value: Record<string, unknown>): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "{\"error\":\"details_serialization_failed\"}";
  }
}
