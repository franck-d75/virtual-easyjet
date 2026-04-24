import type { JSX } from "react";

import { LiveMapPanel } from "@/components/live/live-map-panel";
import { getAcarsLiveTraffic } from "@/lib/api/public";
import { getMyLatestSimbriefOfp } from "@/lib/api/pilot";
import type { LiveMapAircraft } from "@/lib/api/types";
import { getServerSession } from "@/lib/auth/session";
import { logWebError } from "@/lib/observability/log";
import {
  buildSimbriefRouteOverlay,
  type SimbriefRouteOverlay,
} from "@/lib/utils/simbrief-route";

export const dynamic = "force-dynamic";

export default async function LiveMapPage(): Promise<JSX.Element> {
  let initialTraffic: LiveMapAircraft[] = [];
  let initialError: string | null = null;
  let initialFetchedAt: string | null = null;
  let initialSimbriefRoute: SimbriefRouteOverlay | null = null;

  try {
    const session = await getServerSession();
    const [traffic, latestOfp] = await Promise.all([
      getAcarsLiveTraffic(),
      session?.accessToken
        ? getMyLatestSimbriefOfp(session.accessToken).catch((error) => {
            logWebError("live map SimBrief lookup failed", error);
            return null;
          })
        : Promise.resolve(null),
    ]);

    initialTraffic = traffic;
    initialSimbriefRoute = buildSimbriefRouteOverlay(latestOfp);
    initialFetchedAt = new Date().toISOString();
  } catch (error) {
    logWebError("live map page failed", error);
    initialError =
      "Le flux ACARS live n’a pas pu être chargé lors du premier affichage.";
  }

  return (
    <div className="live-map-page">
      <LiveMapPanel
        initialError={initialError}
        initialFetchedAt={initialFetchedAt}
        initialSimbriefRoute={initialSimbriefRoute}
        initialTraffic={initialTraffic}
      />
    </div>
  );
}
