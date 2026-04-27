const { fork } = require("node:child_process");
const path = require("node:path");

const ATTEMPT_TIMEOUT_MS = 10_000;
const attemptScriptPath = path.join(__dirname, "fsuipc-attempt.cjs");

let firstTelemetryLogged = false;

function log(level, message, details) {
  if (typeof process.send === "function") {
    process.send({
      type: "log",
      level,
      message,
      details,
    });
  }
}

function buildSnapshot(overrides = {}) {
  return {
    status: "UNAVAILABLE",
    telemetryMode: "fsuipc",
    dataSource: "none",
    message: "FSUIPC7 n'est pas detecte pour le moment. Lancez FSUIPC7 avant ACARS.",
    connected: false,
    aircraftDetected: false,
    aircraft: null,
    lastSampleAt: null,
    telemetry: null,
    indicatedAirspeedKts: null,
    error: null,
    ...overrides,
  };
}

function buildConnectionStrategies() {
  return ["CURRENT_MSFS", "MSFS", "MSFS2020", "FSUIPC_ANY", "ANY", "NO_FILTER"];
}

function runAttempt(simVersion) {
  return new Promise((resolve, reject) => {
    const child = fork(attemptScriptPath, [simVersion], {
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });

    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      child.kill();
      reject(new Error(`FSUIPC attempt timed out for ${simVersion}.`));
    }, ATTEMPT_TIMEOUT_MS);

    child.on("message", (message) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      child.kill();
      resolve(message);
    });

    child.on("exit", (code, signal) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      reject(
        new Error(
          `FSUIPC attempt exited unexpectedly for ${simVersion} (code=${code ?? "null"}, signal=${signal ?? "null"}).`,
        ),
      );
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function executeSequence() {
  let lastError = null;

  for (const simVersion of buildConnectionStrategies()) {
    log("info", `FSUIPC connect attempt with simVersion=${simVersion}`);

    try {
      const result = await runAttempt(simVersion);

      if (!result || result.ok !== true) {
        const message = result?.error ?? "Unknown FSUIPC error.";
        log("error", `FSUIPC error: ${message}`);
        lastError = new Error(message);
        continue;
      }

      log("info", `FSUIPC connection success with simVersion=${simVersion}`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log("error", `FSUIPC error: ${message}`);
      lastError = error;
    }
  }

  throw lastError ?? new Error("FSUIPC connection failed.");
}

async function ensureConnected() {
  try {
    const result = await executeSequence();

    if (result.telemetry && !firstTelemetryLogged) {
      firstTelemetryLogged = true;
      log("info", "First telemetry received", {
        capturedAt: result.telemetry.capturedAt ?? null,
      });
    }

    return {
      snapshot: buildSnapshot({
        ...(result.snapshot ?? {}),
        telemetryMode: "fsuipc",
      }),
      telemetry: result.telemetry ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      snapshot: buildSnapshot({
        status: "UNAVAILABLE",
        dataSource: "none",
        message: "FSUIPC7 est indisponible. Lancez FSUIPC7 avant ACARS.",
        connected: false,
        aircraftDetected: false,
        error: message,
      }),
      telemetry: null,
    };
  }
}

async function handleRequest(request) {
  if (!request || typeof request !== "object") {
    return;
  }

  if (request.type === "connect" || request.type === "sample") {
    const result = await ensureConnected();
    process.send?.({
      type: "response",
      id: request.id,
      ok: true,
      snapshot: result.snapshot,
      telemetry: request.type === "sample" ? result.telemetry : null,
    });
  }
}

process.on("message", (request) => {
  void handleRequest(request).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    log("error", `FSUIPC error: ${message}`);

    if (request && typeof request === "object" && "id" in request) {
      process.send?.({
        type: "response",
        id: request.id,
        ok: false,
        error: message,
      });
    }
  });
});
