export const ROLE_CODES = {
  ADMIN: "admin",
  STAFF: "staff",
  PILOT: "pilot",
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export const DEFAULT_ROLE_CODES: RoleCode[] = [ROLE_CODES.PILOT];
