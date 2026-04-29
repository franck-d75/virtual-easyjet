type JsonRecord = Record<string, unknown>;

export const PRIVATE_SIMBRIEF_CONFIG_SETTING_KEY = "private_simbrief_config";

export interface PrivateSimbriefConfig {
  apiKey: string | null;
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizePrivateSimbriefConfig(
  rawValue: unknown,
): PrivateSimbriefConfig {
  if (!isJsonRecord(rawValue)) {
    return { apiKey: null };
  }

  const apiKey =
    typeof rawValue.apiKey === "string" && rawValue.apiKey.trim().length > 0
      ? rawValue.apiKey.trim()
      : null;

  return { apiKey };
}

export function maskSecret(secret: string | null | undefined): string | null {
  const normalizedSecret = secret?.trim() ?? "";

  if (normalizedSecret.length === 0) {
    return null;
  }

  if (normalizedSecret.length <= 8) {
    return `${normalizedSecret.slice(0, 2)}****`;
  }

  return `${normalizedSecret.slice(0, 4)}****${normalizedSecret.slice(-4)}`;
}
