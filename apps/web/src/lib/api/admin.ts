import { apiRequest } from "./client";
import type {
  AdminAcarsCleanupResponse,
  AdminAircraftPayload,
  AdminAircraftImportFromSimbriefAirframePayload,
  AdminAircraftLinkSimbriefAirframePayload,
  AdminAircraftTypeOptionResponse,
  AdminRulesPayload,
  AdminPirepResponse,
  AdminPirepReviewPayload,
  AdminUserDetailResponse,
  AdminUserPayload,
  AdminUserSummaryResponse,
  AdminHubPayload,
  AdminReferenceDataResponse,
  AdminRoutePayload,
  AdminStatsResponse,
  AircraftResponse,
  HubResponse,
  RulesContentResponse,
  RouteResponse,
  SimbriefAirframeResponse,
} from "./types";

export async function getAdminStats(
  accessToken: string,
): Promise<AdminStatsResponse> {
  return apiRequest<AdminStatsResponse>("/admin/stats", {
    accessToken,
    cache: "no-store",
  });
}

export async function cleanupAdminAcarsTestData(
  accessToken: string,
): Promise<AdminAcarsCleanupResponse> {
  return apiRequest<AdminAcarsCleanupResponse>(
    "/admin/acars/cleanup-test-data",
    {
      accessToken,
      method: "POST",
      body: JSON.stringify({}),
      cache: "no-store",
    },
  );
}

export async function getAdminReferenceData(
  accessToken: string,
): Promise<AdminReferenceDataResponse> {
  return apiRequest<AdminReferenceDataResponse>("/admin/reference-data", {
    accessToken,
    cache: "no-store",
  });
}

export async function initializeAdminAircraftTypes(
  accessToken: string,
): Promise<AdminReferenceDataResponse> {
  return apiRequest<AdminReferenceDataResponse>(
    "/admin/reference-data/aircraft-types/init",
    {
      accessToken,
      method: "POST",
      cache: "no-store",
    },
  );
}

export async function listAdminUsers(
  accessToken: string,
): Promise<AdminUserSummaryResponse[]> {
  return apiRequest<AdminUserSummaryResponse[]>("/admin/users", {
    accessToken,
    cache: "no-store",
  });
}

export async function listAdminPireps(
  accessToken: string,
): Promise<AdminPirepResponse[]> {
  return apiRequest<AdminPirepResponse[]>("/admin/pireps", {
    accessToken,
    cache: "no-store",
  });
}

export async function reviewAdminPirep(
  accessToken: string,
  id: string,
  payload: AdminPirepReviewPayload,
): Promise<AdminPirepResponse> {
  return apiRequest<AdminPirepResponse>(
    `/admin/pireps/${encodeURIComponent(id)}/review`,
    {
      accessToken,
      method: "PATCH",
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );
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

export async function uploadAdminUserAvatar(
  accessToken: string,
  id: string,
  payload: FormData,
): Promise<AdminUserDetailResponse> {
  return apiRequest<AdminUserDetailResponse>(
    `/admin/users/${encodeURIComponent(id)}/avatar`,
    {
      accessToken,
      method: "POST",
      body: payload,
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

export async function listAdminSimbriefAirframes(
  accessToken: string,
): Promise<SimbriefAirframeResponse[]> {
  return apiRequest<SimbriefAirframeResponse[]>("/admin/simbrief-airframes", {
    accessToken,
    cache: "no-store",
  });
}

export async function getAdminRules(
  accessToken: string,
): Promise<RulesContentResponse> {
  return apiRequest<RulesContentResponse>("/admin/rules", {
    accessToken,
    cache: "no-store",
  });
}

export async function updateAdminRules(
  accessToken: string,
  payload: AdminRulesPayload,
): Promise<RulesContentResponse> {
  return apiRequest<RulesContentResponse>("/admin/rules", {
    accessToken,
    method: "PATCH",
    body: JSON.stringify(payload),
    cache: "no-store",
  });
}

export async function listAdminAircraftTypes(
  accessToken: string,
): Promise<AdminAircraftTypeOptionResponse[]> {
  return apiRequest<AdminAircraftTypeOptionResponse[]>("/admin/aircraft-types", {
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

export async function importAdminAircraftFromSimbriefAirframe(
  accessToken: string,
  payload: AdminAircraftImportFromSimbriefAirframePayload,
): Promise<AircraftResponse> {
  return apiRequest<AircraftResponse>(
    "/admin/aircraft/import-from-simbrief-airframe",
    {
      accessToken,
      method: "POST",
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );
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

export async function linkAdminAircraftToSimbriefAirframe(
  accessToken: string,
  id: string,
  payload: AdminAircraftLinkSimbriefAirframePayload,
): Promise<AircraftResponse> {
  return apiRequest<AircraftResponse>(
    `/admin/aircraft/${encodeURIComponent(id)}/link-simbrief-airframe`,
    {
      accessToken,
      method: "PATCH",
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );
}

export async function unlinkAdminAircraftFromSimbriefAirframe(
  accessToken: string,
  id: string,
): Promise<AircraftResponse> {
  return apiRequest<AircraftResponse>(
    `/admin/aircraft/${encodeURIComponent(id)}/link-simbrief-airframe`,
    {
      accessToken,
      method: "DELETE",
      cache: "no-store",
    },
  );
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
