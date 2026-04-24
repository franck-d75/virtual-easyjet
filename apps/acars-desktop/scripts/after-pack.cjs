const path = require("node:path");
const fs = require("node:fs");
const { rcedit } = require("rcedit");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") {
    return;
  }

  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  const iconPath = path.join(context.packager.projectDir, "build-resources", "icon.ico");

  if (!fs.existsSync(exePath)) {
    throw new Error(`[afterPack] Windows executable not found: ${exePath}`);
  }

  if (!fs.existsSync(iconPath)) {
    throw new Error(`[afterPack] Windows icon not found: ${iconPath}`);
  }

  await rcedit(exePath, {
    icon: iconPath,
    "file-version": context.packager.appInfo.version,
    "product-version": context.packager.appInfo.version,
    "version-string": {
      CompanyName: "Virtual Easyjet",
      FileDescription: "Client desktop ACARS Windows pour Virtual Easyjet.",
      InternalFilename: exeName,
      OriginalFilename: exeName,
      ProductName: context.packager.appInfo.productName,
    },
    "requested-execution-level": "asInvoker",
  });

  console.log(`[afterPack] Patched Windows executable resources: ${exePath}`);
};
