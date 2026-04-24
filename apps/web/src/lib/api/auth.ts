import type { AuthSession } from "@va/shared";

import { apiRequest } from "./client";
import type { UserMeResponse } from "./types";

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  countryCode?: string;
}

export interface RefreshPayload {
  refreshToken: string;
}

export async function registerWithBackend(
  payload: RegisterPayload,
): Promise<AuthSession> {
  return apiRequest<AuthSession>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

export async function loginWithBackend(
  payload: LoginPayload,
): Promise<AuthSession> {
  return apiRequest<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

export async function refreshWithBackend(
  payload: RefreshPayload,
): Promise<AuthSession> {
  return apiRequest<AuthSession>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

export async function logoutWithBackend(
  payload: RefreshPayload,
): Promise<{ success: true }> {
  return apiRequest<{ success: true }>("/auth/logout", {
    method: "POST",
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

export async function fetchAuthenticatedUser(
  accessToken: string,
): Promise<UserMeResponse> {
  return apiRequest<UserMeResponse>("/auth/me", {
    accessToken,
    cache: "no-store",
  });
}
