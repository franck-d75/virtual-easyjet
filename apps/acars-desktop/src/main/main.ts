import { app, BrowserWindow, ipcMain } from "electron";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { DesktopService } from "../preload/desktop-service.js";
import {
  appendDesktopDiagnostic,
  getDesktopDiagnosticsLogPath,
} from "../shared/desktop-diagnostics.js";

const desktopService = new DesktopService();
let bridgeHandlersRegistered = false;
let simulatorBroadcastRegistered = false;

function registerDesktopBridgeHandlers(): void {
  if (bridgeHandlersRegistered) {
    return;
  }

  ipcMain.on("acarsDesktop:preload-log", (_event, level: string, message: string) => {
    const prefix = `[preload] ${message}`;
    appendDesktopDiagnostic("preload", level === "error" ? "error" : "info", message);

    if (level === "error") {
      console.error(prefix);
      return;
    }

    console.info(prefix);
  });

  ipcMain.handle("acarsDesktop:getSnapshot", () => desktopService.getSnapshot());
  ipcMain.handle("acarsDesktop:getSimulatorSnapshot", () =>
    desktopService.getSimulatorSnapshot(),
  );
  ipcMain.handle("acarsDesktop:login", (_event, input) =>
    desktopService.login(input),
  );
  ipcMain.handle("acarsDesktop:logout", () => desktopService.logout());
  ipcMain.handle("acarsDesktop:loadDispatchData", () =>
    desktopService.loadDispatchData(),
  );
  ipcMain.handle("acarsDesktop:createFlightFromBooking", (_event, bookingId: string) =>
    desktopService.createFlightFromBooking(bookingId),
  );
  ipcMain.handle("acarsDesktop:createSession", (_event, flightId: string) =>
    desktopService.createSession(flightId),
  );
  ipcMain.handle("acarsDesktop:getSession", (_event, sessionId: string) =>
    desktopService.getSession(sessionId),
  );
  ipcMain.handle("acarsDesktop:startSessionTracking", (_event, sessionId: string) =>
    desktopService.startSessionTracking(sessionId),
  );
  ipcMain.handle("acarsDesktop:pauseSessionTracking", () =>
    desktopService.pauseSessionTracking(),
  );
  ipcMain.handle("acarsDesktop:resumeSessionTracking", () =>
    desktopService.resumeSessionTracking(),
  );
  ipcMain.handle("acarsDesktop:getTrackingState", () =>
    desktopService.getTrackingState(),
  );
  ipcMain.handle(
    "acarsDesktop:sendManualTelemetry",
    (_event, sessionId: string, payload) =>
      desktopService.sendManualTelemetry(sessionId, payload),
  );
  ipcMain.handle("acarsDesktop:sendNextMockTelemetry", (_event, sessionId: string) =>
    desktopService.sendNextMockTelemetry(sessionId),
  );
  ipcMain.handle("acarsDesktop:resetMockSequence", (_event, sessionId: string) =>
    desktopService.resetMockSequence(sessionId),
  );
  ipcMain.handle(
    "acarsDesktop:completeSession",
    (_event, sessionId: string, pilotComment: string) =>
      desktopService.completeSession(sessionId, pilotComment),
  );

  bridgeHandlersRegistered = true;
  console.info("[main] acarsDesktop IPC bridge handlers registered.");
  appendDesktopDiagnostic("main", "info", "acarsDesktop IPC bridge handlers registered");
}

function resolveDesktopAssetPaths(): {
  preloadPath: string;
  rendererHtmlPath: string;
} {
  const preloadPath = fileURLToPath(
    new URL("../preload/preload.cjs", import.meta.url),
  );
  const rendererHtmlPath = fileURLToPath(
    new URL("../../src/renderer/index.html", import.meta.url),
  );

  if (!existsSync(preloadPath)) {
    throw new Error(`Electron preload not found: ${preloadPath}`);
  }

  if (!existsSync(rendererHtmlPath)) {
    throw new Error(`Electron renderer HTML not found: ${rendererHtmlPath}`);
  }

  return {
    preloadPath,
    rendererHtmlPath,
  };
}

function createWindow(): void {
  if (BrowserWindow.getAllWindows().length > 0) {
    return;
  }

  const { preloadPath, rendererHtmlPath } = resolveDesktopAssetPaths();
  const preloadExists = existsSync(preloadPath);
  const preloadContent = preloadExists
    ? readFileSync(preloadPath, "utf8")
    : "";
  const preloadLength = preloadContent.length;
  const preloadHasLoadedLog = preloadContent.includes('[preload] loaded');
  const preloadHasExpose = preloadContent.includes(
    'contextBridge.exposeInMainWorld("acarsDesktop"',
  );

  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1120,
    minHeight: 720,
    title: "Virtual Easyjet ACARS",
    backgroundColor: "#0b0f14",
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  console.info("[main] BrowserWindow created.", {
    preloadPath,
    preloadExists,
    preloadLength,
    preloadHasLoadedLog,
    preloadHasExpose,
    rendererHtmlPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
  });
  appendDesktopDiagnostic("main", "info", "BrowserWindow created", {
    preloadPath,
    rendererHtmlPath,
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({
    action: "deny",
  }));

  mainWindow.webContents.on(
    "console-message",
    (_event, level, message, line, sourceId) => {
      console.info("[webContents:console-message]", {
        level,
        message,
        line,
        sourceId,
      });
      appendDesktopDiagnostic("renderer", "info", message, {
        level,
        line,
        sourceId,
      });
    },
  );

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedUrl) => {
      console.error("[main] Renderer failed to load.", {
        errorCode,
        errorDescription,
        validatedUrl,
      });
      appendDesktopDiagnostic("main", "error", "Renderer failed to load", {
        errorCode,
        errorDescription,
        validatedUrl,
      });
    },
  );

  void mainWindow.loadFile(rendererHtmlPath);
}

app.whenReady().then(() => {
  appendDesktopDiagnostic("main", "info", "Desktop diagnostics activated", {
    logPath: getDesktopDiagnosticsLogPath(),
  });
  registerDesktopBridgeHandlers();
  createWindow();

  if (!simulatorBroadcastRegistered) {
    desktopService.subscribeSimulatorUpdates((snapshot) => {
      for (const windowInstance of BrowserWindow.getAllWindows()) {
        windowInstance.webContents.send("acarsDesktop:simulator-update", snapshot);
      }
    });
    simulatorBroadcastRegistered = true;
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
