const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const USER_CFG_FILENAME = "UserCfg.opt";
const AIRCRAFT_CFG_FILENAME = "aircraft.cfg";

let aircraftConfigFilesPromise = null;
const titleMatchCache = new Map();

function normalizeText(value) {
  return typeof value === "string" ? value.replace(/\0+/gu, "").trim() : "";
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

async function collectAircraftConfigFiles(rootDirectories) {
  const pendingDirectories = [...rootDirectories];
  const aircraftConfigFiles = [];

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

      if (entry.isFile() && entry.name.toLowerCase() === AIRCRAFT_CFG_FILENAME) {
        aircraftConfigFiles.push(absolutePath);
      }
    }
  }

  return aircraftConfigFiles;
}

async function getAircraftConfigFiles() {
  if (!aircraftConfigFilesPromise) {
    aircraftConfigFilesPromise = resolveInstalledPackagesDirectories().then(
      collectAircraftConfigFiles,
    );
  }

  return aircraftConfigFilesPromise;
}

function parseAircraftConfigSections(content, filePath) {
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
      title: normalizeText(currentValues.title),
      atcId: normalizeText(currentValues.atc_id),
      uiVariation: normalizeText(currentValues.ui_variation),
      icaoCode: normalizeText(currentValues.icao_type_designator).toUpperCase() || null,
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
  return sections.filter((section) => section.title.length > 0);
}

async function findAircraftConfigByTitle(aircraftTitle) {
  const normalizedTitle = normalizeText(aircraftTitle).toLowerCase();

  if (!normalizedTitle) {
    return null;
  }

  if (titleMatchCache.has(normalizedTitle)) {
    return titleMatchCache.get(normalizedTitle);
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
        titleMatchCache.set(normalizedTitle, matchedSection);
        return matchedSection;
      }
    } catch {
      // Ignore unreadable aircraft.cfg files.
    }
  }

  titleMatchCache.set(normalizedTitle, null);
  return null;
}

module.exports = {
  findAircraftConfigByTitle,
};
