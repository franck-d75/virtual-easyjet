const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");

function logToMain(level: "info" | "error", message: string): void {
  ipcRenderer.send("acarsDesktop:preload-log", level, message);
}

console.log("[preload] loaded");
logToMain("info", "loaded");

process.on("uncaughtException", (error) => {
  console.error("[preload] uncaught exception", error);
  logToMain("error", `uncaught exception: ${String(error)}`);
});

process.on("unhandledRejection", (reason) => {
  console.error("[preload] unhandled rejection", reason);
  logToMain("error", `unhandled rejection: ${String(reason)}`);
});

try {
  const bridge = {
    getSnapshot: () => ipcRenderer.invoke("acarsDesktop:getSnapshot"),
    getSimulatorSnapshot: () =>
      ipcRenderer.invoke("acarsDesktop:getSimulatorSnapshot"),
    login: (input: unknown) => ipcRenderer.invoke("acarsDesktop:login", input),
    logout: () => ipcRenderer.invoke("acarsDesktop:logout"),
    loadDispatchData: () => ipcRenderer.invoke("acarsDesktop:loadDispatchData"),
    createFlightFromBooking: (bookingId: string) =>
      ipcRenderer.invoke("acarsDesktop:createFlightFromBooking", bookingId),
    createSession: (flightId: string) =>
      ipcRenderer.invoke("acarsDesktop:createSession", flightId),
    getSession: (sessionId: string) =>
      ipcRenderer.invoke("acarsDesktop:getSession", sessionId),
    startSessionTracking: (sessionId: string) =>
      ipcRenderer.invoke("acarsDesktop:startSessionTracking", sessionId),
    pauseSessionTracking: () =>
      ipcRenderer.invoke("acarsDesktop:pauseSessionTracking"),
    resumeSessionTracking: () =>
      ipcRenderer.invoke("acarsDesktop:resumeSessionTracking"),
    getTrackingState: () =>
      ipcRenderer.invoke("acarsDesktop:getTrackingState"),
    sendManualTelemetry: (sessionId: string, payload: unknown) =>
      ipcRenderer.invoke(
        "acarsDesktop:sendManualTelemetry",
        sessionId,
        payload,
      ),
    sendNextMockTelemetry: (sessionId: string) =>
      ipcRenderer.invoke("acarsDesktop:sendNextMockTelemetry", sessionId),
    resetMockSequence: (sessionId: string) =>
      ipcRenderer.invoke("acarsDesktop:resetMockSequence", sessionId),
    completeSession: (sessionId: string, pilotComment: string) =>
      ipcRenderer.invoke(
        "acarsDesktop:completeSession",
        sessionId,
        pilotComment,
      ),
  };

  if (typeof bridge.login !== "function") {
    throw new Error("Electron preload bridge is invalid: login() is missing.");
  }

  contextBridge.exposeInMainWorld("acarsDesktop", bridge);
  console.log("[preload] acarsDesktop exposed", {
    methods: Object.keys(bridge),
  });
  logToMain("info", "acarsDesktop exposed");
} catch (error) {
  console.error("[preload] bootstrap failed", error);
  logToMain("error", `bootstrap failed: ${String(error)}`);
  throw error;
}
