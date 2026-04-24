const SIMBRIEF_XML_FETCHER_URL = "https://www.simbrief.com/api/xml.fetcher.php";
const SIMBRIEF_JSON_FORMAT = "v2";

export interface SimbriefFlightPlanLookup {
  pilotId: string;
  latestOfpJsonUrl: string;
  latestOfpXmlUrl: string;
}

export function buildSimbriefFlightPlanLookup(
  pilotId: string,
): SimbriefFlightPlanLookup {
  const normalizedPilotId = pilotId.trim();
  const encodedPilotId = encodeURIComponent(normalizedPilotId);

  return {
    pilotId: normalizedPilotId,
    latestOfpJsonUrl: `${SIMBRIEF_XML_FETCHER_URL}?userid=${encodedPilotId}&json=${SIMBRIEF_JSON_FORMAT}`,
    latestOfpXmlUrl: `${SIMBRIEF_XML_FETCHER_URL}?userid=${encodedPilotId}`,
  };
}
