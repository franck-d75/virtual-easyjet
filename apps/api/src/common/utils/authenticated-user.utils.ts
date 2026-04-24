import { ForbiddenException } from "@nestjs/common";

import { ROLE_CODES, type AuthenticatedUser, type RoleCode } from "@va/shared";

const PRIVILEGED_ROLES = new Set<RoleCode>([
  ROLE_CODES.ADMIN,
  ROLE_CODES.STAFF,
]);

export function isPrivilegedUser(user: AuthenticatedUser): boolean {
  return user.roles.some((role) => PRIVILEGED_ROLES.has(role));
}

export function getRequiredPilotProfileId(user: AuthenticatedUser): string {
  if (!user.pilotProfileId) {
    throw new ForbiddenException("A pilot profile is required for this action.");
  }

  return user.pilotProfileId;
}

