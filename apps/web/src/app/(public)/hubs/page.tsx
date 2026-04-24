import type { JSX } from "react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { getPublicHubs } from "@/lib/api/public";
import { logWebError } from "@/lib/observability/log";

export const dynamic = "force-dynamic";

export default async function HubsPage(): Promise<JSX.Element> {
  try {
    const hubs = await getPublicHubs();

    return (
      <>
        <section className="page-hero">
          <span className="section-eyebrow">Hubs</span>
          <h1>Nos hubs</h1>
          <p>
            Nos hubs virtuels servent de points de départ pour l’ensemble de nos
            opérations. Ils structurent le réseau et permettent aux pilotes de
            s’intégrer dans une activité cohérente et régulière.
          </p>
          <p>
            Chaque hub regroupe des appareils, des routes et des vols
            disponibles pour construire une expérience de ligne claire et
            immersive.
          </p>
        </section>

        {hubs.length === 0 ? (
          <EmptyState
            title="Aucun hub publié"
            description="Les hubs apparaîtront ici dès qu’ils seront disponibles."
          />
        ) : (
          <section className="card-grid">
            {hubs.map((hub) => (
              <Card key={hub.id}>
                <span className="section-eyebrow">{hub.code}</span>
                <h2>{hub.name}</h2>
                <p>{hub.airport.name}</p>
                <div className="definition-grid">
                  <div>
                    <span>Aéroport</span>
                    <strong>{hub.airport.icao}</strong>
                  </div>
                  <div>
                    <span>Ville</span>
                    <strong>{hub.airport.city ?? "Non renseignée"}</strong>
                  </div>
                  <div>
                    <span>Pays</span>
                    <strong>{hub.airport.countryCode}</strong>
                  </div>
                  <div>
                    <span>Statut</span>
                    <strong>{hub.isActive ? "Actif" : "Inactif"}</strong>
                  </div>
                </div>
              </Card>
            ))}
          </section>
        )}
      </>
    );
  } catch (error) {
    logWebError("hubs page failed", error);
    return (
      <ErrorState
        title="Hubs indisponibles"
        description="Les hubs n’ont pas pu être chargés depuis l’API."
      />
    );
  }
}
