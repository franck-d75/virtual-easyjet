import { DEFAULT_DESKTOP_CONFIG } from "../shared/defaults.js";
import {
  getBackendModePresentation,
  getBookingStatusPresentation,
  getFlightStatusPresentation,
  getPhaseLabel,
  getPirepStatusPresentation,
  getSessionStatusPresentation,
  type PresentationTone,
} from "../shared/presentation.js";
import type {
  BookingSummary,
  DesktopBridge,
  DesktopSnapshot,
  FlightSummary,
  LoadOperationsResult,
  SessionSummary,
  SimulatorSnapshot,
  TelemetryTrackingState,
} from "../shared/types.js";

declare global {
  interface Window {
    acarsDesktop?: DesktopBridge;
  }
}

type NoticeTone = "info" | "success" | "warning" | "danger";

type UiState = {
  snapshot: DesktopSnapshot | null;
  dispatch: LoadOperationsResult | null;
  activeSession: SessionSummary | null;
  simulator: SimulatorSnapshot | null;
  tracking: TelemetryTrackingState | null;
  logs: string[];
};

const STORAGE_KEY = "va-acars:last-login";
const POLL_INTERVAL_MS = 5_000;

const state: UiState = {
  snapshot: null,
  dispatch: null,
  activeSession: null,
  simulator: null,
  tracking: null,
  logs: [],
};

let lastRendererTelemetryTimestamp: string | null = null;

const loginForm = requireElement<HTMLFormElement>("login-form");
const backendModeInput = requireElement<HTMLSelectElement>("backend-mode");
const apiBaseUrlInput = requireElement<HTMLInputElement>("api-base-url");
const acarsBaseUrlInput = requireElement<HTMLInputElement>("acars-base-url");
const identifierInput = requireElement<HTMLInputElement>("identifier");
const passwordInput = requireElement<HTMLInputElement>("password");
const logoutButton = requireElement<HTMLButtonElement>("logout-button");
const backendModeBadge = requireElement<HTMLDivElement>("backend-mode-badge");
const authBadge = requireElement<HTMLDivElement>("auth-badge");
const statusBanner = requireElement<HTMLDivElement>("status-banner");
const identityCard = requireElement<HTMLDivElement>("identity-card");
const refreshDispatchButton = requireElement<HTMLButtonElement>(
  "refresh-dispatch-button",
);
const dispatchSummary = requireElement<HTMLDivElement>("dispatch-summary");
const ofpSummary = requireElement<HTMLDivElement>("ofp-summary");
const bookingsList = requireElement<HTMLDivElement>("bookings-list");
const flightsList = requireElement<HTMLDivElement>("flights-list");
const simulatorSummary = requireElement<HTMLDivElement>("simulator-summary");
const refreshSessionButton = requireElement<HTMLButtonElement>(
  "refresh-session-button",
);
const startTrackingButton = requireElement<HTMLButtonElement>(
  "start-tracking-button",
);
const pauseTrackingButton = requireElement<HTMLButtonElement>(
  "pause-tracking-button",
);
const resumeTrackingButton = requireElement<HTMLButtonElement>(
  "resume-tracking-button",
);
const sessionSummary = requireElement<HTMLDivElement>("session-summary");
const completeSessionForm = requireElement<HTMLFormElement>(
  "complete-session-form",
);
const pirepResult = requireElement<HTMLDivElement>("pirep-result");
const activityLog = requireElement<HTMLPreElement>("activity-log");

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Element requis introuvable : #${id}.`);
  }

  return element as T;
}

function getDesktopBridge(): DesktopBridge {
  if (!window.acarsDesktop) {
    throw new Error("Bridge Electron indisponible.");
  }

  return window.acarsDesktop;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderBadge(label: string, tone: PresentationTone = "neutral"): string {
  return `<span class="badge badge--${tone}">${escapeHtml(label)}</span>`;
}

function renderToken(label: string): string {
  return `<span class="token">${escapeHtml(label)}</span>`;
}

function appendLog(message: string): void {
  const timestamp = new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  state.logs.unshift(`[${timestamp}] ${message}`);
  state.logs = state.logs.slice(0, 100);
  activityLog.textContent = state.logs.join("\n");
}

function setNotice(message: string, tone: NoticeTone = "info"): void {
  statusBanner.className = `status-banner status-banner--${tone}`;
  statusBanner.textContent = message;
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "n/d";
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime())
    ? value
    : parsedDate.toLocaleString("fr-FR");
}

function formatDuration(minutes: number | null | undefined): string {
  if (typeof minutes !== "number" || !Number.isFinite(minutes)) {
    return "n/d";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours <= 0) {
    return `${remainingMinutes} min`;
  }

  return `${hours} h ${String(remainingMinutes).padStart(2, "0")}`;
}

function getTrackingTone(status: TelemetryTrackingState["status"]): PresentationTone {
  switch (status) {
    case "RUNNING":
      return "success";
    case "PAUSED":
      return "warning";
    case "ERROR":
      return "danger";
    default:
      return "neutral";
  }
}

function getSimulatorTone(snapshot: SimulatorSnapshot | null): PresentationTone {
  if (!snapshot) {
    return "neutral";
  }

  switch (snapshot.status) {
    case "AIRCRAFT_DETECTED":
      return "success";
    case "CONNECTED":
      return "info";
    case "CONNECTING":
      return "warning";
    case "ERROR":
      return "danger";
    default:
      return "neutral";
  }
}

function getConfiguredTelemetrySource(
  snapshot: DesktopSnapshot | null,
): "mock" | "simconnect" | "fsuipc" {
  const configuredSource = snapshot?.config.telemetryMode ?? "mock";

  return configuredSource === "fsuipc" || configuredSource === "simconnect"
    ? configuredSource
    : "mock";
}

function getActiveTelemetrySource(
  snapshot: DesktopSnapshot | null,
  simulator: SimulatorSnapshot | null,
): "mock" | "simconnect" | "fsuipc" {
  if (simulator?.dataSource === "fsuipc" || simulator?.dataSource === "simconnect") {
    return simulator.dataSource;
  }

  return getConfiguredTelemetrySource(snapshot);
}

function getTelemetryStatusLabel(
  snapshot: DesktopSnapshot | null,
  simulator: SimulatorSnapshot | null,
): string {
  if (simulator?.dataSource === "fsuipc" && (simulator.connected || simulator.telemetry)) {
    return "FSUIPC live";
  }

  if (
    simulator?.dataSource === "simconnect" &&
    (simulator.connected || simulator.telemetry)
  ) {
    return "SimConnect live";
  }

  switch (getConfiguredTelemetrySource(snapshot)) {
    case "fsuipc":
      return "FSUIPC attente";
    case "simconnect":
      return "SimConnect attente";
    default:
      return "mock";
  }
}

function getSimulatorTitle(
  snapshot: DesktopSnapshot | null,
  simulator: SimulatorSnapshot | null,
): string {
  const source = getActiveTelemetrySource(snapshot, simulator);

  switch (source) {
    case "fsuipc":
      return "MSFS2024 / FSUIPC7";
    case "simconnect":
      return "MSFS2024 / SimConnect";
    default:
      return "MSFS2024 / Telemetrie";
  }
}

function getSimulatorAvailabilityLabel(snapshot: SimulatorSnapshot | null): string {
  if (!snapshot) {
    return "UNAVAILABLE";
  }

  switch (snapshot.status) {
    case "CONNECTED":
    case "AIRCRAFT_DETECTED":
      return "AVAILABLE";
    case "CONNECTING":
      return "CONNECTING";
    case "ERROR":
      return "ERROR";
    default:
      return "UNAVAILABLE";
  }
}

function getDisplayPilotName(snapshot: DesktopSnapshot | null): string {
  const pilotProfile = snapshot?.user?.pilotProfile;

  if (
    pilotProfile?.firstName &&
    pilotProfile.lastName &&
    `${pilotProfile.firstName} ${pilotProfile.lastName}`.trim().length > 0
  ) {
    return `${pilotProfile.firstName} ${pilotProfile.lastName}`;
  }

  return snapshot?.user?.username ?? "Aucun pilote";
}

function persistLoginPreferences(): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      backendMode: backendModeInput.value,
      apiBaseUrl: apiBaseUrlInput.value.trim(),
      acarsBaseUrl: acarsBaseUrlInput.value.trim(),
      identifier: identifierInput.value.trim(),
    }),
  );
}

function restoreLoginPreferences(): void {
  const rawValue = localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return;
  }

  try {
    const storedValue = JSON.parse(rawValue) as Partial<{
      backendMode: string;
      apiBaseUrl: string;
      acarsBaseUrl: string;
      identifier: string;
    }>;

    backendModeInput.value = storedValue.backendMode ?? DEFAULT_DESKTOP_CONFIG.backendMode;
    apiBaseUrlInput.value = storedValue.apiBaseUrl ?? DEFAULT_DESKTOP_CONFIG.apiBaseUrl;
    acarsBaseUrlInput.value =
      storedValue.acarsBaseUrl ?? DEFAULT_DESKTOP_CONFIG.acarsBaseUrl;
    identifierInput.value = storedValue.identifier ?? "";
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function applySnapshotDefaults(snapshot: DesktopSnapshot | null): void {
  const config = snapshot?.config ?? DEFAULT_DESKTOP_CONFIG;
  backendModeInput.value = config.backendMode;
  apiBaseUrlInput.value = config.apiBaseUrl;
  acarsBaseUrlInput.value = config.acarsBaseUrl;
}

function renderSnapshot(): void {
  const snapshot = state.snapshot;
  const simulator = state.simulator ?? snapshot?.simulator ?? null;
  const backendPresentation = getBackendModePresentation(
    snapshot?.config.backendMode ?? "live",
  );

  backendModeBadge.className = `badge badge--${backendPresentation.tone}`;
  backendModeBadge.textContent = backendPresentation.label;

  authBadge.className = snapshot?.isAuthenticated
    ? "badge badge--success"
    : "badge badge--neutral";
  authBadge.textContent = snapshot?.isAuthenticated ? "Connecte" : "Hors ligne";

  if (!snapshot?.user) {
    identityCard.innerHTML = `
      <strong>Aucun pilote charge</strong>
      <p class="helper">
        Connectez-vous avec votre compte Virtual Easyjet pour charger vos operations reelles.
      </p>
    `;
    return;
  }

  identityCard.innerHTML = `
    <div class="list-item__header">
      <div>
        <strong>${escapeHtml(getDisplayPilotName(snapshot))}</strong>
        <p class="helper">
          ${escapeHtml(snapshot.user.email)} · numero pilote ${
            escapeHtml(snapshot.user.pilotProfile?.pilotNumber ?? "n/d")
          }
        </p>
      </div>
      ${renderBadge("Pilote connecte", "success")}
    </div>
    <div class="token-row">
      ${renderToken(`Utilisateur: ${snapshot.user.username}`)}
      ${renderToken(`SimBrief Pilot ID: ${snapshot.user.pilotProfile?.simbriefPilotId ?? "non renseigne"}`)}
      ${renderToken(`Telemetrie: ${getTelemetryStatusLabel(snapshot, simulator)}`)}
      ${renderToken(`Simulateur: ${getSimulatorTitle(snapshot, simulator)}`)}
    </div>
  `;
}

function renderOperations(): void {
  const dispatch = state.dispatch;

  if (!dispatch) {
    dispatchSummary.innerHTML = `
      <div class="empty-state">
        Connectez-vous puis chargez vos operations pour voir reservations, OFP et vols exploitables.
      </div>
    `;
    ofpSummary.innerHTML = "";
    bookingsList.innerHTML = "";
    flightsList.innerHTML = "";
    return;
  }

  dispatchSummary.innerHTML = `
    <div class="summary-grid">
      <div class="metric">
        <span class="metric-label">Reservations</span>
        <span class="metric-value">${dispatch.bookings.length}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Vols exploitables</span>
        <span class="metric-value">${dispatch.usableFlights.length}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Numero pilote</span>
        <span class="metric-value">${escapeHtml(dispatch.pilotProfile?.pilotNumber ?? "n/d")}</span>
      </div>
      <div class="metric">
        <span class="metric-label">SimBrief</span>
        <span class="metric-value">${escapeHtml(dispatch.pilotProfile?.simbriefPilotId ?? "n/d")}</span>
      </div>
    </div>
  `;

  ofpSummary.innerHTML = dispatch.latestOfp
    ? `
      <article class="list-item">
        <div class="list-item__header">
          <div>
            <strong>${escapeHtml(dispatch.latestOfp.flightNumber ?? dispatch.latestOfp.callsign ?? "Dernier OFP")}</strong>
            <p class="helper">
              ${escapeHtml(dispatch.latestOfp.departureIcao ?? "----")} -> ${escapeHtml(dispatch.latestOfp.arrivalIcao ?? "----")} ·
              ${escapeHtml(dispatch.latestOfp.aircraft?.icaoCode ?? "type n/d")}
            </p>
          </div>
          ${renderBadge(dispatch.latestOfp.status, dispatch.latestOfp.status === "AVAILABLE" ? "success" : "warning")}
        </div>
        <div class="meta-row">
          ${renderToken(`Route: ${dispatch.latestOfp.route ?? "n/d"}`)}
          ${renderToken(`Distance: ${dispatch.latestOfp.distanceNm ?? "n/d"} NM`)}
          ${renderToken(`Block time: ${formatDuration(dispatch.latestOfp.blockTimeMinutes)}`)}
          ${renderToken(`ETE: ${dispatch.latestOfp.estimatedTimeEnroute ?? "n/d"}`)}
        </div>
      </article>
    `
    : `
      <div class="empty-state">
        Aucun OFP SimBrief exploitable n'est charge pour ce pilote.
      </div>
    `;

  renderBookings(dispatch.bookings);
  renderFlights(dispatch.flights);
}

function renderBookings(bookings: BookingSummary[]): void {
  if (bookings.length === 0) {
    bookingsList.innerHTML = `<div class="empty-state">Aucune reservation active.</div>`;
    return;
  }

  bookingsList.innerHTML = bookings
    .map((booking) => {
      const status = getBookingStatusPresentation(booking.status);
      const canCreateFlight =
        booking.status === "RESERVED" && booking.flight === null;

      return `
        <article class="list-item">
          <div class="list-item__header">
            <div>
              <strong>${escapeHtml(booking.reservedFlightNumber)}</strong>
              <p class="helper">
                ${escapeHtml(booking.departureAirport.icao)} -> ${escapeHtml(booking.arrivalAirport.icao)} ·
                ${escapeHtml(booking.aircraft.registration)}
              </p>
            </div>
            ${renderBadge(status.label, status.tone)}
          </div>
          <div class="meta-row">
            ${renderToken(`Depart prevu: ${formatDate(booking.bookedFor)}`)}
            ${renderToken(`Appareil: ${booking.aircraft.aircraftType.icaoCode}`)}
          </div>
          <div class="button-row">
            ${
              canCreateFlight
                ? `<button class="button button--secondary" type="button" data-action="create-flight" data-booking-id="${escapeHtml(booking.id)}">Creer le vol</button>`
                : renderToken(booking.flight ? "Vol deja cree" : "Reservation non exploitable")
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function renderFlights(flights: FlightSummary[]): void {
  if (flights.length === 0) {
    flightsList.innerHTML = `<div class="empty-state">Aucun vol exploitable n'est charge.</div>`;
    return;
  }

  flightsList.innerHTML = flights
    .map((flight) => {
      const status = getFlightStatusPresentation(flight.status);

      return `
        <article class="list-item">
          <div class="list-item__header">
            <div>
              <strong>${escapeHtml(flight.flightNumber)}</strong>
              <p class="helper">
                ${escapeHtml(flight.departureAirport.icao)} -> ${escapeHtml(flight.arrivalAirport.icao)} ·
                ${escapeHtml(flight.aircraft.registration)}
              </p>
            </div>
            ${renderBadge(status.label, status.tone)}
          </div>
          <div class="meta-row">
            ${renderToken(`Reservation: ${flight.booking.status}`)}
            ${
              flight.acarsSession
                ? renderToken(`Session ACARS: ${flight.acarsSession.detectedPhase}`)
                : renderToken("Session ACARS: aucune")
            }
          </div>
          <div class="button-row">
            ${
              flight.acarsSession
                ? `<button class="button button--secondary" type="button" data-action="open-session" data-session-id="${escapeHtml(flight.acarsSession.id)}">Ouvrir la session</button>`
                : `<button class="button button--primary" type="button" data-action="start-flight" data-flight-id="${escapeHtml(flight.id)}">Start Flight</button>`
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSimulator(): void {
  const simulator = state.simulator;

  if (!simulator) {
    simulatorSummary.innerHTML = `
      <div class="empty-state">
        Le statut du simulateur sera visible ici apres initialisation du client.
      </div>
    `;
    return;
  }

  simulatorSummary.innerHTML = `
    <div class="list-item__header">
      <div>
        <strong>${escapeHtml(getSimulatorTitle(state.snapshot, simulator))}</strong>
        <p class="helper">${escapeHtml(simulator.message)}</p>
      </div>
      ${renderBadge(getSimulatorAvailabilityLabel(simulator), getSimulatorTone(simulator))}
    </div>
    <div class="summary-grid">
      <div class="metric">
        <span class="metric-label">FSUIPC detecte</span>
        <span class="metric-value">${simulator.dataSource === "fsuipc" && simulator.connected ? "Oui" : "Non"}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Appareil detecte</span>
        <span class="metric-value">${escapeHtml(
          simulator.aircraft?.displayName ??
            simulator.aircraft?.title ??
            simulator.aircraft?.model ??
            "n/d",
        )}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Type ICAO</span>
        <span class="metric-value">${escapeHtml(simulator.aircraft?.icaoCode ?? "n/d")}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Immatriculation reelle</span>
        <span class="metric-value">${escapeHtml(simulator.aircraft?.registration ?? "n/d")}</span>
      </div>
      <div class="metric">
        <span class="metric-label">ATC ID</span>
        <span class="metric-value">${escapeHtml(simulator.aircraft?.atcId ?? "n/d")}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Livree / variation</span>
        <span class="metric-value">${escapeHtml(simulator.aircraft?.liveryName ?? "n/d")}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Cap</span>
        <span class="metric-value">${simulator.telemetry?.headingDeg ?? "n/d"}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Altitude</span>
        <span class="metric-value">${simulator.telemetry?.altitudeFt ?? "n/d"}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Vitesse sol</span>
        <span class="metric-value">${simulator.telemetry?.groundspeedKts ?? "n/d"}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Vitesse indiquee</span>
        <span class="metric-value">${simulator.indicatedAirspeedKts ?? "n/d"}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Au sol</span>
        <span class="metric-value">${simulator.telemetry ? (simulator.telemetry.onGround ? "Oui" : "Non") : "n/d"}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Dernier echantillon</span>
        <span class="metric-value">${escapeHtml(formatDate(simulator.lastSampleAt))}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Derniere erreur</span>
        <span class="metric-value">${escapeHtml(simulator.error ?? "Aucune")}</span>
      </div>
    </div>
  `;
}

function renderSession(): void {
  const session = state.activeSession;
  const tracking = state.tracking;

  if (!session) {
    sessionSummary.innerHTML = `
      <div class="empty-state">
        Aucun vol actif. Chargez une reservation, creez un vol, puis ouvrez une session ACARS.
      </div>
    `;
    pirepResult.innerHTML = "Aucun PIREP disponible.";
    updateActionState();
    return;
  }

  const sessionPresentation = getSessionStatusPresentation(session.status);

  sessionSummary.innerHTML = `
    <div class="list-item__header">
      <div>
        <strong>${escapeHtml(session.flight.flightNumber)}</strong>
        <p class="helper">
          ${escapeHtml(session.flight.departureAirport.icao)} -> ${escapeHtml(session.flight.arrivalAirport.icao)} ·
          ${escapeHtml(session.flight.aircraft.registration)}
        </p>
      </div>
      ${renderBadge(sessionPresentation.label, sessionPresentation.tone)}
    </div>
    <div class="meta-row">
      ${renderBadge(getPhaseLabel(session.detectedPhase), "info")}
      ${renderBadge(tracking?.status ?? "IDLE", getTrackingTone(tracking?.status ?? "IDLE"))}
      ${renderToken(`Derniere telemetrie: ${formatDate(session.lastTelemetryAt)}`)}
      ${renderToken(`Dernier envoi: ${formatDate(tracking?.lastSentAt)}`)}
    </div>
    <div class="summary-grid">
      <div class="metric">
        <span class="metric-label">Latitude</span>
        <span class="metric-value">${session.currentPosition.latitude ?? "n/d"}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Longitude</span>
        <span class="metric-value">${session.currentPosition.longitude ?? "n/d"}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Altitude</span>
        <span class="metric-value">${session.currentPosition.altitudeFt ?? "n/d"}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Vitesse sol</span>
        <span class="metric-value">${session.currentPosition.groundspeedKts ?? "n/d"}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Carburant depart</span>
        <span class="metric-value">${session.fuel.departureFuelKg ?? "n/d"}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Carburant arrivee</span>
        <span class="metric-value">${session.fuel.arrivalFuelKg ?? "n/d"}</span>
      </div>
    </div>
    ${
      tracking?.lastError
        ? `<p class="inline-feedback inline-feedback--danger">${escapeHtml(tracking.lastError)}</p>`
        : ""
    }
  `;

  if (session.pirep) {
    const pirepPresentation = getPirepStatusPresentation(session.pirep.status);

    pirepResult.innerHTML = `
      <div class="list-item__header">
        <div>
          <strong>PIREP cree</strong>
          <p class="helper">Soumis le ${formatDate(session.pirep.submittedAt)}</p>
        </div>
        ${renderBadge(pirepPresentation.label, pirepPresentation.tone)}
      </div>
    `;
  } else {
    pirepResult.innerHTML = `
      <strong>Aucun PIREP disponible</strong>
      <p class="helper">
        Terminez le vol pour envoyer le PIREP reel au backend Virtual Easyjet.
      </p>
    `;
  }

  updateActionState();
}

function updateActionState(): void {
  const authenticated = Boolean(state.snapshot?.isAuthenticated);
  const hasSession = Boolean(state.activeSession);
  const trackingStatus = state.tracking?.status ?? "IDLE";
  const canOperate = authenticated && hasSession;

  refreshDispatchButton.disabled = !authenticated;
  refreshSessionButton.disabled = !canOperate;
  startTrackingButton.disabled = !canOperate || trackingStatus === "RUNNING";
  pauseTrackingButton.disabled = !canOperate || trackingStatus !== "RUNNING";
  resumeTrackingButton.disabled = !canOperate || trackingStatus !== "PAUSED";

  const completeControls = completeSessionForm.querySelectorAll<
    HTMLTextAreaElement | HTMLButtonElement
  >("textarea, button");
  completeControls.forEach((element) => {
    element.disabled = !canOperate;
  });
}

function applySimulatorUpdate(simulator: SimulatorSnapshot): void {
  state.simulator = simulator;

  if (
    simulator.telemetry &&
    simulator.lastSampleAt &&
    simulator.lastSampleAt !== lastRendererTelemetryTimestamp
  ) {
    lastRendererTelemetryTimestamp = simulator.lastSampleAt;
    console.info("[renderer] Renderer received telemetry", {
      dataSource: simulator.dataSource,
      lastSampleAt: simulator.lastSampleAt,
      altitudeFt: simulator.telemetry.altitudeFt,
      groundspeedKts: simulator.telemetry.groundspeedKts,
      headingDeg: simulator.telemetry.headingDeg,
      aircraftDisplayName: simulator.aircraft?.displayName ?? null,
      aircraftIcao: simulator.aircraft?.icaoCode ?? null,
      aircraftLivery: simulator.aircraft?.liveryName ?? null,
      registration: simulator.aircraft?.registration ?? null,
      atcId: simulator.aircraft?.atcId ?? null,
      registrationSource: simulator.aircraft?.registrationSource ?? null,
    });
  }

  renderSnapshot();
  renderSimulator();
}

async function refreshRuntimeState(): Promise<void> {
  const bridge = getDesktopBridge();
  state.snapshot = await bridge.getSnapshot();
  applySimulatorUpdate(await bridge.getSimulatorSnapshot());
  state.tracking = await bridge.getTrackingState();

  const sessionId =
    state.tracking.activeSessionId ?? state.activeSession?.id ?? null;

  if (sessionId) {
    try {
      state.activeSession = await bridge.getSession(sessionId);
    } catch {
      state.activeSession = null;
    }
  }

  renderSession();
}

async function handleLogin(): Promise<void> {
  const snapshot = await getDesktopBridge().login({
    backendMode: backendModeInput.value === "mock" ? "mock" : "live",
    apiBaseUrl: apiBaseUrlInput.value,
    acarsBaseUrl: acarsBaseUrlInput.value,
    identifier: identifierInput.value,
    password: passwordInput.value,
  });

  state.snapshot = snapshot;
  state.dispatch = null;
  state.activeSession = null;
  passwordInput.value = "";

  persistLoginPreferences();
  await refreshRuntimeState();
  appendLog(`Connexion ouverte pour ${snapshot.user?.username ?? "pilote"}.`);
  setNotice("Connexion reussie. Chargez maintenant vos operations reelles.", "success");
}

async function handleLogout(): Promise<void> {
  state.snapshot = await getDesktopBridge().logout();
  state.dispatch = null;
  state.activeSession = null;
  await refreshRuntimeState();
  appendLog("Session desktop fermee.");
  setNotice("Session desktop fermee.", "info");
}

async function loadDispatch(): Promise<void> {
  state.dispatch = await getDesktopBridge().loadDispatchData();
  renderOperations();
  appendLog("Operations pilote rechargees.");
  setNotice("Reservations, OFP et vols charges.", "success");
}

async function createFlightFromBooking(bookingId: string): Promise<void> {
  const flight = await getDesktopBridge().createFlightFromBooking(bookingId);
  appendLog(`Vol ${flight.flightNumber} cree depuis la reservation.`);
  setNotice("Le vol a ete cree. Vous pouvez maintenant demarrer la session ACARS.", "success");
  await loadDispatch();
}

async function createSession(flightId: string): Promise<void> {
  state.activeSession = await getDesktopBridge().createSession(flightId);
  state.tracking = await getDesktopBridge().getTrackingState();
  renderSession();
  appendLog(`Session ACARS ${state.activeSession.id} ouverte.`);
  setNotice("Session ACARS ouverte. Le suivi live est pret.", "success");
  await loadDispatch();
}

async function openSession(sessionId: string): Promise<void> {
  state.activeSession = await getDesktopBridge().getSession(sessionId);
  state.tracking = await getDesktopBridge().getTrackingState();
  renderSession();
  appendLog(`Session ${sessionId} rechargee.`);
  setNotice("Session ACARS rechargee.", "info");
}

async function refreshSession(): Promise<void> {
  if (!state.activeSession) {
    return;
  }

  state.activeSession = await getDesktopBridge().getSession(state.activeSession.id);
  state.tracking = await getDesktopBridge().getTrackingState();
  renderSession();
  appendLog(`Session ${state.activeSession.id} rafraichie.`);
  setNotice("Session rafraichie.", "info");
}

async function startTracking(): Promise<void> {
  if (!state.activeSession) {
    throw new Error("Aucune session active a suivre.");
  }

  state.tracking = await getDesktopBridge().startSessionTracking(state.activeSession.id);
  await refreshRuntimeState();
  appendLog("Suivi live demarre.");
  setNotice("Le suivi live ACARS tourne maintenant sur la telemetrie MSFS2024.", "success");
}

async function pauseTracking(): Promise<void> {
  state.tracking = await getDesktopBridge().pauseSessionTracking();
  renderSession();
  appendLog("Suivi ACARS mis en pause.");
  setNotice("Le suivi live est en pause.", "warning");
}

async function resumeTracking(): Promise<void> {
  state.tracking = await getDesktopBridge().resumeSessionTracking();
  await refreshRuntimeState();
  appendLog("Suivi ACARS repris.");
  setNotice("Le suivi live ACARS a repris.", "success");
}

async function completeSession(): Promise<void> {
  if (!state.activeSession) {
    throw new Error("Aucune session ACARS active.");
  }

  const pilotComment = String(
    new FormData(completeSessionForm).get("pilotComment") ?? "",
  );
  state.activeSession = await getDesktopBridge().completeSession(
    state.activeSession.id,
    pilotComment,
  );
  state.tracking = await getDesktopBridge().getTrackingState();
  renderSession();
  appendLog(`Session ${state.activeSession.id} finalisee.`);
  setNotice("Vol cloture. Le PIREP reel a ete prepare.", "success");
  await loadDispatch();
}

async function runSafely(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur desktop inattendue.";
    appendLog(`Erreur: ${message}`);
    setNotice(message, "danger");
  }
}

function bindEvents(): void {
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void runSafely(handleLogin);
  });

  logoutButton.addEventListener("click", () => {
    void runSafely(handleLogout);
  });

  refreshDispatchButton.addEventListener("click", () => {
    void runSafely(loadDispatch);
  });

  bookingsList.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest<HTMLButtonElement>("button[data-action]");

    if (!button || !button.dataset.bookingId) {
      return;
    }

    if (button.dataset.action === "create-flight") {
      void runSafely(() => createFlightFromBooking(button.dataset.bookingId as string));
    }
  });

  flightsList.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest<HTMLButtonElement>("button[data-action]");

    if (!button) {
      return;
    }

    if (button.dataset.action === "start-flight" && button.dataset.flightId) {
      void runSafely(() => createSession(button.dataset.flightId as string));
    }

    if (button.dataset.action === "open-session" && button.dataset.sessionId) {
      void runSafely(() => openSession(button.dataset.sessionId as string));
    }
  });

  refreshSessionButton.addEventListener("click", () => {
    void runSafely(refreshSession);
  });

  startTrackingButton.addEventListener("click", () => {
    void runSafely(startTracking);
  });

  pauseTrackingButton.addEventListener("click", () => {
    void runSafely(pauseTracking);
  });

  resumeTrackingButton.addEventListener("click", () => {
    void runSafely(resumeTracking);
  });

  completeSessionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void runSafely(completeSession);
  });
}

async function bootstrap(): Promise<void> {
  applySnapshotDefaults(null);
  restoreLoginPreferences();
  bindEvents();
  getDesktopBridge().onSimulatorUpdate((simulator) => {
    applySimulatorUpdate(simulator);
  });
  await refreshRuntimeState();
  renderOperations();
  updateActionState();

  window.setInterval(() => {
    void runSafely(refreshRuntimeState);
  }, POLL_INTERVAL_MS);

  appendLog("Client ACARS initialise.");
  setNotice(
    "Client ACARS pret. Connectez-vous puis chargez vos operations pour lancer un vol reel.",
    "info",
  );
}

void bootstrap();
