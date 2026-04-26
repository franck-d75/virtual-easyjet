# ACARS MSFS2024 Preparation

This document defines the production target for the real Virtual Easyjet ACARS desktop client connected to Microsoft Flight Simulator 2024 through SimConnect.

## Production policy

Production must never rely on mock ACARS data.

That means:

- no fake ACARS session in the production seed
- no fake telemetry in the production seed
- no fake live traffic on `/live-map`
- no fake PIREPs in production bootstrap

The current platform is already ready to stay empty and operational while the real desktop client is completed.

## Real ACARS target flow

The real desktop client is expected to follow this sequence:

1. Authenticate with the pilot account.
2. Load the pilot reservations and canonical flights.
3. Start one ACARS session for the selected flight.
4. Connect to MSFS2024 through SimConnect.
5. Read live telemetry from the simulator.
6. Send telemetry periodically to the ACARS backend.
7. Display the aircraft on `/live-map`.
8. Complete the session at the end of the flight.
9. Generate or prefill a real PIREP.

## SimConnect telemetry scope

The desktop client should be prepared to read these values from MSFS2024:

- latitude
- longitude
- altitude
- ground speed
- heading
- vertical speed
- on-ground state
- parking brake
- transponder if available
- total fuel if available
- active aircraft or airframe if available

These values already map naturally to the ACARS telemetry payload used by the backend.

## Existing backend endpoints for the real client

Authentication and pilot data:

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/bookings/me`
- `GET /api/flights/me`
- `GET /api/pilot-profiles/me`

ACARS session lifecycle:

- `POST /acars/sessions`
- `GET /acars/sessions/:id`
- `POST /acars/sessions/:id/telemetry`
- `POST /acars/sessions/:id/complete`

Public live tracking:

- `GET /api/acars/live`
- `GET /api/public/acars/live` through the web proxy

These endpoints are the production contract the real desktop client should use.

## Expected telemetry payload

The ACARS backend already expects telemetry shaped like:

```json
{
  "capturedAt": "2026-04-26T12:30:00.000Z",
  "latitude": 48.9967,
  "longitude": 2.5478,
  "altitudeFt": 12000,
  "groundspeedKts": 285,
  "headingDeg": 270,
  "verticalSpeedFpm": 1800,
  "onGround": false,
  "fuelTotalKg": 5400,
  "gearPercent": 0,
  "flapsPercent": 0,
  "parkingBrake": false
}
```

## Flight phases

The backend already supports a flight phase model that can drive the live map and future desktop UX:

- `PRE_FLIGHT`
- `DEPARTURE_PARKING`
- `PUSHBACK`
- `TAXI_OUT`
- `TAKEOFF`
- `CLIMB`
- `CRUISE`
- `DESCENT`
- `APPROACH`
- `LANDING`
- `TAXI_IN`
- `ARRIVAL_PARKING`
- `COMPLETED`

The current production requirement is simple:

- live map must stay visible even when no traffic exists
- production must not inject mock traffic

## SimBrief operational scope

SimBrief support already exists on the web side for:

- storing `simbriefPilotId` in the pilot profile
- fetching the latest OFP
- showing a summary in the pilot area
- matching an OFP against bookings and flights
- drawing the SimBrief route overlay on `/live-map`

The next operational step for the real desktop client is:

- load the pilot SimBrief context from the existing profile
- let the pilot use the OFP as the basis for a real reservation or rotation
- keep the app stable when no OFP exists

The production reference workflow is:

1. Store the real SimBrief Pilot ID in the pilot profile.
2. Fetch the latest OFP from SimBrief.
3. Read the OFP flight number, departure, arrival, route, aircraft ICAO, callsign,
   fuel, payload, distance and estimated block time.
4. Match the OFP aircraft ICAO against the production `AircraftType` reference
   catalog.
5. If the aircraft type is missing, create it as reference data only. Do not
   create a fake route, fake aircraft or fake booking.
6. Create or select the real booking or rotation that will be flown.
7. Start the ACARS session from the real desktop client and send live telemetry.

## Airframes and future mapping

Future production support should add explicit SimBrief airframe mapping:

- store SimBrief airframes per pilot or per airline
- associate a SimBrief airframe with a VA aircraft type or fleet entry
- use that mapping to create or validate flights imported from SimBrief

Recommended airframe fields:

- SimBrief airframe ID
- display name
- aircraft ICAO
- linked `AircraftType` ID
- optional owner pilot profile
- optional company-level scope

No fake airframes should be seeded in production.

## Recommended production desktop configuration

When the real desktop client is packaged for production, it should use:

- API base URL: `https://api.virtual-easyjet.fr/api`
- ACARS base URL: `https://api.virtual-easyjet.fr/acars` or the public ACARS service base URL in use
- backend mode: `live`
- simulator provider: `MSFS2024_SIMCONNECT`

## Current readiness

Already production-safe today:

- empty public platform with no demo traffic
- live map with zero-traffic fallback
- public ACARS page and download
- pilot profile SimBrief ID support
- SimBrief route overlay on the live map
- ACARS backend endpoints and session model

Still to complete in the desktop client:

- real SimConnect integration for MSFS2024
- non-mock telemetry capture loop
- production-ready desktop packaging with the real client binary
