import {
  DEFAULT_DESKTOP_CONFIG,
  DEFAULT_MANUAL_TELEMETRY,
} from "../shared/defaults.js";
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
  BackendMode,
  BookingSummary,
  DesktopBridge,
  DesktopSnapshot,
  FlightSummary,
  LoadOperationsResult,
  MockProgress,
  SessionSummary,
  TelemetryInput,
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
  lastMockProgress: MockProgress | null;
  logs: string[];
};

const STORAGE_KEY = "va-acars-desktop:last-login";

const state: UiState = {
  snapshot: null,
  dispatch: null,
  activeSession: null,
  lastMockProgress: null,
  logs: [],
};

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
const bookingsList = requireElement<HTMLDivElement>("bookings-list");
const flightsList = requireElement<HTMLDivElement>("flights-list");
const refreshSessionButton = requireElement<HTMLButtonElement>(
  "refresh-session-button",
);
const nextMockStepButton = requireElement<HTMLButtonElement>(
  "next-mock-step-button",
);
const resetMockSequenceButton = requireElement<HTMLButtonElement>(
  "reset-mock-sequence-button",
);
const sessionSummary = requireElement<HTMLDivElement>("session-summary");
const manualTelemetryForm = requireElement<HTMLFormElement>(
  "manual-telemetry-form",
);
const completeSessionForm = requireElement<HTMLFormElement>(
  "complete-session-form",
);
const pirepResult = requireElement<HTMLDivElement>("pirep-result");
const activityLog = requireElement<HTMLPreElement>("activity-log");

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Élément requis introuvable : #${id}.`);
  }

  return element as T;
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
  state.logs = state.logs.slice(0, 50);
  activityLog.textContent = state.logs.join("\n");
}

function getDesktopBridge(): DesktopBridge {
  const bridge = window.acarsDesktop;

  if (!bridge) {
    console.error("[renderer] window.acarsDesktop is undefined.", {
      hasAcarsDesktop: false,
      windowKeys: Object.keys(window).filter((key) =>
        key.toLowerCase().includes("acars"),
      ),
    });

    throw new Error(
      "Bridge Electron indisponible. Vérifiez le chemin du preload et l’exposition du contextBridge.",
    );
  }

  if (typeof bridge.login !== "function") {
    console.error("[renderer] acarsDesktop bridge is incomplete.", {
      methods: Object.keys(bridge),
    });

    throw new Error(
      "Bridge Electron incomplet : la méthode login() est indisponible.",
    );
  }

  return bridge;
}

function setNotice(message: string, tone: NoticeTone = "info"): void {
  statusBanner.className = `status-banner status-banner--${tone}`;
  statusBanner.textContent = message;
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "n/d";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("fr-FR");
}

function formatNullableValue(value: number | boolean | string | null): string {
  if (value === null) {
    return "n/d";
  }

  if (typeof value === "boolean") {
    return value ? "Oui" : "Non";
  }

  return String(value);
}

function getSelectedBackendMode(): BackendMode {
  return backendModeInput.value === "live" ? "live" : "mock";
}

function applyLoginDefaults(config: DesktopSnapshot["config"]): void {
  backendModeInput.value = config.backendMode;
  apiBaseUrlInput.value = config.apiBaseUrl;
  acarsBaseUrlInput.value = config.acarsBaseUrl;
}

function persistLoginPreferences(): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      backendMode: getSelectedBackendMode(),
      apiBaseUrl: apiBaseUrlInput.value.trim(),
      acarsBaseUrl: acarsBaseUrlInput.value.trim(),
      identifier: identifierInput.value.trim(),
    }),
  );
}

function restoreLoginPreferences(): void {
  const storedRawValue = localStorage.getItem(STORAGE_KEY);

  if (!storedRawValue) {
    return;
  }

  try {
    const storedValue = JSON.parse(storedRawValue) as Partial<{
      backendMode: BackendMode;
      apiBaseUrl: string;
      acarsBaseUrl: string;
      identifier: string;
    }>;

    backendModeInput.value = storedValue.backendMode ?? backendModeInput.value;
    apiBaseUrlInput.value = storedValue.apiBaseUrl ?? apiBaseUrlInput.value;
    acarsBaseUrlInput.value =
      storedValue.acarsBaseUrl ?? acarsBaseUrlInput.value;
    identifierInput.value = storedValue.identifier ?? "";
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function renderBackendModeBadge(): void {
  const authenticatedMode = state.snapshot?.config.backendMode;
  const mode = authenticatedMode ?? getSelectedBackendMode();
  const presentation = getBackendModePresentation(mode);

  backendModeBadge.textContent = presentation.label;
  backendModeBadge.className = `badge badge--${presentation.tone}`;
}

function setManualTelemetryDefaults(): void {
  setNumericValue("latitude", DEFAULT_MANUAL_TELEMETRY.latitude);
  setNumericValue("longitude", DEFAULT_MANUAL_TELEMETRY.longitude);
  setNumericValue("altitudeFt", DEFAULT_MANUAL_TELEMETRY.altitudeFt);
  setNumericValue("groundspeedKts", DEFAULT_MANUAL_TELEMETRY.groundspeedKts);
  setNumericValue("headingDeg", DEFAULT_MANUAL_TELEMETRY.headingDeg);
  setNumericValue("verticalSpeedFpm", DEFAULT_MANUAL_TELEMETRY.verticalSpeedFpm);
  setNumericValue("fuelTotalKg", DEFAULT_MANUAL_TELEMETRY.fuelTotalKg ?? 0);
  setNumericValue("gearPercent", DEFAULT_MANUAL_TELEMETRY.gearPercent ?? 100);
  setNumericValue("flapsPercent", DEFAULT_MANUAL_TELEMETRY.flapsPercent ?? 0);
  setCheckboxValue("onGround", DEFAULT_MANUAL_TELEMETRY.onGround);
  setCheckboxValue("parkingBrake", DEFAULT_MANUAL_TELEMETRY.parkingBrake ?? false);
}

function setNumericValue(name: string, value: number): void {
  const input = manualTelemetryForm.elements.namedItem(name);

  if (input instanceof HTMLInputElement) {
    input.value = String(value);
  }
}

function setCheckboxValue(name: string, value: boolean): void {
  const input = manualTelemetryForm.elements.namedItem(name);

  if (input instanceof HTMLInputElement) {
    input.checked = value;
  }
}

function renderSnapshot(): void {
  const snapshot = state.snapshot;

  renderBackendModeBadge();

  authBadge.textContent = snapshot?.isAuthenticated ? "Connecté" : "Hors ligne";
  authBadge.className = snapshot?.isAuthenticated
    ? "badge badge--success"
    : "badge badge--neutral";

  if (!snapshot?.user) {
    identityCard.innerHTML = `
      <strong>Aucun pilote chargé</strong>
      <p class="helper">
        Connectez-vous pour ouvrir une session desktop Virtual Easyjet.
      </p>
    `;
    return;
  }

  const pilotProfile = snapshot.user.pilotProfile;
  const pilotName = pilotProfile
    ? `${pilotProfile.firstName} ${pilotProfile.lastName}`
    : snapshot.user.username;
  const roles = snapshot.user.roles.length > 0
    ? snapshot.user.roles.join(", ")
    : "aucun rôle";

  identityCard.innerHTML = `
    <div class="identity-head">
      <div>
        <p class="eyebrow">Pilote connecté</p>
        <strong>${escapeHtml(pilotName)}</strong>
        <p class="helper">
          ${escapeHtml(snapshot.user.email)} · pilote ${
            escapeHtml(pilotProfile?.pilotNumber ?? "n/d")
          }
        </p>
      </div>
      ${renderBadge("Session active", "success")}
    </div>
    <div class="token-row">
      ${renderToken(`Utilisateur: ${snapshot.user.username}`)}
      ${renderToken(`Rôles: ${roles}`)}
      ${renderToken(`Backend: ${snapshot.config.backendMode}`)}
      ${renderToken(`Télémétrie: ${snapshot.config.telemetryMode}`)}
    </div>
  `;
}

function renderBookings(bookings: BookingSummary[]): void {
  if (bookings.length === 0) {
    bookingsList.innerHTML =
      `<div class="empty-state">Aucune réservation chargée.</div>`;
    return;
  }

  bookingsList.innerHTML = bookings
    .map((booking) => {
      const status = getBookingStatusPresentation(booking.status);

      return `
        <article class="list-item">
          <div class="list-item__header">
            <div>
              <strong>${escapeHtml(booking.reservedFlightNumber)}</strong>
              <p class="helper">
                ${escapeHtml(booking.departureAirport.icao)} → ${escapeHtml(booking.arrivalAirport.icao)} ·
                ${escapeHtml(booking.aircraft.aircraftType.name)}
              </p>
            </div>
            ${renderBadge(status.label, status.tone)}
          </div>
          <div class="meta-row">
            ${renderToken(`Départ: ${formatDate(booking.bookedFor)}`)}
            ${
              booking.flight
                ? renderToken(`Vol lié: ${booking.flight.status}`)
                : renderToken("Vol lié: aucun")
            }
            ${renderToken(`Avion: ${booking.aircraft.registration}`)}
          </div>
        </article>
      `;
    })
    .join("");
}

function buildFlightActions(flight: FlightSummary): string {
  if (flight.acarsSession) {
    return `
      <button class="button button--secondary" type="button" data-action="open-session" data-session-id="${escapeHtml(flight.acarsSession.id)}">
        Reprendre la session
      </button>
    `;
  }

  if (flight.status === "IN_PROGRESS") {
    return `
      <button class="button button--primary" type="button" data-action="create-session" data-flight-id="${escapeHtml(flight.id)}">
        Démarrer ACARS
      </button>
    `;
  }

  return renderToken("Non exploitable");
}

function renderFlights(flights: FlightSummary[]): void {
  if (flights.length === 0) {
    flightsList.innerHTML = `
      <div class="empty-state">
        Aucun vol chargé. Créez d’abord un vol canonique depuis le site web si nécessaire.
      </div>
    `;
    return;
  }

  flightsList.innerHTML = flights
    .map((flight) => {
      const flightStatus = getFlightStatusPresentation(flight.status);
      const sessionStatus = flight.acarsSession
        ? getSessionStatusPresentation(flight.acarsSession.status)
        : null;
      const pirepStatus = flight.pirep
        ? getPirepStatusPresentation(flight.pirep.status)
        : null;

      return `
        <article class="list-item">
          <div class="list-item__header">
            <div>
              <strong>${escapeHtml(flight.flightNumber)}</strong>
              <p class="helper">
                ${escapeHtml(flight.departureAirport.icao)} → ${escapeHtml(flight.arrivalAirport.icao)} ·
                ${escapeHtml(flight.aircraft.aircraftType.name)}
              </p>
            </div>
            ${renderBadge(flightStatus.label, flightStatus.tone)}
          </div>
          <div class="meta-row">
            ${renderToken(`Réservation: ${flight.booking.status}`)}
            ${
              sessionStatus
                ? renderBadge(sessionStatus.label, sessionStatus.tone)
                : renderToken("Session: aucune")
            }
            ${
              pirepStatus
                ? renderBadge(pirepStatus.label, pirepStatus.tone)
                : renderToken("PIREP: aucun")
            }
          </div>
          <div class="button-row">
            ${buildFlightActions(flight)}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderDispatch(): void {
  if (!state.dispatch) {
    dispatchSummary.innerHTML = `
      <div class="empty-state">
        Chargez vos opérations après connexion.
      </div>
    `;
    bookingsList.innerHTML = "";
    flightsList.innerHTML = "";
    return;
  }

  dispatchSummary.innerHTML = `
    <div class="summary-grid">
      <div class="metric">
        <span class="metric-label">Réservations chargées</span>
        <span class="metric-value">${state.dispatch.bookings.length}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Réservations exploitables</span>
        <span class="metric-value">${state.dispatch.usableBookings.length}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Vols chargés</span>
        <span class="metric-value">${state.dispatch.flights.length}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Vols ACARS prêts</span>
        <span class="metric-value">${state.dispatch.usableFlights.length}</span>
      </div>
    </div>
  `;

  renderBookings(state.dispatch.bookings);
  renderFlights(state.dispatch.flights);
}

function renderSession(): void {
  const session = state.activeSession;

  if (!session) {
    sessionSummary.innerHTML = `
      <div class="empty-state">
        Ouvrez ou créez une session ACARS depuis un vol en cours.
      </div>
    `;
    pirepResult.innerHTML = "Aucun PIREP disponible.";
    updateSessionControls();
    return;
  }

  const sessionStatus = getSessionStatusPresentation(session.status);
  const phaseLabel = getPhaseLabel(session.detectedPhase);
  const lastStepLabel = state.lastMockProgress?.step?.label ?? "n/d";
  const remainingSteps =
    state.lastMockProgress?.remainingSteps !== undefined
      ? String(state.lastMockProgress.remainingSteps)
      : "n/d";

  sessionSummary.innerHTML = `
    <div class="list-item__header">
      <div>
        <strong>${escapeHtml(session.flight.flightNumber)}</strong>
        <p class="helper">
          ${escapeHtml(session.flight.departureAirport.icao)} -> ${escapeHtml(session.flight.arrivalAirport.icao)} ·
          ${escapeHtml(session.flight.aircraft.aircraftType.name)}
        </p>
      </div>
      ${renderBadge(sessionStatus.label, sessionStatus.tone)}
    </div>
    <div class="meta-row">
      ${renderBadge(phaseLabel, "info")}
      ${renderToken(`Dernière télémétrie: ${formatDate(session.lastTelemetryAt)}`)}
      ${renderToken(`Mock restant: ${remainingSteps}`)}
    </div>
    <div class="session-metrics">
      <div class="metric">
        <span class="metric-label">Phase détectée</span>
        <span class="metric-value">${escapeHtml(phaseLabel)}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Dernière étape mock</span>
        <span class="metric-value">${escapeHtml(lastStepLabel)}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Altitude ft</span>
        <span class="metric-value">${formatNullableValue(session.currentPosition.altitudeFt)}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Vitesse sol (kt)</span>
        <span class="metric-value">${formatNullableValue(session.currentPosition.groundspeedKts)}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Au sol</span>
        <span class="metric-value">${formatNullableValue(session.currentPosition.onGround)}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Frein de parking</span>
        <span class="metric-value">${formatNullableValue(session.latestTelemetry?.parkingBrake ?? null)}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Carburant départ (kg)</span>
        <span class="metric-value">${formatNullableValue(session.fuel.departureFuelKg)}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Carburant arrivée (kg)</span>
        <span class="metric-value">${formatNullableValue(session.fuel.arrivalFuelKg)}</span>
      </div>
    </div>
  `;

  if (session.pirep) {
    const pirepStatus = getPirepStatusPresentation(session.pirep.status);

    pirepResult.innerHTML = `
      <div class="list-item__header">
        <div>
          <strong>PIREP généré</strong>
          <p class="helper">
            Source ${escapeHtml(session.pirep.source)} · soumis le ${formatDate(session.pirep.submittedAt)}
          </p>
        </div>
        ${renderBadge(pirepStatus.label, pirepStatus.tone)}
      </div>
      <pre class="json-panel">${escapeHtml(
        JSON.stringify(
          {
            pirep: session.pirep,
            summary: session.eventSummary,
          },
          null,
          2,
        ),
      )}</pre>
    `;
  } else {
    pirepResult.innerHTML = `
      <strong>Aucun PIREP généré</strong>
      <p class="helper">
        Finalisez la session pour produire le rapport automatique du MVP.
      </p>
    `;
  }

  updateSessionControls();
}

function updateSessionControls(): void {
  const hasSession = state.activeSession !== null;
  const sessionCompleted = state.activeSession?.status === "COMPLETED";
  const mockControlsEnabled =
    (state.snapshot?.config.backendMode ?? getSelectedBackendMode()) === "mock" &&
    hasSession &&
    !sessionCompleted;

  refreshSessionButton.disabled = !hasSession;
  nextMockStepButton.disabled = !mockControlsEnabled;
  resetMockSequenceButton.disabled = !mockControlsEnabled;

  const manualFormElements = manualTelemetryForm.querySelectorAll<
    HTMLInputElement | HTMLButtonElement
  >("input, button");
  manualFormElements.forEach((element) => {
    element.disabled = !hasSession || sessionCompleted;
  });

  const completeFormElements = completeSessionForm.querySelectorAll<
    HTMLTextAreaElement | HTMLButtonElement
  >("textarea, button");
  completeFormElements.forEach((element) => {
    element.disabled = !hasSession || sessionCompleted;
  });
}

function parseTelemetryForm(): TelemetryInput {
  const formData = new FormData(manualTelemetryForm);
  const onGround = formData.get("onGround") === "on";
  const parkingBrake = formData.get("parkingBrake") === "on";
  const fuelTotalKg = readOptionalNumber(formData.get("fuelTotalKg"));
  const gearPercent = readOptionalNumber(formData.get("gearPercent"));
  const flapsPercent = readOptionalNumber(formData.get("flapsPercent"));

  const telemetry: TelemetryInput = {
    capturedAt: new Date().toISOString(),
    latitude: Number(formData.get("latitude")),
    longitude: Number(formData.get("longitude")),
    altitudeFt: Number(formData.get("altitudeFt")),
    groundspeedKts: Number(formData.get("groundspeedKts")),
    headingDeg: Number(formData.get("headingDeg")),
    verticalSpeedFpm: Number(formData.get("verticalSpeedFpm")),
    onGround,
    parkingBrake,
  };

  if (fuelTotalKg !== undefined) {
    telemetry.fuelTotalKg = fuelTotalKg;
  }

  if (gearPercent !== undefined) {
    telemetry.gearPercent = gearPercent;
  }

  if (flapsPercent !== undefined) {
    telemetry.flapsPercent = flapsPercent;
  }

  return telemetry;
}

function readOptionalNumber(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function requireActiveSessionId(): string {
  if (!state.activeSession) {
    throw new Error("Ouvrez ou créez d’abord une session ACARS.");
  }

  return state.activeSession.id;
}

async function handleLogin(): Promise<void> {
  const snapshot = await getDesktopBridge().login({
    backendMode: getSelectedBackendMode(),
    apiBaseUrl: apiBaseUrlInput.value,
    acarsBaseUrl: acarsBaseUrlInput.value,
    identifier: identifierInput.value,
    password: passwordInput.value,
  });

  state.snapshot = snapshot;
  state.dispatch = null;
  state.activeSession = null;
  state.lastMockProgress = null;
  passwordInput.value = "";

  persistLoginPreferences();
  renderSnapshot();
  renderDispatch();
  renderSession();

  appendLog(`Connexion ouverte pour ${snapshot.user?.username ?? "utilisateur inconnu"}.`);
  setNotice(
    snapshot.config.backendMode === "live"
      ? "Connexion réelle réussie. Vous pouvez maintenant charger les opérations réelles."
      : "Connexion mock réussie. Vous pouvez charger les opérations locales de démonstration.",
    "success",
  );
}

async function handleLogout(): Promise<void> {
  const snapshot = await getDesktopBridge().logout();
  state.snapshot = snapshot;
  state.dispatch = null;
  state.activeSession = null;
  state.lastMockProgress = null;

  renderSnapshot();
  renderDispatch();
  renderSession();

  appendLog("Session desktop fermée.");
  setNotice("Session desktop fermée.", "info");
}

async function loadDispatch(): Promise<void> {
  const dispatch = await getDesktopBridge().loadDispatchData();
  state.dispatch = dispatch;

  renderDispatch();

  appendLog(
    `Opérations chargées : ${dispatch.bookings.length} réservation(s), ${dispatch.flights.length} vol(s).`,
  );

  if (dispatch.usableFlights.length === 0) {
    setNotice(
      "Aucun vol en cours sans session ACARS. Créez ou reprenez d’abord un vol côté VA.",
      "warning",
    );
  } else {
    setNotice("Opérations chargées. Une session ACARS peut maintenant être ouverte.", "success");
  }
}

async function createSession(flightId: string): Promise<void> {
  const session = await getDesktopBridge().createSession(flightId);
  state.activeSession = session;
  state.lastMockProgress = null;

  renderSession();
  appendLog(`Session ACARS ${session.id} créée pour ${session.flight.flightNumber}.`);
  setNotice(
    state.snapshot?.config.backendMode === "live"
      ? `Session ${session.id} créée. Vous pouvez envoyer la télémétrie au backend réel.`
      : `Session ${session.id} créée. La séquence mock est disponible.`,
    "success",
  );

  await loadDispatch();
}

async function openSession(sessionId: string): Promise<void> {
  const session = await getDesktopBridge().getSession(sessionId);
  state.activeSession = session;

  renderSession();
  appendLog(`Session ${session.id} rechargée.`);
  setNotice(`Session ${session.id} rechargée.`, "success");
}

async function refreshSession(): Promise<void> {
  const sessionId = requireActiveSessionId();
  const session = await getDesktopBridge().getSession(sessionId);
  state.activeSession = session;

  renderSession();
  appendLog(`Session ${session.id} rafraîchie.`);
  setNotice(`Session ${session.id} rafraîchie.`, "info");
}

async function sendNextMockStep(): Promise<void> {
  const sessionId = requireActiveSessionId();
  const progress = await getDesktopBridge().sendNextMockTelemetry(sessionId);
  state.activeSession = progress.session;
  state.lastMockProgress = progress;

  renderSession();

  if (progress.step) {
    appendLog(
      `Télémétrie mock envoyée : ${progress.step.label} → ${getPhaseLabel(progress.session.detectedPhase)}.`,
    );
    setNotice(
      `Étape mock envoyée : ${progress.step.label}. Phase courante : ${getPhaseLabel(progress.session.detectedPhase)}.`,
      "success",
    );
  } else {
    appendLog("La séquence mock est déjà terminée.");
    setNotice(
      "La séquence mock est terminée. Finalisez la session ou réinitialisez le mock.",
      "warning",
    );
  }
}

async function resetMockSequence(): Promise<void> {
  const sessionId = requireActiveSessionId();
  const resetResult = await getDesktopBridge().resetMockSequence(sessionId);
  state.lastMockProgress = null;
  renderSession();

  appendLog(`Séquence mock réinitialisée (${resetResult.totalSteps} étapes).`);
  setNotice("Séquence mock réinitialisée.", "info");
}

async function sendManualTelemetry(): Promise<void> {
  const sessionId = requireActiveSessionId();
  const session = await getDesktopBridge().sendManualTelemetry(
    sessionId,
    parseTelemetryForm(),
  );

  state.activeSession = session;
  renderSession();

  appendLog(`Télémétrie manuelle envoyée → ${getPhaseLabel(session.detectedPhase)}.`);
  setNotice(
    `Télémétrie envoyée. Phase courante : ${getPhaseLabel(session.detectedPhase)}.`,
    "success",
  );
}

async function completeSession(): Promise<void> {
  const sessionId = requireActiveSessionId();
  const formData = new FormData(completeSessionForm);
  const pilotComment = String(formData.get("pilotComment") ?? "");
  const session = await getDesktopBridge().completeSession(
    sessionId,
    pilotComment,
  );

  state.activeSession = session;
  renderSession();

  appendLog(
    `Session ${session.id} terminée. Statut PIREP : ${session.pirep?.status ?? "n/d"}.`,
  );
  setNotice("Session finalisée. Le PIREP automatique est disponible.", "success");

  await loadDispatch();
}

async function runSafely(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur desktop inattendue.";
    appendLog(`Erreur : ${message}`);
    setNotice(message, "danger");
  }
}

function bindEvents(): void {
  backendModeInput.addEventListener("change", () => {
    renderBackendModeBadge();
    updateSessionControls();
  });

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

  flightsList.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest<HTMLButtonElement>("button[data-action]");

    if (!button) {
      return;
    }

    const action = button.dataset.action;

    if (action === "create-session" && button.dataset.flightId) {
      void runSafely(() => createSession(button.dataset.flightId as string));
    }

    if (action === "open-session" && button.dataset.sessionId) {
      void runSafely(() => openSession(button.dataset.sessionId as string));
    }
  });

  refreshSessionButton.addEventListener("click", () => {
    void runSafely(refreshSession);
  });

  nextMockStepButton.addEventListener("click", () => {
    void runSafely(sendNextMockStep);
  });

  resetMockSequenceButton.addEventListener("click", () => {
    void runSafely(resetMockSequence);
  });

  manualTelemetryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void runSafely(sendManualTelemetry);
  });

  completeSessionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void runSafely(completeSession);
  });
}

async function bootstrap(): Promise<void> {
  applyLoginDefaults(DEFAULT_DESKTOP_CONFIG);
  restoreLoginPreferences();
  setManualTelemetryDefaults();
  bindEvents();

  let bridge: DesktopBridge;

  try {
    bridge = getDesktopBridge();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Bridge Electron indisponible.";
    appendLog(`Erreur de bridge : ${message}`);
    setNotice(message, "danger");
    renderSnapshot();
    renderDispatch();
    renderSession();
    updateSessionControls();
    return;
  }

  state.snapshot = await bridge.getSnapshot();
  applyLoginDefaults(state.snapshot.config);
  restoreLoginPreferences();
  renderSnapshot();
  renderDispatch();
  renderSession();
  updateSessionControls();

  appendLog("Interface desktop initialisée.");
  setNotice("Client ACARS prêt. Choisissez un mode mock ou réel pour commencer.", "info");
}

void bootstrap();
