type DisplayIdentity = {
  firstName?: string | null | undefined;
  lastName?: string | null | undefined;
  username?: string | null | undefined;
  fallback?: string;
};

function normalizeSegment(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function buildUserDisplayName({
  firstName,
  lastName,
  username,
  fallback = "Pilote",
}: DisplayIdentity): string {
  const normalizedFirstName = normalizeSegment(firstName);
  const normalizedLastName = normalizeSegment(lastName);
  const normalizedUsername = normalizeSegment(username);

  const segments = [normalizedFirstName, normalizedLastName].filter(
    (value) => value.length > 0,
  );

  if (segments.length === 0) {
    return normalizedUsername || fallback;
  }

  const normalizedUsernameKey = normalizedUsername.toLowerCase();
  const uniqueSegmentKeys = new Set(segments.map((value) => value.toLowerCase()));
  const fullName = segments.join(" ");

  if (
    normalizedUsernameKey &&
    uniqueSegmentKeys.size === 1 &&
    uniqueSegmentKeys.has(normalizedUsernameKey)
  ) {
    return normalizedUsername;
  }

  return fullName;
}
