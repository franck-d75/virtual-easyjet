const {
  closeQuietly,
  connectOfficial,
  loadFsuipcModule,
  sampleClient,
} = require("./fsuipc-official.cjs");

const SAMPLE_INTERVAL_MS = 3_000;

let client = null;
let selectedMode = null;
let firstTelemetryLogged = false;
let lastLiveSnapshot = null;
let lastLiveTelemetry = null;
let lastAircraftDebugSignature = null;
let lastLoggedFuelTotalKg = null;
let sampleInterval = null;
let sampleInProgress = false;

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
    type: "telemetry",
    data: {
      snapshot,
      telemetry,
    },
  });
}

function logAircraftResolution(snapshot) {
  const aircraft = snapshot?.aircraft;

  if (!aircraft) {
    return;
  }

  const signature = JSON.stringify({
    title: aircraft.title ?? null,
    rawAtcId: aircraft.rawAtcId ?? null,
    liveryName: aircraft.liveryName ?? null,
    registration: aircraft.registration ?? null,
    registrationSource: aircraft.registrationSource ?? null,
  });

  if (signature === lastAircraftDebugSignature) {
    return;
  }

  lastAircraftDebugSignature = signature;
  const parsedRegistration =
    aircraft.registrationSource === "title" ||
    aircraft.registrationSource === "livery" ||
    aircraft.registrationSource === "aircraft_cfg"
      ? aircraft.registration ?? null
      : null;
  const registrationSource =
    aircraft.registrationSource === "title" ||
    aircraft.registrationSource === "livery" ||
    aircraft.registrationSource === "aircraft_cfg"
      ? "FSUIPC"
      : aircraft.registrationSource === "latest_ofp" ||
          aircraft.registrationSource === "simbrief_airframe"
        ? "SimBrief"
        : aircraft.registrationSource === "atc_id"
          ? "fallback"
          : null;
  log("info", "Aircraft registration resolution", {
    aircraftTitleRaw: aircraft.title ?? null,
    liveryRaw: aircraft.liveryName ?? null,
    parsedRegistration,
    resolvedRegistration: aircraft.registration ?? null,
    registrationSource,
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

async function ensureClient() {
  if (client) {
    return;
  }

  const connected = await connectOfficial((message, details) => {
    log("info", message, details);
  });

  client = connected.client;
  selectedMode = connected.selectedMode;
}

async function resetClient() {
  await closeQuietly(client);
  client = null;
  selectedMode = null;
}

async function sampleOnce() {
  if (sampleInProgress) {
    return;
  }

  sampleInProgress = true;

  try {
    await ensureClient();
    const result = await sampleClient(client, selectedMode);
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

    if (telemetry && !firstTelemetryLogged) {
      firstTelemetryLogged = true;
      log("info", "First telemetry received", {
        capturedAt: telemetry.capturedAt ?? null,
        fuelTotalKg: telemetry.fuelTotalKg ?? null,
        fuelSource: "FSUIPC",
      });
    }

    if (
      typeof telemetry?.fuelTotalKg === "number" &&
      telemetry.fuelTotalKg !== lastLoggedFuelTotalKg
    ) {
      lastLoggedFuelTotalKg = telemetry.fuelTotalKg;
      log("info", "Fuel telemetry received", {
        fuelTotalKg: telemetry.fuelTotalKg ?? null,
        fuelSource: "FSUIPC",
      });
    }

    lastLiveSnapshot = snapshot;
    lastLiveTelemetry = telemetry;
    logAircraftResolution(snapshot);
    emitSnapshot(snapshot, telemetry);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await resetClient();

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
      log("error", `FSUIPC error: ${message}`);
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
  console.log("FSUIPC worker boot");
  log("info", "FSUIPC worker started");

  try {
    loadFsuipcModule();
    console.log("FSUIPC module loaded");
    log("info", "FSUIPC module loaded");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FSUIPC require failed: ${message}`);
    log("error", `FSUIPC require failed: ${message}`);
    process.exit(1);
    return;
  }

  await sampleOnce();
  sampleInterval = setInterval(() => {
    void sampleOnce();
  }, SAMPLE_INTERVAL_MS);
}

void bootstrap();

process.on("SIGTERM", async () => {
  if (sampleInterval) {
    clearInterval(sampleInterval);
    sampleInterval = null;
  }

  await resetClient();
  process.exit(0);
});
