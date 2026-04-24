import { apiRequest } from "./client";
import type {
  AdminAircraftPayload,
  AdminUserDetailResponse,
  AdminUserPayload,
  AdminUserSummaryResponse,
  AdminHubPayload,
  AdminReferenceDataResponse,
  AdminRoutePayload,
  AdminStatsResponse,
  AircraftResponse,
  HubResponse,
  RouteResponse,
} from "./types";

export async function getAdminStats(
  accessToken: string,
): Promise<AdminStatsResponse> {
  return apiRequest<AdminStatsResponse>("/admin/stats", {
    accessToken,
    cache: "no-store",
  });
}

export async function getAdminReferenceData(
  accessToken: string,
): Promise<AdminReferenceDataResponse> {
  return apiRequest<AdminReferenceDataResponse>("/admin/reference-data", {
    accessToken,
    cache: "no-store",
  });
}

export async function listAdminUsers(
  accessToken: string,
): Promise<AdminUserSummaryResponse[]> {
  return apiRequest<AdminUserSummaryResponse[]>("/admin/users", {
    accessToken,
    cache: "no-store",
  });
}

export async function getAdminUser(
  accessToken: string,
  id: string,
): Promise<AdminUserDetailResponse> {
  return apiRequest<AdminUserDetailResponse>(`/admin/users/${encodeURIComponent(id)}`, {
    accessToken,
    cache: "no-store",
  });
}

export async function updateAdminUser(
  accessToken: string,
  id: string,
  payload: AdminUserPayload,
): Promise<AdminUserDetailResponse> {
  return apiRequest<AdminUserDetailResponse>(`/admin/users/${encodeURIComponent(id)}`, {
    accessToken,
    method: "PATCH",
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

export async function suspendAdminUser(
  accessToken: string,
  id: string,
): Promise<AdminUserDetailResponse> {
  return apiRequest<AdminUserDetailResponse>(
    `/admin/users/${encodeURIComponent(id)}/suspend`,
    {
      accessToken,
      method: "PATCH",
      cache: "no-store",
    },
  );
}

export async function activateAdminUser(
  accessToken: string,
  id: string,
): Promise<AdminUserDetailResponse> {
  return apiRequest<AdminUserDetailResponse>(
    `/admin/users/${encodeURIComponent(id)}/activate`,
    {
      accessToken,
      method: "PATCH",
      cache: "no-store",
    },
  );
}

export async function listAdminAircraft(
  accessToken: string,
): Promise<AircraftResponse[]> {
  return apiRequest<AircraftResponse[]>("/admin/aircraft", {
    accessToken,
    cache: "no-store",
  });
}

export async function createAdminAircraft(
  accessToken: string,
  payload: AdminAircraftPayload,
): Promise<AircraftResponse> {
  return apiRequest<AircraftResponse>("/admin/aircraft", {
    accessToken,
    method: "POST",
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

export async function updateAdminAircraft(
  accessToken: string,
  id: string,
  payload: Partial<AdminAircraftPayload>,
): Promise<AircraftResponse> {
  return apiRequest<AircraftResponse>(`/admin/aircraft/${encodeURIComponent(id)}`, {
    accessToken,
    method: "PATCH",
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

export async function deleteAdminAircraft(
  accessToken: string,
  id: string,
): Promise<{ success: true }> {
  return apiRequest<{ success: true }>(`/admin/aircraft/${encodeURIComponent(id)}`, {
    accessToken,
    method: "DELETE",
    cache: "no-store",
  });
}

export async function listAdminHubs(accessToken: string): Promise<HubResponse[]> {
  return apiRequest<HubResponse[]>("/admin/hubs", {
    accessToken,
    cache: "no-store",
  });
}

export async function createAdminHub(
  accessToken: string,
  payload: AdminHubPayload,
): Promise<HubResponse> {
  return apiRequest<HubResponse>("/admin/hubs", {
    accessToken,
    method: "POST",
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

export async function updateAdminHub(
  accessToken: string,
  id: string,
  payload: Partial<AdminHubPayload>,
): Promise<HubResponse> {
  return apiRequest<HubResponse>(`/admin/hubs/${encodeURIComponent(id)}`, {
    accessToken,
    method: "PATCH",
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

export async function deleteAdminHub(
  accessToken: string,
  id: string,
): Promise<{ success: true }> {
  return apiRequest<{ success: true }>(`/admin/hubs/${encodeURIComponent(id)}`, {
    accessToken,
    method: "DELETE",
    cache: "no-store",
  });
}

export async function listAdminRoutes(
  accessToken: string,
): Promise<RouteResponse[]> {
  return apiRequest<RouteResponse[]>("/admin/routes", {
    accessToken,
    cache: "no-store",
  });
}

export async function createAdminRoute(
  accessToken: string,
  payload: AdminRoutePayload,
): Promise<RouteResponse> {
  return apiRequest<RouteResponse>("/admin/routes", {
    accessToken,
    method: "POST",
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

export async function updateAdminRoute(
  accessToken: string,
  id: string,
  payload: Partial<AdminRoutePayload>,
): Promise<RouteResponse> {
  return apiRequest<RouteResponse>(`/admin/routes/${encodeURIComponent(id)}`, {
    accessToken,
    method: "PATCH",
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

export async function deleteAdminRoute(
  accessToken: string,
  id: string,
): Promise<{ success: true }> {
  return apiRequest<{ success: true }>(`/admin/routes/${encodeURIComponent(id)}`, {
    accessToken,
    method: "DELETE",
    cache: "no-store",
  });
}
