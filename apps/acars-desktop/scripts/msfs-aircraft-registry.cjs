const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const USER_CFG_FILENAME = "UserCfg.opt";
const AIRCRAFT_CFG_FILENAME = "aircraft.cfg";
const LIVERY_CFG_FILENAME = "livery.cfg";

let aircraftConfigFilesPromise = null;
let liveryConfigFilesPromise = null;
const aircraftTitleMatchCache = new Map();
const liveryLookupCache = new Map();

function normalizeText(value) {
  return typeof value === "string" ? value.replace(/\0+/gu, "").trim() : "";
}

function normalizeUpperText(value) {
  const normalizedValue = normalizeText(value);
  return normalizedValue.length > 0 ? normalizedValue.toUpperCase() : "";
}

function normalizeCompactText(value) {
  return normalizeUpperText(value).replace(/[^A-Z0-9]/gu, "");
}

function uniquePaths(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))];
}

function looksLikeDirectory(targetPath) {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

function looksLikeFile(targetPath) {
  try {
    return fs.statSync(targetPath).isFile();
  } catch {
    return false;
  }
}

function collectCandidateUserCfgPaths() {
  const homeDirectory = os.homedir();
  const candidates = [
    path.join(
      homeDirectory,
      "AppData",
      "Local",
      "Packages",
      "Microsoft.Limitless_8wekyb3d8bbwe",
      "LocalCache",
      USER_CFG_FILENAME,
    ),
    path.join(
      homeDirectory,
      "AppData",
      "Local",
      "Packages",
      "Microsoft.FlightSimulator_8wekyb3d8bbwe",
      "LocalCache",
      USER_CFG_FILENAME,
    ),
    path.join(
      homeDirectory,
      "AppData",
      "Roaming",
      "Microsoft Flight Simulator 2024",
      USER_CFG_FILENAME,
    ),
    path.join(
      homeDirectory,
      "AppData",
      "Roaming",
      "Microsoft Flight Simulator",
      USER_CFG_FILENAME,
    ),
  ];

  const packagesDirectory = path.join(homeDirectory, "AppData", "Local", "Packages");

  if (looksLikeDirectory(packagesDirectory)) {
    for (const entry of fs.readdirSync(packagesDirectory, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      candidates.push(
        path.join(
          packagesDirectory,
          entry.name,
          "LocalCache",
          USER_CFG_FILENAME,
        ),
      );
    }
  }

  return uniquePaths(candidates).filter(looksLikeFile);
}

async function resolveInstalledPackagesDirectories() {
  const directories = [];

  for (const userCfgPath of collectCandidateUserCfgPaths()) {
    try {
      const content = await fsp.readFile(userCfgPath, "utf8");
      const match = content.match(/InstalledPackagesPath\s+"([^"]+)"/iu);
      const installedPackagesPath = normalizeText(match?.[1] ?? "");

      if (!installedPackagesPath) {
        continue;
      }

      directories.push(path.join(installedPackagesPath, "Community"));
      directories.push(path.join(installedPackagesPath, "Official"));
    } catch {
      // Ignore unreadable configs and continue with the next candidate.
    }
  }

  return uniquePaths(directories).filter(looksLikeDirectory);
}

async function collectConfigFiles(rootDirectories, expectedFilename) {
  const pendingDirectories = [...rootDirectories];
  const matchingFiles = [];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();

    if (!currentDirectory) {
      continue;
    }

    let directoryEntries = [];

    try {
      directoryEntries = await fsp.readdir(currentDirectory, {
        withFileTypes: true,
      });
    } catch {
      continue;
    }

    for (const entry of directoryEntries) {
      const absolutePath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        pendingDirectories.push(absolutePath);
        continue;
      }

      if (entry.isFile() && entry.name.toLowerCase() === expectedFilename) {
        matchingFiles.push(absolutePath);
      }
    }
  }

  return matchingFiles;
}

async function getAircraftConfigFiles() {
  if (!aircraftConfigFilesPromise) {
    aircraftConfigFilesPromise = resolveInstalledPackagesDirectories().then((rootDirectories) =>
      collectConfigFiles(rootDirectories, AIRCRAFT_CFG_FILENAME),
    );
  }

  return aircraftConfigFilesPromise;
}

async function getLiveryConfigFiles() {
  if (!liveryConfigFilesPromise) {
    liveryConfigFilesPromise = resolveInstalledPackagesDirectories().then((rootDirectories) =>
      collectConfigFiles(rootDirectories, LIVERY_CFG_FILENAME),
    );
  }

  return liveryConfigFilesPromise;
}

function parseIniSections(content, filePath) {
  const sections = [];
  const lines = content.split(/\r?\n/gu);
  let currentSectionName = null;
  let currentValues = {};

  function flushSection() {
    if (!currentSectionName) {
      return;
    }

    sections.push({
      filePath,
      sectionName: currentSectionName,
      values: currentValues,
    });
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith(";")) {
      continue;
    }

    const sectionMatch = line.match(/^\[([^\]]+)\]$/u);

    if (sectionMatch) {
      flushSection();
      currentSectionName = normalizeText(sectionMatch[1]);
      currentValues = {};
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = normalizeText(line.slice(0, separatorIndex)).toLowerCase();
    const value = normalizeText(line.slice(separatorIndex + 1));

    currentValues[key] = value;
  }

  flushSection();
  return sections;
}

function extractAircraftIcaoFromText(value) {
  const normalizedValue = normalizeUpperText(value);

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue.includes("A21N") || normalizedValue.includes("A321NEO")) {
    return "A21N";
  }

  if (normalizedValue.includes("A20N") || normalizedValue.includes("A320NEO")) {
    return "A20N";
  }

  if (normalizedValue.includes("A319")) {
    return "A319";
  }

  if (normalizedValue.includes("A320")) {
    return "A320";
  }

  return null;
}

function parseAircraftConfigSections(content, filePath) {
  return parseIniSections(content, filePath)
    .map((section) => ({
      filePath,
      sectionName: section.sectionName,
      title: normalizeText(section.values.title),
      atcId: normalizeText(section.values.atc_id),
      uiVariation: normalizeText(section.values.ui_variation),
      icaoCode:
        normalizeUpperText(section.values.icao_type_designator) ||
        extractAircraftIcaoFromText(section.values.title) ||
        null,
    }))
    .filter((section) => section.title.length > 0);
}

function isFenixLiveryCandidate(filePath, sections) {
  const haystack = [
    filePath,
    ...sections.flatMap((section) => [section.sectionName, ...Object.values(section.values)]),
  ]
    .map(normalizeUpperText)
    .join(" ");

  return haystack.includes("FENIX") || haystack.includes("FNX_");
}

function parseLiveryConfigEntry(content, filePath) {
  const sections = parseIniSections(content, filePath);

  if (sections.length === 0 || !isFenixLiveryCandidate(filePath, sections)) {
    return null;
  }

  const generalSection = sections.find(
    (section) => section.sectionName.toUpperCase() === "GENERAL",
  );
  const fltsimSection = sections.find((section) =>
    section.sectionName.toUpperCase().startsWith("FLTSIM"),
  );
  const requiredTagsSection = sections.find((section) =>
    section.sectionName.toUpperCase().includes("REQUIRED"),
  );

  const liveryName =
    normalizeText(generalSection?.values.name) ||
    normalizeText(fltsimSection?.values.ui_variation) ||
    null;
  const atcId = normalizeUpperText(fltsimSection?.values.atc_id) || null;

  if (!liveryName || !atcId) {
    return null;
  }

  const aircraftIcao =
    normalizeUpperText(requiredTagsSection?.values.icao_type_designator) ||
    extractAircraftIcaoFromText(requiredTagsSection?.values.required_tags) ||
    extractAircraftIcaoFromText(requiredTagsSection?.values.tags) ||
    extractAircraftIcaoFromText(liveryName) ||
    (normalizeUpperText(filePath).includes("A320") ? "A320" : null);

  const aircraftName =
    aircraftIcao === "A320" || normalizeUpperText(filePath).includes("FENIX")
      ? "Fenix A320"
      : aircraftIcao;

  return {
    filePath,
    atcId,
    name: liveryName,
    airlineIcao: normalizeUpperText(fltsimSection?.values.icao_airline) || null,
    atcAirline: normalizeText(fltsimSection?.values.atc_airline) || null,
    selcal: normalizeText(fltsimSection?.values.fnx_selcal_code) || null,
    liveryId: normalizeText(fltsimSection?.values.fnx_livery_id) || null,
    versionId: normalizeText(fltsimSection?.values.fnx_version_id) || null,
    aircraftIcao,
    aircraftName,
  };
}

async function findAircraftConfigByTitle(aircraftTitle) {
  const normalizedTitle = normalizeText(aircraftTitle).toLowerCase();
  const compactTitle = normalizeCompactText(aircraftTitle);

  if (!normalizedTitle) {
    return null;
  }

  if (aircraftTitleMatchCache.has(normalizedTitle)) {
    return aircraftTitleMatchCache.get(normalizedTitle);
  }

  const aircraftConfigFiles = await getAircraftConfigFiles();

  for (const filePath of aircraftConfigFiles) {
    try {
      const content = await fsp.readFile(filePath, "utf8");
      const sections = parseAircraftConfigSections(content, filePath);
      const matchedSection = sections.find(
        (section) => section.title.toLowerCase() === normalizedTitle,
      );

      if (matchedSection) {
        aircraftTitleMatchCache.set(normalizedTitle, matchedSection);
        return matchedSection;
      }

      const compactMatchedSection = sections.find((section) => {
        const sectionCompactTitle = normalizeCompactText(section.title);

        if (!sectionCompactTitle || !compactTitle) {
          return false;
        }

        return (
          sectionCompactTitle === compactTitle ||
          sectionCompactTitle.includes(compactTitle) ||
          compactTitle.includes(sectionCompactTitle)
        );
      });

      if (compactMatchedSection) {
        aircraftTitleMatchCache.set(normalizedTitle, compactMatchedSection);
        return compactMatchedSection;
      }
    } catch {
      // Ignore unreadable aircraft.cfg files.
    }
  }

  aircraftTitleMatchCache.set(normalizedTitle, null);
  return null;
}

async function buildFenixLiveryLookup() {
  if (liveryLookupCache.has("fenix")) {
    return liveryLookupCache.get("fenix");
  }

  const byAtcId = new Map();
  const byName = new Map();
  const liveryConfigFiles = await getLiveryConfigFiles();

  for (const filePath of liveryConfigFiles) {
    try {
      const content = await fsp.readFile(filePath, "utf8");
      const entry = parseLiveryConfigEntry(content, filePath);

      if (!entry) {
        continue;
      }

      byAtcId.set(entry.atcId, entry);
      byName.set(entry.name.toUpperCase(), entry);
    } catch {
      // Ignore unreadable livery.cfg files.
    }
  }

  const lookup = {
    byAtcId,
    byName,
  };

  liveryLookupCache.set("fenix", lookup);
  return lookup;
}

async function findFenixLivery({ aircraftTitle, parsedRegistration, atcId }) {
  const lookup = await buildFenixLiveryLookup();
  const normalizedParsedRegistration = normalizeUpperText(parsedRegistration);
  const normalizedAtcId = normalizeUpperText(atcId);
  const normalizedTitle = normalizeUpperText(aircraftTitle);

  if (normalizedParsedRegistration && lookup.byAtcId.has(normalizedParsedRegistration)) {
    return lookup.byAtcId.get(normalizedParsedRegistration) ?? null;
  }

  if (normalizedAtcId && lookup.byAtcId.has(normalizedAtcId)) {
    return lookup.byAtcId.get(normalizedAtcId) ?? null;
  }

  if (normalizedTitle) {
    const registrationMatch = normalizedTitle.match(
      /\b([A-Z]{1,2}-[A-Z0-9]{2,5}|N\d{1,5}[A-Z]{0,2}|C-[FGI][A-Z]{3}|JA\d{3,4}[A-Z]?)\b/u,
    );

    if (registrationMatch?.[1] && lookup.byAtcId.has(registrationMatch[1])) {
      return lookup.byAtcId.get(registrationMatch[1]) ?? null;
    }

    for (const [entryName, entry] of lookup.byName.entries()) {
      if (normalizedTitle.includes(entryName) || entryName.includes(normalizedTitle)) {
        return entry;
      }
    }
  }

  return null;
}

module.exports = {
  findAircraftConfigByTitle,
  findFenixLivery,
};
