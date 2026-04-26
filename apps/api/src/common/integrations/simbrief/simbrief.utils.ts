const SIMBRIEF_XML_FETCHER_URL = "https://www.simbrief.com/api/xml.fetcher.php";
const SIMBRIEF_AIRFRAME_FETCHER_URL =
  "https://www.simbrief.com/api/airframe.fetcher.php";
const SIMBRIEF_JSON_FORMAT = "v2";

export interface SimbriefFlightPlanLookup {
  pilotId: string;
  latestOfpJsonUrl: string;
  latestOfpXmlUrl: string;
  airframesJsonUrl: string;
  airframeJsonUrl: (airframeId: string) => string;
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
    airframesJsonUrl: `${SIMBRIEF_AIRFRAME_FETCHER_URL}?userid=${encodedPilotId}&json=${SIMBRIEF_JSON_FORMAT}`,
    airframeJsonUrl: (airframeId: string) =>
      `${SIMBRIEF_AIRFRAME_FETCHER_URL}?userid=${encodedPilotId}&airframe=${encodeURIComponent(
        airframeId.trim(),
      )}&json=${SIMBRIEF_JSON_FORMAT}`,
  };
}

