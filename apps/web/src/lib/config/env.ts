export const APP_NAME = "Virtual Easyjet";
export const APP_SHORT_NAME = "VEJ";
export const APP_DESCRIPTION =
  "Compagnie aérienne virtuelle moderne avec espace pilote, réservations, vols et PIREPs.";
export const UNOFFICIAL_DISCLAIMER =
  "Virtual Easyjet est une compagnie aérienne virtuelle non officielle, créée par des passionnés de simulation de vol, sans affiliation avec easyJet.";
export const ACARS_DOWNLOAD_PROXY_PATH = "/api/acars/download";
export const ACARS_PRODUCT_NAME = "Virtual Easyjet ACARS";

const DEFAULT_DEVELOPMENT_API_BASE_URL = "http://localhost:3001/api";
const DEFAULT_PRODUCTION_API_BASE_URL = "https://api.virtual-easyjet.fr/api";
const DEFAULT_DEVELOPMENT_APP_BASE_URL = "http://localhost:3000";
const DEFAULT_PRODUCTION_APP_BASE_URL = "https://www.virtual-easyjet.fr";

function getDefaultApiBaseUrl(): string {
  return isProductionEnvironment()
    ? DEFAULT_PRODUCTION_API_BASE_URL
    : DEFAULT_DEVELOPMENT_API_BASE_URL;
}

function getDefaultAppBaseUrl(): string {
  return isProductionEnvironment()
    ? DEFAULT_PRODUCTION_APP_BASE_URL
    : DEFAULT_DEVELOPMENT_APP_BASE_URL;
}

function normalizeApiBaseUrl(value: string | undefined): string {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return getDefaultApiBaseUrl();
  }

  if (!/^https?:\/\//i.test(trimmedValue)) {
    return getDefaultApiBaseUrl();
  }

  const withoutTrailingSlash = trimmedValue.replace(/\/+$/, "");

  if (withoutTrailingSlash.endsWith("/api")) {
    return withoutTrailingSlash;
  }

  return `${withoutTrailingSlash}/api`;
}

function getFirstConfiguredValue(
  ...values: Array<string | undefined>
): string | undefined {
  return values.find((value) => value?.trim().length);
}

export function getApiBaseUrl(): string {
  return normalizeApiBaseUrl(
    getFirstConfiguredValue(
      process.env.WEB_API_BASE_URL,
      process.env.NEXT_PUBLIC_API_URL,
      process.env.NEXT_PUBLIC_API_BASE_URL,
    ),
  );
}

export function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || getDefaultAppBaseUrl();
}

export function getAcarsCurrentVersion(): string {
  return process.env.NEXT_PUBLIC_ACARS_CURRENT_VERSION ?? "0.1.0";
}

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}
