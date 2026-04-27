const fsuipc = require("fsuipc");

const FEET_PER_METER = 3.280839895;
const KNOTS_PER_MPS = 1.943844492;
const FEET_PER_MINUTE_PER_MPS = 196.8503937;
const RADIANS_TO_DEGREES = 180 / Math.PI;

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

function resolveSimulatorArgument(label) {
  switch (label) {
    case "CURRENT_MSFS":
    case "MSFS":
      return fsuipc.Simulator.MSFS;
    case "MSFS2020":
      return fsuipc.Simulator.MSFS2020;
    case "FSUIPC_ANY":
      return fsuipc.Simulator.FSUIPC_ANY;
    case "ANY":
      return fsuipc.Simulator.ANY;
    case "NO_FILTER":
      return undefined;
    default:
      return undefined;
  }
}

async function main() {
  const label = process.argv[2] ?? "NO_FILTER";
  const simulatorArgument = resolveSimulatorArgument(label);
  const client = new fsuipc.FSUIPC();

  try {
    if (simulatorArgument === undefined) {
      await client.open();
    } else {
      await client.open(simulatorArgument);
    }

    registerOffsets(client);
    const payload = await client.process();
    const { telemetry, indicatedAirspeedKts } = buildTelemetrySample(payload);
    const aircraftTitle = readString(payload, "aircraftTitle");
    const aircraftRegistration = readString(payload, "aircraftRegistration");
    const aircraftType = readString(payload, "aircraftType");
    const aircraftDetected = Boolean(
      aircraftTitle || aircraftRegistration || aircraftType || telemetry,
    );

    const response = {
      ok: true,
      simVersion: label,
      snapshot: {
        status: aircraftDetected ? "AIRCRAFT_DETECTED" : "CONNECTED",
        telemetryMode: "fsuipc",
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
      },
      telemetry,
    };

    if (typeof process.send === "function") {
      process.send(response);
    } else {
      process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const response = {
      ok: false,
      simVersion: label,
      error: message,
    };

    if (typeof process.send === "function") {
      process.send(response);
    } else {
      process.stdout.write(`${JSON.stringify(response)}\n`);
    }

    process.exitCode = 1;
  } finally {
    try {
      await client.close();
    } catch {
      // Ignore cleanup failures in one-shot attempts.
    }
  }
}

void main();
