import type {
  SimbriefLatestOfpResponse,
  SimbriefLatestOfpRoutePointResponse,
} from "@/lib/api/types";

export interface SimbriefRouteOverlayPoint {
  ident: string | null;
  lat: number;
  lon: number;
  source: SimbriefLatestOfpRoutePointResponse["source"];
}

export interface SimbriefRouteOverlay {
  callsign: string | null;
  flightNumber: string | null;
  departureIcao: string;
  arrivalIcao: string;
  route: string | null;
  mode: "DIRECT" | "WAYPOINTS";
  points: SimbriefRouteOverlayPoint[];
}

export function buildSimbriefRouteOverlay(
  latestOfp: SimbriefLatestOfpResponse | null | undefined,
): SimbriefRouteOverlay | null {
  if (!latestOfp || latestOfp.status !== "AVAILABLE" || !latestOfp.plan) {
    return null;
  }

  const { plan } = latestOfp;

  if (!plan.departureIcao || !plan.arrivalIcao) {
    return null;
  }

  const points = dedupePoints(
    plan.routePoints.filter(
      (point): point is SimbriefRouteOverlayPoint =>
        Number.isFinite(point.lat) && Number.isFinite(point.lon),
    ),
  );

  if (points.length < 2) {
    return null;
  }

  return {
    callsign: plan.callsign,
    flightNumber: plan.flightNumber,
    departureIcao: plan.departureIcao,
    arrivalIcao: plan.arrivalIcao,
    route: plan.route,
    mode: points.some((point) => point.source === "NAVLOG")
      ? "WAYPOINTS"
      : "DIRECT",
    points,
  };
}

function dedupePoints(
  points: SimbriefRouteOverlayPoint[],
): SimbriefRouteOverlayPoint[] {
  return points.filter((point, index) => {
    const previousPoint = points[index - 1];

    if (!previousPoint) {
      return true;
    }

    return (
      Math.abs(previousPoint.lat - point.lat) >= 0.0001 ||
      Math.abs(previousPoint.lon - point.lon) >= 0.0001
    );
  });
}
