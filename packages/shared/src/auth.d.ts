import type { RoleCode } from "./roles.js";
export interface AccessTokenPayload {
    sub: string;
    email: string;
    username: string;
    roles: RoleCode[];
    pilotProfileId?: string;
    type: "access";
}
export interface RefreshTokenPayload {
    sub: string;
    tokenFamily: string;
    type: "refresh";
}
export interface AuthenticatedUser {
    id: string;
    email: string;
    username: string;
    roles: RoleCode[];
    pilotProfileId?: string;
}
export interface AuthenticatedPilotProfileSummary {
    id: string;
    pilotNumber: string;
    firstName: string;
    lastName: string;
    status: string;
    rankId: string | null;
    hubId: string | null;
}
export interface AuthSessionUser extends AuthenticatedUser {
    pilotProfile: AuthenticatedPilotProfileSummary | null;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn: string;
    refreshTokenExpiresIn: string;
}
export interface AuthSession {
    user: AuthSessionUser;
    tokens: AuthTokens;
}
