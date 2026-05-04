import type { JSX } from "react";

import { LiveMapPanel } from "@/components/live/live-map-panel";
import { getAcarsLiveTraffic } from "@/lib/api/public";
import type { LiveMapAircraft } from "@/lib/api/types";
import { logWebError } from "@/lib/observability/log";

export const dynamic = "force-dynamic";

export default async function LiveMapPage(): Promise<JSX.Element> {
  let initialTraffic: LiveMapAircraft[] = [];
  let initialError: string | null = null;
  let initialFetchedAt: string | null = null;

  try {
    initialTraffic = await getAcarsLiveTraffic();
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
        initialTraffic={initialTraffic}
      />
    </div>
  );
}
