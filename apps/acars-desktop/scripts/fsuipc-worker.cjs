const fsuipc = require("fsuipc");

const FEET_PER_METER = 3.280839895;
const KNOTS_PER_MPS = 1.943844492;
const FEET_PER_MINUTE_PER_MPS = 196.8503937;
const RADIANS_TO_DEGREES = 180 / Math.PI;

let client = null;
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

function roundInteger(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : null;
}

function readNumber(payload, key) {
  const rawValue = payload[key];

  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === "bigint") {
    return Number(rawValue);
  }

  if (typeof rawValue === "string" && rawValue.trim().length > 0) {
    const parsedValue = Number(rawValue);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

function readString(payload, key) {
  const rawValue = payload[key];

  if (typeof rawValue !== "string") {
    return null;
  }

  const normalizedValue = rawValue.replace(/\0+/gu, "").trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeHeadingDegrees(radians) {
  if (typeof radians !== "number" || !Number.isFinite(radians)) {
    return null;
  }

  const degrees = (radians * RADIANS_TO_DEGREES) % 360;
  const normalizedDegrees = degrees < 0 ? degrees + 360 : degrees;
  return Math.round(normalizedDegrees);
}

function buildTelemetrySample(payload) {
  const latitude = readNumber(payload, "latitudeDeg");
  const longitude = readNumber(payload, "longitudeDeg");
  const altitudeMeters = readNumber(payload, "altitudeMeters");
  const groundspeedMps = readNumber(payload, "groundspeedMps");
  const headingRadians = readNumber(payload, "headingRadians");
  const verticalSpeedRaw = readNumber(payload, "verticalSpeedRaw");
  const onGroundFlag = readNumber(payload, "onGroundFlag");
  const indicatedAirspeedRaw = readNumber(payload, "indicatedAirspeedRaw");

  const altitudeFt = roundInteger(
    typeof altitudeMeters === "number" ? altitudeMeters * FEET_PER_METER : null,
  );
  const groundspeedKts = roundInteger(
    typeof groundspeedMps === "number" ? groundspeedMps * KNOTS_PER_MPS : null,
  );
  const headingDeg = normalizeHeadingDegrees(headingRadians);
  const verticalSpeedFpm = roundInteger(
    typeof verticalSpeedRaw === "number"
      ? (verticalSpeedRaw / 256) * FEET_PER_MINUTE_PER_MPS
      : null,
  );
  const indicatedAirspeedKts = roundInteger(
    typeof indicatedAirspeedRaw === "number" ? indicatedAirspeedRaw / 128 : null,
  );
  const onGround =
    typeof onGroundFlag === "number" ? onGroundFlag >= 1 : null;

  if (
    latitude === null ||
    longitude === null ||
    altitudeFt === null ||
    groundspeedKts === null ||
    headingDeg === null ||
    verticalSpeedFpm === null ||
    onGround === null
  ) {
    return {
      telemetry: null,
      indicatedAirspeedKts,
    };
  }

  return {
    telemetry: {
      capturedAt: new Date().toISOString(),
      latitude,
      longitude,
      altitudeFt,
      groundspeedKts,
      headingDeg,
      verticalSpeedFpm,
      onGround,
    },
    indicatedAirspeedKts,
  };
}

function registerOffsets(targetClient) {
  targetClient.add("aircraftTitle", 0x3d00, fsuipc.Type.String, 256);
  targetClient.add("aircraftRegistration", 0x313c, fsuipc.Type.String, 24);
  targetClient.add("aircraftType", 0x3160, fsuipc.Type.String, 24);
  targetClient.add("latitudeDeg", 0x6010, fsuipc.Type.Double);
  targetClient.add("longitudeDeg", 0x6018, fsuipc.Type.Double);
  targetClient.add("altitudeMeters", 0x6020, fsuipc.Type.Double);
  targetClient.add("groundspeedMps", 0x6030, fsuipc.Type.Double);
  targetClient.add("headingRadians", 0x6038, fsuipc.Type.Double);
  targetClient.add("onGroundFlag", 0x0366, fsuipc.Type.Int16);
  targetClient.add("verticalSpeedRaw", 0x030c, fsuipc.Type.Int32);
  targetClient.add("indicatedAirspeedRaw", 0x02bc, fsuipc.Type.Int32);
}

async function ensureConnected() {
  if (client) {
    return buildSnapshot({
      status: "CONNECTED",
      dataSource: "fsuipc",
      message: "Connexion FSUIPC7 etablie avec MSFS2024.",
      connected: true,
    });
  }

  log("info", "FSUIPC connect attempt");

  try {
    const nextClient = new fsuipc.FSUIPC();
    await nextClient.open(fsuipc.Simulator.MSFS);
    registerOffsets(nextClient);
    client = nextClient;

    log("info", "FSUIPC connection success");
    return buildSnapshot({
      status: "CONNECTED",
      dataSource: "fsuipc",
      message: "Connexion FSUIPC7 etablie avec MSFS2024.",
      connected: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("error", `FSUIPC error: ${message}`);

    return buildSnapshot({
      status: "UNAVAILABLE",
      dataSource: "none",
      message: "FSUIPC7 est indisponible. Lancez FSUIPC7 avant ACARS.",
      connected: false,
      error: message,
    });
  }
}

async function sampleTelemetry() {
  const connectSnapshot = await ensureConnected();

  if (!client) {
    return {
      snapshot: connectSnapshot,
      telemetry: null,
    };
  }

  try {
    const payload = await client.process();
    const { telemetry, indicatedAirspeedKts } = buildTelemetrySample(payload);
    const aircraftTitle = readString(payload, "aircraftTitle");
    const aircraftRegistration = readString(payload, "aircraftRegistration");
    const aircraftType = readString(payload, "aircraftType");
    const aircraftDetected = Boolean(
      aircraftTitle || aircraftRegistration || aircraftType || telemetry,
    );

    if (telemetry && !firstTelemetryLogged) {
      firstTelemetryLogged = true;
      log("info", "First telemetry received", {
        capturedAt: telemetry.capturedAt,
      });
    }

    return {
      snapshot: buildSnapshot({
        status: aircraftDetected ? "AIRCRAFT_DETECTED" : "CONNECTED",
        dataSource: "fsuipc",
        message: aircraftDetected
          ? "FSUIPC7 connecte a MSFS2024. Telemetrie live recue."
          : "FSUIPC7 connecte a MSFS2024. En attente d'un appareil exploitable.",
        connected: true,
        aircraftDetected,
        aircraft: {
          title: aircraftTitle,
          registration: aircraftRegistration,
          transponder: null,
          model: aircraftType ?? aircraftTitle,
        },
        lastSampleAt: new Date().toISOString(),
        telemetry,
        indicatedAirspeedKts,
        error: null,
      }),
      telemetry,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("error", `FSUIPC error: ${message}`);

    try {
      await client.close();
    } catch {
      // Best effort cleanup only.
    }

    client = null;

    return {
      snapshot: buildSnapshot({
        status: "ERROR",
        dataSource: "none",
        message: "La lecture de la telemetrie FSUIPC7 a echoue.",
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

  if (request.type === "connect") {
    const snapshot = await ensureConnected();
    process.send?.({
      type: "response",
      id: request.id,
      ok: true,
      snapshot,
      telemetry: null,
    });
    return;
  }

  if (request.type === "sample") {
    const result = await sampleTelemetry();
    process.send?.({
      type: "response",
      id: request.id,
      ok: true,
      snapshot: result.snapshot,
      telemetry: result.telemetry,
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
