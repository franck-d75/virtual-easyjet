import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

function loadEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }

  return parseEnvFile(readFileSync(filePath, "utf8"));
}

export function loadRootEnvironment(): Record<string, string | undefined> {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = findWorkspaceRoot(moduleDirectory);

  return {
    ...loadEnvFile(resolve(workspaceRoot, ".env")),
    ...loadEnvFile(resolve(workspaceRoot, ".env.local")),
    ...process.env,
  };
}
