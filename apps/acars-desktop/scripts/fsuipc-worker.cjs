const { fork } = require("node:child_process");
const path = require("node:path");

const ATTEMPT_TIMEOUT_MS = 10_000;
const SAMPLE_INTERVAL_MS = 3_000;
const attemptScriptPath = path.join(__dirname, "fsuipc-attempt.cjs");
const DISCOVERY_STRATEGIES = ["MSFS2020", "MSFS", "CURRENT_MSFS", "ANY"];

let firstTelemetryLogged = false;
let preferredSimVersion = null;
let sampleInterval = null;
let sampleInProgress = false;
let lastLiveSnapshot = null;
let lastLiveTelemetry = null;

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function log(level, message, details) {
  emit({
    type: "log",
    level,
    message,
    details,
  });
}

function emitSnapshot(snapshot, telemetry) {
  emit({
    type: "snapshot",
    snapshot,
    telemetry,
  });
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
  if (preferredSimVersion) {
    return [preferredSimVersion];
  }

  return [...DISCOVERY_STRATEGIES];
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

      const selectedNewVersion = preferredSimVersion !== simVersion;
      preferredSimVersion = simVersion;
      log("info", `FSUIPC connection success with simVersion=${simVersion}`);

      if (selectedNewVersion) {
        log(
          "info",
          `FSUIPC selected simVersion=${simVersion} for MSFS2024/FSUIPC7`,
        );
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log("error", `FSUIPC error: ${message}`);
      lastError = error;
    }
  }

  throw lastError ?? new Error("FSUIPC connection failed.");
}

async function sampleOnce() {
  if (sampleInProgress) {
    return;
  }

  sampleInProgress = true;

  try {
    const result = await executeSequence();
    const telemetry = result.telemetry ?? lastLiveTelemetry ?? null;
    const snapshot = buildSnapshot({
      ...(lastLiveSnapshot ?? {}),
      ...(result.snapshot ?? {}),
      status:
        result.snapshot?.aircraftDetected || telemetry
          ? "AIRCRAFT_DETECTED"
          : "CONNECTED",
      telemetryMode: "fsuipc",
      dataSource: "fsuipc",
      message:
        result.snapshot?.message ??
        "FSUIPC7 connecte a MSFS2024. Telemetrie live recue.",
      connected: true,
      aircraftDetected: Boolean(result.snapshot?.aircraftDetected || telemetry),
      lastSampleAt:
        result.snapshot?.lastSampleAt ??
        lastLiveSnapshot?.lastSampleAt ??
        null,
      telemetry,
      indicatedAirspeedKts:
        result.snapshot?.indicatedAirspeedKts ??
        lastLiveSnapshot?.indicatedAirspeedKts ??
        null,
      error: null,
    });

    if (result.telemetry && !firstTelemetryLogged) {
      firstTelemetryLogged = true;
      log("info", "First telemetry received", {
        capturedAt: result.telemetry.capturedAt ?? null,
      });
    }

    lastLiveSnapshot = snapshot;
    lastLiveTelemetry = telemetry;
    emitSnapshot(snapshot, telemetry);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (lastLiveSnapshot) {
      emitSnapshot(
        buildSnapshot({
          ...lastLiveSnapshot,
          status: lastLiveSnapshot.aircraftDetected ? "AIRCRAFT_DETECTED" : "CONNECTED",
          telemetryMode: "fsuipc",
          dataSource: "fsuipc",
          message:
            "FSUIPC7 reste la source active. Derniere telemetrie conservee pendant la reconnexion.",
          connected: true,
          aircraftDetected: Boolean(
            lastLiveSnapshot.aircraftDetected || lastLiveTelemetry,
          ),
          error: message,
        }),
        lastLiveTelemetry,
      );
    } else {
      emitSnapshot(
        buildSnapshot({
          status: "UNAVAILABLE",
          dataSource: "none",
          message: "FSUIPC7 est indisponible. Lancez FSUIPC7 avant ACARS.",
          connected: false,
          aircraftDetected: false,
          error: message,
        }),
        null,
      );
    }
  } finally {
    sampleInProgress = false;
  }
}

async function bootstrap() {
  log("info", "FSUIPC worker started");
  await sampleOnce();
  sampleInterval = setInterval(() => {
    void sampleOnce();
  }, SAMPLE_INTERVAL_MS);
}

void bootstrap();

process.on("SIGTERM", () => {
  if (sampleInterval) {
    clearInterval(sampleInterval);
    sampleInterval = null;
  }

  process.exit(0);
});
