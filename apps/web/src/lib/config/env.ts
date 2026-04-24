export const APP_NAME = "Virtual Easyjet";
export const APP_SHORT_NAME = "VEJ";
export const APP_DESCRIPTION =
  "Compagnie aérienne virtuelle moderne avec espace pilote, réservations, vols et PIREPs.";
export const UNOFFICIAL_DISCLAIMER =
  "Virtual Easyjet est une compagnie aérienne virtuelle non officielle, créée par des passionnés de simulation de vol, sans affiliation avec easyJet.";
export const ACARS_DOWNLOAD_PROXY_PATH = "/api/downloads/acars";
export const ACARS_PRODUCT_NAME = "Virtual Easyjet ACARS";

export function getApiBaseUrl(): string {
  return (
    process.env.WEB_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:3001/api"
  );
}

export function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function getAcarsCurrentVersion(): string {
  return process.env.NEXT_PUBLIC_ACARS_CURRENT_VERSION ?? "0.1.0";
}

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}
