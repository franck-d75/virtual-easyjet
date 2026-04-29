const path = require("node:path");
const {
  findAircraftConfigByTitle,
  findFenixLivery,
} = require("./msfs-aircraft-registry.cjs");

let fsuipcModule = null;

function getFsuipcCandidatePaths() {
  const basePath = process.resourcesPath || __dirname;

  return [
    path.join(basePath, "app.asar.unpacked", "node_modules", "fsuipc"),
    path.join(basePath, "node_modules", "fsuipc"),
    path.join(__dirname, "..", "node_modules", "fsuipc"),
    "fsuipc",
  ];
}

function loadFsuipcModule() {
  if (fsuipcModule) {
    return fsuipcModule;
  }

  const candidates = getFsuipcCandidatePaths();
  let lastError = null;

  for (const candidate of candidates) {
    try {
      const resolvedPath =
        candidate === "fsuipc" ? require.resolve(candidate) : require.resolve(candidate);
      fsuipcModule = require(resolvedPath);
      return fsuipcModule;
    } catch (error) {
      lastError = error;
    }
  }

  const errorMessage =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`FSUIPC module load failed: ${errorMessage}`);
}

const FEET_PER_METER = 3.280839895;
const KNOTS_PER_MPS = 1.943844492;
const FEET_PER_MINUTE_PER_MPS = 196.8503937;
const KILOGRAMS_PER_POUND = 0.45359237;
const RADIANS_TO_DEGREES = 180 / Math.PI;
const REGISTERED_FLAG = Symbol.for("va.acars.fsuipc.offsetsRegistered");

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

function looksLikeRegistration(value) {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toUpperCase();
  return (
    /^[A-Z]{1,2}-[A-Z0-9]{2,5}$/.test(normalized) ||
    /^N\d{1,5}[A-Z]{0,2}$/.test(normalized) ||
    /^C-[FGI][A-Z]{3}$/.test(normalized) ||
    /^JA\d{3,4}[A-Z]?$/.test(normalized)
  );
}

function isPlaceholderAtcId(value) {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toUpperCase();
  return /^JA32\d{2}$/u.test(normalized) || /^JA320\d$/u.test(normalized);
}

function extractRegistrationsFromText(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }

  const matches = value
    .toUpperCase()
    .match(/\b([A-Z]{1,2}-[A-Z0-9]{2,5}|N\d{1,5}[A-Z]{0,2}|C-[FGI][A-Z]{3}|JA\d{3,4}[A-Z]?)\b/gu);

  if (!matches) {
    return [];
  }

  return [...new Set(matches.filter(looksLikeRegistration))];
}

function chooseResolvedRegistration(options) {
  for (const option of options) {
    if (!option || typeof option.value !== "string") {
      continue;
    }

    const normalizedValue = option.value.trim().toUpperCase();

    if (!looksLikeRegistration(normalizedValue)) {
      continue;
    }

    if (option.source === "atc_id" && isPlaceholderAtcId(normalizedValue)) {
      continue;
    }

    return {
      registration: normalizedValue,
      registrationSource: option.source,
    };
  }

  return {
    registration: null,
    registrationSource: null,
  };
}

function normalizeAircraftIcao(title, model, registration) {
  const haystack = [title, model, registration]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toUpperCase();

  if (haystack.includes("FENIX") && haystack.includes("A320")) {
    return "A320";
  }

  if (haystack.includes("A21N") || haystack.includes("A321NEO")) {
    return "A21N";
  }

  if (haystack.includes("A20N") || haystack.includes("A320NEO")) {
    return "A20N";
  }

  if (haystack.includes("A319")) {
    return "A319";
  }

  if (haystack.includes("A320")) {
    return "A320";
  }

  return null;
}

function normalizeAircraftDisplayName(title, model, icaoCode) {
  const normalizedTitle = typeof title === "string" ? title.trim() : "";
  const normalizedModel = typeof model === "string" ? model.trim() : "";
  const titleCandidate =
    normalizedTitle.length > 0 && !looksLikeRegistration(normalizedTitle)
      ? normalizedTitle
      : null;
  const modelCandidate =
    normalizedModel.length > 0 && !looksLikeRegistration(normalizedModel)
      ? normalizedModel
      : null;
  const haystack = `${titleCandidate ?? ""} ${modelCandidate ?? ""}`.toUpperCase();

  if (haystack.includes("FENIX") && haystack.includes("A320")) {
    return "Fenix A320";
  }

  if (titleCandidate) {
    return titleCandidate;
  }

  if (modelCandidate) {
    return modelCandidate;
  }

  return icaoCode;
}

function normalizeUiVariation(value) {
  const normalizedValue = typeof value === "string" ? value.trim() : "";
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
  const fuelTotalWeightPounds = readNumber(payload, "fuelTotalWeightPounds");

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
  const fuelTotalKg =
    typeof fuelTotalWeightPounds === "number"
      ? Math.max(
          0,
          Math.round(fuelTotalWeightPounds * KILOGRAMS_PER_POUND * 100) / 100,
        )
      : null;
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
      fuelTotalKg: fuelTotalKg ?? undefined,
    },
    indicatedAirspeedKts,
  };
}

function registerOffsets(targetClient) {
  const fsuipc = loadFsuipcModule();

  if (targetClient[REGISTERED_FLAG]) {
    return;
  }

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
  targetClient.add("fuelTotalWeightPounds", 0x126c, fsuipc.Type.UInt32);

  targetClient[REGISTERED_FLAG] = true;
}

function isWrongFs(error) {
  const fsuipc = loadFsuipcModule();

  if (!error || typeof error !== "object") {
    return false;
  }

  const code = error.code;
  const message =
    error instanceof Error ? error.message : String(error.message ?? "");

  return (
    code === fsuipc.ErrorCode.WRONGFS ||
    /version requested/i.test(message)
  );
}

async function closeQuietly(client) {
  if (!client) {
    return;
  }

  try {
    await client.close();
  } catch {
    // Ignore cleanup failures.
  }
}

async function connectOfficial(log) {
  const fsuipc = loadFsuipcModule();
  let client = new fsuipc.FSUIPC();

  try {
    log("FSUIPC connect attempt with simVersion=MSFS");
    await client.open(fsuipc.Simulator.MSFS);
    log("FSUIPC connection success with simVersion=MSFS");
    log("FSUIPC selected simVersion=MSFS for MSFS2024/FSUIPC7");
    registerOffsets(client);
    return {
      client,
      selectedMode: "MSFS",
    };
  } catch (error) {
    if (!isWrongFs(error)) {
      await closeQuietly(client);
      throw error;
    }

    await closeQuietly(client);
    client = new fsuipc.FSUIPC();

    log(
      "FSUIPC connect attempt with interface=COMMON_IPC",
      {
        reason: error instanceof Error ? error.message : String(error),
      },
    );
    await client.open();
    log("FSUIPC connection success with interface=COMMON_IPC");
    log("FSUIPC selected interface=COMMON_IPC for MSFS2024/FSUIPC7");
    registerOffsets(client);
    return {
      client,
      selectedMode: "COMMON_IPC",
    };
  }
}

async function sampleClient(client, selectedMode) {
  registerOffsets(client);

  const payload = await client.process();
  const { telemetry, indicatedAirspeedKts } = buildTelemetrySample(payload);
  const aircraftTitle = readString(payload, "aircraftTitle");
  const aircraftRawAtcId = readString(payload, "aircraftRegistration");
  const aircraftType = readString(payload, "aircraftType");
  const aircraftConfig = aircraftTitle
    ? await findAircraftConfigByTitle(aircraftTitle)
    : null;
  const explicitTitleRegistration = extractRegistrationsFromText(aircraftTitle)[0] ?? null;
  const fenixLivery = await findFenixLivery({
    aircraftTitle,
    parsedRegistration: explicitTitleRegistration,
    atcId: aircraftRawAtcId,
  });
  const uiVariation = normalizeUiVariation(
    fenixLivery?.name ??
      aircraftConfig?.uiVariation ??
      aircraftTitle ??
      aircraftType ??
      null,
  );
  const explicitLiveryRegistration =
    extractRegistrationsFromText(fenixLivery?.name ?? uiVariation)[0] ?? null;
  const explicitAircraftConfigRegistration =
    extractRegistrationsFromText(aircraftConfig?.atcId ?? null)[0] ?? null;
  const { registration, registrationSource } = chooseResolvedRegistration([
    {
      source: "title",
      value: explicitTitleRegistration,
    },
    {
      source: "livery",
      value: explicitLiveryRegistration,
    },
    {
      source: "aircraft_cfg",
      value: explicitAircraftConfigRegistration,
    },
    {
      source: "atc_id",
      value: aircraftRawAtcId,
    },
  ]);
  const aircraftIcao =
    fenixLivery?.aircraftIcao ??
    aircraftConfig?.icaoCode ??
    normalizeAircraftIcao(
    aircraftTitle,
    aircraftType,
    aircraftRawAtcId,
  );
  const aircraftDisplayName =
    fenixLivery?.aircraftName ??
    normalizeAircraftDisplayName(
      aircraftTitle,
      aircraftType,
      aircraftIcao,
    );
  const aircraftDetected = Boolean(
    aircraftDisplayName || aircraftTitle || aircraftType || telemetry,
  );

  return {
    selectedMode,
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
        displayName: aircraftDisplayName,
        title: aircraftTitle,
        icaoCode: aircraftIcao,
        registration,
        registrationSource,
        atcId: registration,
        rawAtcId: aircraftRawAtcId,
        liveryName: uiVariation,
        airlineIcao: fenixLivery?.airlineIcao ?? null,
        atcAirline: fenixLivery?.atcAirline ?? null,
        selcal: fenixLivery?.selcal ?? null,
        liveryId: fenixLivery?.liveryId ?? null,
        versionId: fenixLivery?.versionId ?? null,
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
}

async function connectAndSampleOnce(log) {
  const { client, selectedMode } = await connectOfficial(log);

  try {
    return await sampleClient(client, selectedMode);
  } finally {
    await closeQuietly(client);
  }
}

module.exports = {
  closeQuietly,
  connectAndSampleOnce,
  connectOfficial,
  loadFsuipcModule,
  sampleClient,
};
