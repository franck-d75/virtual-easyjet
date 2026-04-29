"use client";

export type BrowserDiagnosticLevel = "info" | "warn" | "error";

export interface BrowserDiagnosticEntry {
  id: string;
  at: string;
  level: BrowserDiagnosticLevel;
  event: string;
  path: string | null;
  details?: Record<string, unknown>;
}

const STORAGE_KEY = "vej:browser-diagnostics";
const MAX_ENTRIES = 400;
const INSTALL_FLAG = "__vejBrowserDiagnosticsInstalled";
const FETCH_FLAG = "__vejBrowserFetchWrapped";

type BrowserDiagnosticsWindow = Window &
  typeof globalThis & {
    [INSTALL_FLAG]?: boolean;
    [FETCH_FLAG]?: boolean;
  };

export function installBrowserDiagnostics(): void {
  if (typeof window === "undefined") {
    return;
  }

  const browserWindow = window as BrowserDiagnosticsWindow;

  if (browserWindow[INSTALL_FLAG]) {
    return;
  }

  browserWindow[INSTALL_FLAG] = true;
  logBrowserDiagnostic("browser.session.start", "info", {
    userAgent: navigator.userAgent,
    language: navigator.language,
  });

  window.addEventListener("error", (event) => {
    logBrowserDiagnostic("browser.error", "error", {
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    logBrowserDiagnostic("browser.unhandledrejection", "error", {
      reason: serializeUnknown(event.reason),
    });
  });

  window.addEventListener("online", () => {
    logBrowserDiagnostic("browser.online", "info");
  });

  window.addEventListener("offline", () => {
    logBrowserDiagnostic("browser.offline", "warn");
  });

  document.addEventListener("visibilitychange", () => {
    logBrowserDiagnostic("browser.visibility", "info", {
      visibilityState: document.visibilityState,
    });
  });

  if (!browserWindow[FETCH_FLAG]) {
    const originalFetch = window.fetch.bind(window);
    browserWindow[FETCH_FLAG] = true;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const startedAt = performance.now();
      const method = (init?.method ?? "GET").toUpperCase();
      const url = normalizeFetchUrl(input);

      logBrowserDiagnostic("fetch.start", "info", {
        method,
        url,
      });

      try {
        const response = await originalFetch(input, init);
        const durationMs = Math.round(performance.now() - startedAt);

        logBrowserDiagnostic(
          "fetch.complete",
          response.ok ? "info" : "warn",
          {
            method,
            url,
            status: response.status,
            ok: response.ok,
            durationMs,
          },
        );

        return response;
      } catch (error) {
        const durationMs = Math.round(performance.now() - startedAt);
        logBrowserDiagnostic("fetch.error", "error", {
          method,
          url,
          durationMs,
          error: serializeUnknown(error),
        });
        throw error;
      }
    };
  }
}

export function logBrowserDiagnostic(
  event: string,
  level: BrowserDiagnosticLevel,
  details?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") {
    return;
  }

  const entry: BrowserDiagnosticEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    level,
    event,
    path: window.location.pathname + window.location.search,
  };

  if (details) {
    entry.details = details;
  }

  const nextEntries = [entry, ...readBrowserDiagnostics()].slice(0, MAX_ENTRIES);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
}

export function readBrowserDiagnostics(): BrowserDiagnosticEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isBrowserDiagnosticEntry);
  } catch {
    return [];
  }
}

export function clearBrowserDiagnostics(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export function exportBrowserDiagnostics(): void {
  if (typeof window === "undefined") {
    return;
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    currentUrl: window.location.href,
    userAgent: navigator.userAgent,
    entries: readBrowserDiagnostics(),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `virtual-easyjet-browser-diagnostics-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);

  logBrowserDiagnostic("browser.diagnostics.exported", "info", {
    entryCount: payload.entries.length,
  });
}

function normalizeFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}

function isBrowserDiagnosticEntry(value: unknown): value is BrowserDiagnosticEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<BrowserDiagnosticEntry>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.at === "string" &&
    typeof candidate.level === "string" &&
    typeof candidate.event === "string"
  );
}

function serializeUnknown(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
