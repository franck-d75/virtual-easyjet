const fs = require("node:fs");
const path = require("node:path");

function resolvePackageDirectory(packageName) {
  const packageJsonPath = require.resolve(`${packageName}/package.json`, {
    paths: [process.cwd(), __dirname],
  });

  return path.dirname(packageJsonPath);
}

function ensureFileExists(filePath, message) {
  if (!fs.existsSync(filePath)) {
    throw new Error(message);
  }
}

function main() {
  const fsuipcDirectory = resolvePackageDirectory("fsuipc");
  const prebuildPath = path.join(
    fsuipcDirectory,
    "prebuilds",
    "win32-x64",
    "fsuipc.node",
  );

  ensureFileExists(
    prebuildPath,
    `[prepare-native] FSUIPC prebuild introuvable: ${prebuildPath}`,
  );

  console.log(`[prepare-native] FSUIPC prebuild detecte: ${prebuildPath}`);
  console.log(
    "[prepare-native] Electron utilisera ce binaire natif packagé sans recompilation locale.",
  );
}

main();
