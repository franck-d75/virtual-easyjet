"use client";

import type { LayerGroup, Map } from "leaflet";
import type { JSX, ReactNode } from "react";
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";

import type { LiveMapAircraft, LiveMapPhase } from "@va/shared";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { getAcarsLiveTraffic } from "@/lib/api/public";
import { logWebWarning } from "@/lib/observability/log";
import type { SimbriefRouteOverlay } from "@/lib/utils/simbrief-route";
import { cn } from "@/lib/utils/cn";

const DEFAULT_MAP_CENTER: [number, number] = [50.1109, 8.6821];
const DEFAULT_MAP_ZOOM = 5;
const SINGLE_TARGET_ZOOM = 6;
const LIVE_MAP_POLL_INTERVAL_MS = 30_000;
const LIVE_MAP_RETRY_BACKOFF_MS = 90_000;
const SIMBRIEF_ROUTE_COLOR = "#7dd3fc";
const SIMBRIEF_ROUTE_GLOW_COLOR = "rgba(125, 211, 252, 0.28)";
const DARK_TILE_LAYER_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const DARK_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const VIEWPORT_PADDING: [number, number] = [56, 56];
const MOBILE_MEDIA_QUERY = "(max-width: 900px)";

type LiveMapPanelProps = {
  initialTraffic: LiveMapAircraft[];
  initialError: string | null;
  initialFetchedAt: string | null;
  initialSimbriefRoute: SimbriefRouteOverlay | null;
};

type LeafletModule = typeof import("leaflet");
type LeafletWindow = Window &
  typeof globalThis & {
    L?: LeafletModule;
  };
type RotatedMarkerOptions = {
  rotationAngle?: number;
  rotationOrigin?: string;
};

type PhasePresentation = {
  label: string;
  phaseClassName: string;
};

type OverlayPanelProps = {
  eyebrow: string;
  title: string;
  className?: string;
  children: ReactNode;
};

let rotatedMarkerPluginPromise: Promise<void> | null = null;

export function LiveMapPanel({
  initialTraffic,
  initialError,
  initialFetchedAt,
  initialSimbriefRoute,
}: LiveMapPanelProps): JSX.Element {
  const [traffic, setTraffic] = useState(initialTraffic);
  const [error, setError] = useState(initialError);
  const [simbriefRoute, setSimbriefRoute] = useState(initialSimbriefRoute);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(initialFetchedAt);
  const [isImmersive, setIsImmersive] = useState(false);
  const [arePanelsVisible, setArePanelsVisible] = useState(true);
  const [isCompactViewport, setIsCompactViewport] = useState(false);

  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const routeLayerRef = useRef<LayerGroup | null>(null);
  const markersLayerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const hasAdjustedViewportRef = useRef(false);
  const viewportPointsRef = useRef<[number, number][]>([]);
  const hasUserToggledPanelsRef = useRef(false);
  const previousPanelsVisibilityRef = useRef(true);
  const pollTimeoutRef = useRef<number | null>(null);
  const refreshInFlightRef = useRef(false);

  const airborneCount = useMemo(
    () => traffic.filter((flight) => flight.phase === "AIRBORNE").length,
    [traffic],
  );
  const pushbackCount = useMemo(
    () => traffic.filter((flight) => flight.phase === "PUSHBACK").length,
    [traffic],
  );
  const taxiCount = useMemo(
    () => traffic.filter((flight) => flight.phase === "TAXI").length,
    [traffic],
  );
  const parkedCount = useMemo(
    () => traffic.filter((flight) => flight.phase === "PARKED").length,
    [traffic],
  );
  const phaseActivity = useMemo(
    () => ({
      PARKED: parkedCount,
      PUSHBACK: pushbackCount,
      TAXI: taxiCount,
      AIRBORNE: airborneCount,
    }),
    [airborneCount, parkedCount, pushbackCount, taxiCount],
  );

  const routeLabel = simbriefRoute
    ? `${simbriefRoute.departureIcao} → ${simbriefRoute.arrivalIcao}`
    : "Aucune route SimBrief";
  const routeDetail = simbriefRoute
    ? simbriefRoute.mode === "WAYPOINTS"
      ? "Tracé complet du navlog SimBrief."
      : "Tracé direct de secours entre départ et arrivée."
    : "Aucun OFP exploitable n’est disponible pour superposer une route.";

  const fitViewport = useEffectEvent((points?: [number, number][]): void => {
    const map = mapRef.current;
    const viewportPoints = points ?? viewportPointsRef.current;

    if (!map) {
      return;
    }

    if (viewportPoints.length === 0) {
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
      return;
    }

    if (viewportPoints.length === 1) {
      const [target] = viewportPoints;

      if (target) {
        map.setView(target, SINGLE_TARGET_ZOOM);
      }
      return;
    }

    map.fitBounds(viewportPoints, {
      padding: VIEWPORT_PADDING,
      maxZoom: 7,
    });
  });

  const resetViewport = useEffectEvent((): void => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
  });

  const clearScheduledRefresh = useEffectEvent(() => {
    if (pollTimeoutRef.current !== null) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  });

  const refreshTraffic = useEffectEvent(async (silent: boolean) => {
    if (refreshInFlightRef.current) {
      return false;
    }

    refreshInFlightRef.current = true;

    if (!silent) {
      setIsRefreshing(true);
    }

    try {
      const nextTraffic = await getAcarsLiveTraffic();
      setTraffic(nextTraffic);
      setError(null);
      setLastUpdatedAt(new Date().toISOString());

      if (nextTraffic.length === 0) {
        hasAdjustedViewportRef.current = false;
      }

      return true;
    } catch (refreshError) {
      logWebWarning("live map refresh failed", refreshError);
      setError("La carte en direct n'a pas pu être actualisée depuis l'API.");
      return false;
    } finally {
      refreshInFlightRef.current = false;
      if (!silent) {
        setIsRefreshing(false);
      }
    }
  });

  const scheduleRefresh = useEffectEvent((delayMs: number) => {
    clearScheduledRefresh();

    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return;
    }

    pollTimeoutRef.current = window.setTimeout(() => {
      void (async () => {
        const succeeded = await refreshTraffic(true);
        scheduleRefresh(
          succeeded ? LIVE_MAP_POLL_INTERVAL_MS : LIVE_MAP_RETRY_BACKOFF_MS,
        );
      })();
    }, delayMs);
  });

  useEffect(() => {
    let isActive = true;

    async function loadSimbriefRoute(): Promise<void> {
      try {
        const response = await fetch("/api/pilot/simbrief/route-overlay", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as SimbriefRouteOverlay | null;

        if (isActive) {
          setSimbriefRoute(payload);
        }
      } catch (routeError) {
        logWebWarning("live map SimBrief route overlay fetch failed", routeError);
      }
    }

    void loadSimbriefRoute();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initializeMap(): Promise<void> {
      if (!mapElementRef.current || mapRef.current) {
        return;
      }

      const L = await import("leaflet");
      await ensureRotatedMarkerPlugin(L);

      if (!isMounted || !mapElementRef.current) {
        return;
      }

      leafletRef.current = L;

      const map = L.map(mapElementRef.current, {
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer(DARK_TILE_LAYER_URL, {
        attribution: DARK_TILE_ATTRIBUTION,
        subdomains: ["a", "b", "c", "d"],
        maxZoom: 20,
      }).addTo(map);

      routeLayerRef.current = L.layerGroup().addTo(map);
      markersLayerRef.current = L.layerGroup().addTo(map);
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
      mapRef.current = map;
      setIsMapReady(true);
    }

    initializeMap().catch((mapError) => {
      logWebWarning("live map init failed", mapError);
      setError("La carte Leaflet n'a pas pu être initialisée dans le navigateur.");
    });

    return () => {
      isMounted = false;
      routeLayerRef.current?.clearLayers();
      routeLayerRef.current = null;
      markersLayerRef.current?.clearLayers();
      markersLayerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      !leafletRef.current ||
      !mapRef.current ||
      !markersLayerRef.current ||
      !routeLayerRef.current
    ) {
      return;
    }

    const L = leafletRef.current;
    const map = mapRef.current;
    const routeLayer = routeLayerRef.current;
    const markersLayer = markersLayerRef.current;
    const trafficPoints: [number, number][] = [];
    const routePoints: [number, number][] = [];

    routeLayer.clearLayers();
    markersLayer.clearLayers();

    if (simbriefRoute && simbriefRoute.points.length >= 2) {
      const routeLatLngs = simbriefRoute.points.map((point) => {
        const latLng: [number, number] = [point.lat, point.lon];
        routePoints.push(latLng);
        return latLng;
      });

      L.polyline(routeLatLngs, {
        color: SIMBRIEF_ROUTE_GLOW_COLOR,
        weight: simbriefRoute.mode === "WAYPOINTS" ? 9 : 7,
        opacity: 0.45,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      }).addTo(routeLayer);

      L.polyline(routeLatLngs, {
        color: SIMBRIEF_ROUTE_COLOR,
        weight: simbriefRoute.mode === "WAYPOINTS" ? 3.5 : 3,
        opacity: 0.82,
        lineCap: "round",
        lineJoin: "round",
        dashArray: simbriefRoute.mode === "DIRECT" ? "10 12" : undefined,
        className: "live-map-route-line",
      }).addTo(routeLayer);
    }

    for (const flight of traffic) {
      const marker = L.marker([flight.lat, flight.lon], {
        icon: buildMarkerIcon(L, flight.phase),
        keyboard: false,
        rotationAngle: normalizeHeading(flight.heading),
        rotationOrigin: "center",
      } as RotatedMarkerOptions & Parameters<LeafletModule["marker"]>[1]);

      marker.bindPopup(buildPopupMarkup(flight), {
        className: "live-map-popup",
      });

      marker.addTo(markersLayer);
      trafficPoints.push([flight.lat, flight.lon]);
    }

    viewportPointsRef.current = [...routePoints, ...trafficPoints];

    if (viewportPointsRef.current.length === 0) {
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
      hasAdjustedViewportRef.current = false;
      return;
    }

    if (!hasAdjustedViewportRef.current) {
      fitViewport(viewportPointsRef.current);
      hasAdjustedViewportRef.current = true;
    }
  }, [fitViewport, simbriefRoute, traffic]);

  useEffect(() => {
    let active = true;

    const startPolling = async (forceRefresh: boolean) => {
      if (!active) {
        return;
      }

      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        clearScheduledRefresh();
        return;
      }

      const shouldRefreshImmediately =
        forceRefresh || initialError !== null || initialTraffic.length === 0;

      if (shouldRefreshImmediately) {
        const succeeded = await refreshTraffic(forceRefresh);

        if (!active) {
          return;
        }

        scheduleRefresh(
          succeeded ? LIVE_MAP_POLL_INTERVAL_MS : LIVE_MAP_RETRY_BACKOFF_MS,
        );
        return;
      }

      scheduleRefresh(LIVE_MAP_POLL_INTERVAL_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void startPolling(true);
        return;
      }

      clearScheduledRefresh();
    };

    const handleOnline = () => {
      void startPolling(true);
    };

    void startPolling(false);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      clearScheduledRefresh();
    };
  }, [
    clearScheduledRefresh,
    initialError,
    initialTraffic.length,
    refreshTraffic,
    scheduleRefresh,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const syncViewportState = (matches: boolean) => {
      setIsCompactViewport(matches);

      if (!hasUserToggledPanelsRef.current) {
        setArePanelsVisible(!matches);
      }
    };

    syncViewportState(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      syncViewportState(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 240);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [arePanelsVisible, isImmersive, isMapReady]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const immersiveClassName = "live-map-immersive-active";
    const htmlElement = document.documentElement;
    const bodyElement = document.body;

    if (isImmersive) {
      htmlElement.classList.add(immersiveClassName);
      bodyElement.classList.add(immersiveClassName);
    } else {
      htmlElement.classList.remove(immersiveClassName);
      bodyElement.classList.remove(immersiveClassName);
    }

    return () => {
      htmlElement.classList.remove(immersiveClassName);
      bodyElement.classList.remove(immersiveClassName);
    };
  }, [isImmersive]);

  function togglePanels(): void {
    hasUserToggledPanelsRef.current = true;
    setArePanelsVisible((currentValue) => !currentValue);
  }

  function toggleImmersiveMode(): void {
    if (!isImmersive) {
      previousPanelsVisibilityRef.current = arePanelsVisible;
      setArePanelsVisible(false);
      setIsImmersive(true);
      return;
    }

    setIsImmersive(false);
    setArePanelsVisible(previousPanelsVisibilityRef.current);
  }

  return (
    <div
      className={cn(
        "live-map-experience",
        isImmersive && "live-map-experience--immersive",
        !arePanelsVisible && "live-map-experience--map-only",
      )}
    >
      <section className="live-map-stage">
        <div className="live-map-stage__header">
          <div className="live-map-brief">
            <span className="section-eyebrow">Suivi ACARS</span>
            <div className="live-map-brief__copy">
              <h1>Carte ACARS</h1>
              {!isCompactViewport ? (
                <p>
                  Trafic live, phases de vol et route SimBrief dans une vue de
                  supervision claire et élégante.
                </p>
              ) : null}
            </div>
          </div>

          <div className="live-map-toolbar">
            <Button
              aria-pressed={isImmersive}
              className="live-map-control-button"
              onClick={toggleImmersiveMode}
            >
              {isImmersive ? "Quitter le mode immersif" : "Agrandir la carte"}
            </Button>
            <Button
              aria-controls="live-map-sidebar"
              aria-pressed={arePanelsVisible}
              className="live-map-control-button"
              onClick={togglePanels}
              variant="secondary"
            >
              {arePanelsVisible ? "Masquer les panneaux" : "Afficher les panneaux"}
            </Button>
            <Button
              className="live-map-control-button"
              onClick={() => {
                fitViewport();
              }}
              variant="ghost"
            >
              Centrer la vue
            </Button>
            <Button
              className="live-map-control-button"
              onClick={() => {
                resetViewport();
              }}
              variant="ghost"
            >
              Réinitialiser le zoom
            </Button>
            <span className="live-map-control-slot live-map-control-slot--refresh">
              <Button
                aria-busy={isRefreshing}
                aria-disabled={isRefreshing || refreshInFlightRef.current}
                className="live-map-control-button"
                onClick={(event) => {
                  event.currentTarget.blur();
                  if (isRefreshing || refreshInFlightRef.current) {
                    return;
                  }
                  void (async () => {
                    const succeeded = await refreshTraffic(false);
                    scheduleRefresh(
                      succeeded
                        ? LIVE_MAP_POLL_INTERVAL_MS
                        : LIVE_MAP_RETRY_BACKOFF_MS,
                    );
                  })();
                }}
                variant="secondary"
              >
                Actualiser
              </Button>
            </span>
          </div>
        </div>

        <div
          className={cn(
            "live-map-stage__body",
            !arePanelsVisible && "live-map-stage__body--map-only",
          )}
        >
          <div className="live-map-map-panel">
            <div className="live-map-canvas-shell">
              <div className="live-map-canvas" ref={mapElementRef} />
            </div>

            {!isMapReady ? (
              <div className="live-map-overlay live-map-overlay--centered">
                <LoadingState label="Initialisation de la carte en direct..." />
              </div>
            ) : null}

            {isMapReady && traffic.length === 0 && simbriefRoute === null ? (
              <div className="live-map-overlay live-map-overlay--notice">
                <EmptyState
                  action={
                    error ? (
                      <Button
                        onClick={() => {
                          void refreshTraffic(false);
                        }}
                        variant="secondary"
                      >
                        Réessayer
                      </Button>
                    ) : undefined
                  }
                  description={
                    error
                      ? "Aucune position ACARS n’est exploitable pour le moment. La carte reste disponible et vous pouvez relancer la récupération du trafic."
                      : "Aucun avion n’est actuellement connecté via ACARS. Lancez une session desktop et envoyez de la télémétrie pour voir apparaître un marqueur."
                  }
                  title="Aucun trafic en direct"
                />
              </div>
            ) : null}

            <div className="live-map-hud">
              <div className="live-map-hud__chip">
                <span>Trafic</span>
                <strong>{traffic.length} connecté(s)</strong>
              </div>
              <div className="live-map-hud__chip">
                <span>Dernière synchro</span>
                <strong>{formatTime(lastUpdatedAt)}</strong>
              </div>
              <div className="live-map-hud__chip live-map-hud__chip--route">
                <span>Route SimBrief</span>
                <strong>{routeLabel}</strong>
              </div>
            </div>
          </div>

          {arePanelsVisible ? (
            <aside className="live-map-sidebar" id="live-map-sidebar">
              <OverlayPanel eyebrow="Réseau" title="État du réseau">
                <div className="live-map-summary-grid">
                  <div className="live-map-summary-item">
                    <span>Connectés</span>
                    <strong>{traffic.length}</strong>
                  </div>
                  <div className="live-map-summary-item">
                    <span>En vol</span>
                    <strong>{airborneCount}</strong>
                  </div>
                  <div className="live-map-summary-item">
                    <span>Roulage</span>
                    <strong>{taxiCount}</strong>
                  </div>
                  <div className="live-map-summary-item">
                    <span>Au parking</span>
                    <strong>{parkedCount}</strong>
                  </div>
                </div>
                {pushbackCount > 0 ? (
                  <p className="live-map-note live-map-note--accent">
                    {pushbackCount} appareil(x) sont actuellement en repoussage.
                  </p>
                ) : null}
                {error && traffic.length > 0 ? (
                  <p className="live-map-inline-error">
                    {error} Les dernières positions connues restent affichées.
                  </p>
                ) : null}
              </OverlayPanel>

              <OverlayPanel eyebrow="Repères" title="Légende">
                <div className="live-map-legend">
                  {(["PARKED", "PUSHBACK", "TAXI", "AIRBORNE"] as const).map(
                    (phase) => {
                      const presentation = getPhasePresentation(phase);
                      const isActive = phaseActivity[phase] > 0;

                      return (
                        <div
                          className={cn(
                            "live-map-legend__item",
                            isActive
                              ? "live-map-legend__item--active"
                              : "live-map-legend__item--inactive",
                          )}
                          key={phase}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "live-phase-dot",
                              presentation.phaseClassName,
                              isActive && "live-phase-dot--active",
                            )}
                          />
                          <div>
                            <strong>
                              {presentation.label}
                              {isActive ? ` · ${phaseActivity[phase]}` : ""}
                            </strong>
                            <small>{describePhase(phase)}</small>
                          </div>
                        </div>
                      );
                    },
                  )}

                  <div className="live-map-legend__item">
                    <span className="live-map-route-swatch" aria-hidden="true" />
                    <div>
                      <strong>Route SimBrief</strong>
                      <small>{routeDetail}</small>
                    </div>
                  </div>
                </div>
              </OverlayPanel>

              <OverlayPanel
                className="live-map-overlay-panel--traffic"
                eyebrow="Trafic"
                title="Sessions visibles"
              >
                {traffic.length === 0 ? (
                  <p className="live-map-note">
                    Les prochaines sessions ACARS apparaîtront ici dès qu’elles
                    enverront une position exploitable.
                  </p>
                ) : (
                  <ul className="live-map-flight-list">
                    {traffic.map((flight, index) => {
                      const presentation = getPhasePresentation(flight.phase);

                      return (
                        <li
                          className="live-map-flight-item"
                          key={`${flight.callsign}-${index}`}
                        >
                          <div className="live-map-flight-item__header">
                            <div>
                              <strong>{flight.callsign}</strong>
                              <small>
                                {flight.lat.toFixed(3)}, {flight.lon.toFixed(3)}
                              </small>
                            </div>
                            <span
                              className={`live-phase-pill ${presentation.phaseClassName}`}
                            >
                              {presentation.label}
                            </span>
                          </div>
                          <div className="live-map-flight-item__meta">
                            <div>
                              <span>Altitude</span>
                              <strong>{formatAltitude(flight.altitude)}</strong>
                            </div>
                            <div>
                              <span>Vitesse</span>
                              <strong>{formatSpeed(flight.speed)}</strong>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </OverlayPanel>
            </aside>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function OverlayPanel({
  eyebrow,
  title,
  className,
  children,
}: OverlayPanelProps): JSX.Element {
  return (
    <section className={cn("live-map-overlay-panel", className)}>
      <div className="live-map-overlay-panel__head">
        <span className="section-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function getPhasePresentation(phase: LiveMapPhase): PhasePresentation {
  switch (phase) {
    case "PARKED":
      return {
        label: "Au parking",
        phaseClassName: "live-phase--parked",
      };
    case "PUSHBACK":
      return {
        label: "Repoussage",
        phaseClassName: "live-phase--pushback",
      };
    case "TAXI":
      return {
        label: "Roulage",
        phaseClassName: "live-phase--taxi",
      };
    case "AIRBORNE":
      return {
        label: "En vol",
        phaseClassName: "live-phase--airborne",
      };
  }
}

function getColor(phase: LiveMapPhase): string {
  switch (phase) {
    case "PARKED":
      return "red";
    case "PUSHBACK":
      return "orange";
    case "TAXI":
      return "yellow";
    case "AIRBORNE":
      return "green";
    default:
      return "white";
  }
}

function describePhase(phase: LiveMapPhase): string {
  switch (phase) {
    case "PARKED":
      return "Appareil au parking, au sol et sans roulage actif.";
    case "PUSHBACK":
      return "Repoussage détecté par la phase ACARS active.";
    case "TAXI":
      return "Roulage actif au sol avant ou après le vol.";
    case "AIRBORNE":
      return "Montée, croisière, descente, approche ou atterrissage.";
  }
}

function formatAltitude(altitude: number): string {
  return `${altitude.toLocaleString("fr-FR")} ft`;
}

function formatSpeed(speed: number): string {
  return `${speed.toLocaleString("fr-FR")} kt`;
}

function formatTime(value: string | null): string {
  if (!value) {
    return "Aucune synchro";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function buildMarkerIcon(
  L: LeafletModule,
  phase: LiveMapPhase,
): ReturnType<LeafletModule["icon"]> {
  return aircraftIcon(L, getColor(phase));
}

async function ensureRotatedMarkerPlugin(L: LeafletModule): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const markerPrototype = L.Marker.prototype as typeof L.Marker.prototype & {
    setRotationAngle?: (angle: number) => unknown;
  };

  if (typeof markerPrototype.setRotationAngle === "function") {
    return;
  }

  if (rotatedMarkerPluginPromise === null) {
    (window as LeafletWindow).L = L;
    rotatedMarkerPluginPromise = loadRotatedMarkerScript().then(() => {
      (window as LeafletWindow).L = L;
    });
  }

  await rotatedMarkerPluginPromise;
}

function loadRotatedMarkerScript(): Promise<void> {
  const existingScript = document.querySelector<HTMLScriptElement>(
    'script[data-live-map-rotated-marker="true"]',
  );

  if (existingScript) {
    if (existingScript.dataset.loaded === "true") {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load leaflet rotated marker plugin.")),
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/vendor/leaflet.rotatedMarker.js";
    script.async = true;
    script.dataset.liveMapRotatedMarker = "true";
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => reject(new Error("Failed to load leaflet rotated marker plugin.")),
      { once: true },
    );
    document.head.appendChild(script);
  });
}

function aircraftIcon(
  L: LeafletModule,
  color: string,
): ReturnType<LeafletModule["icon"]> {
  return L.icon({
    iconUrl: `/icons/aircraft-${color}.svg`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
    className: "live-map-aircraft-icon",
  });
}

function normalizeHeading(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0;
  }

  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function buildPopupMarkup(flight: LiveMapAircraft): string {
  const presentation = getPhasePresentation(flight.phase);

  return [
    '<div class="live-map-popup__content">',
    `<span class="live-phase-pill ${presentation.phaseClassName}">${presentation.label}</span>`,
    `<h3>${escapeHtml(flight.callsign)}</h3>`,
    '<div class="live-map-popup__metrics">',
    `<div><span>Altitude</span><strong>${escapeHtml(formatAltitude(flight.altitude))}</strong></div>`,
    `<div><span>Vitesse</span><strong>${escapeHtml(formatSpeed(flight.speed))}</strong></div>`,
    `<div><span>Latitude</span><strong>${escapeHtml(flight.lat.toFixed(3))}</strong></div>`,
    `<div><span>Longitude</span><strong>${escapeHtml(flight.lon.toFixed(3))}</strong></div>`,
    "</div>",
    "</div>",
  ].join("");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

