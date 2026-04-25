import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { getPublicHubs, getPublicRoutes } from "@/lib/api/public";
import { logWebError } from "@/lib/observability/log";

export const dynamic = "force-dynamic";

function formatCountryName(countryCode: string): string {
  try {
    return (
      new Intl.DisplayNames(["fr-FR"], { type: "region" }).of(countryCode) ??
      countryCode
    );
  } catch {
    return countryCode;
  }
}

export default async function HubsPage(): Promise<JSX.Element> {
  try {
    const [hubs, routes] = await Promise.all([getPublicHubs(), getPublicRoutes()]);

    return (
      <>
        <section className="page-hero">
          <span className="section-eyebrow">Hubs</span>
          <h1>Nos hubs</h1>
          <p>
            Nos hubs structurent l'activité de la compagnie virtuelle et servent
            de point d'ancrage pour la flotte, les routes et la progression des
            pilotes.
          </p>
          <p>
            Chaque base est présentée avec son aéroport, son pays et le volume
            de routes actuellement publiées depuis ce hub.
          </p>
        </section>

        {hubs.length === 0 ? (
          <EmptyState
            title="Aucun hub publié"
            description="Les hubs apparaîtront ici dès qu'ils seront disponibles."
          />
        ) : (
          <section className="card-grid">
            {hubs.map((hub) => {
              const publishedRoutes = routes.filter(
                (route) => route.departureHub?.id === hub.id,
              ).length;

              return (
                <Card key={hub.id} className="showcase-card showcase-card--hub">
                  <div className="showcase-card__header">
                    <div>
                      <span className="section-eyebrow">{hub.code}</span>
                      <h2>{hub.name}</h2>
                      <p>{hub.airport.name}</p>
                    </div>
                    <Badge
                      label={hub.isActive ? "Actif" : "Inactif"}
                      tone={hub.isActive ? "success" : "neutral"}
                    />
                  </div>

                  <div className="showcase-card__spotlight">
                    <strong>
                      {hub.airport.city ?? hub.airport.name} ·{" "}
                      {formatCountryName(hub.airport.countryCode)}
                    </strong>
                    <span>
                      {publishedRoutes} route{publishedRoutes > 1 ? "s" : ""} publiée
                      {publishedRoutes > 1 ? "s" : ""} au départ de ce hub
                    </span>
                  </div>

                  <div className="definition-grid">
                    <div>
                      <span>ICAO</span>
                      <strong>{hub.airport.icao}</strong>
                    </div>
                    <div>
                      <span>IATA</span>
                      <strong>{hub.airport.iata ?? "-"}</strong>
                    </div>
                    <div>
                      <span>Pays</span>
                      <strong>{formatCountryName(hub.airport.countryCode)}</strong>
                    </div>
                    <div>
                      <span>Ville</span>
                      <strong>{hub.airport.city ?? "Non renseignée"}</strong>
                    </div>
                    <div>
                      <span>Routes publiées</span>
                      <strong>{publishedRoutes}</strong>
                    </div>
                    <div>
                      <span>Statut</span>
                      <strong>{hub.isActive ? "Base active" : "Base inactive"}</strong>
                    </div>
                  </div>
                </Card>
              );
            })}
          </section>
        )}
      </>
    );
  } catch (error) {
    logWebError("hubs page failed", error);
    return (
      <ErrorState
        title="Hubs indisponibles"
        description="Les hubs n'ont pas pu être chargés depuis l'API."
      />
    );
  }
}
