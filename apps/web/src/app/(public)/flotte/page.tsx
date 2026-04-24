import type { JSX } from "react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { getPublicAircraft } from "@/lib/api/public";
import { logWebError } from "@/lib/observability/log";
import { formatNullableText } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function FleetPage(): Promise<JSX.Element> {
  try {
    const aircraft = await getPublicAircraft();

    return (
      <>
        <section className="page-hero">
          <span className="section-eyebrow">Flotte</span>
          <h1>Notre flotte</h1>
          <p>
            Notre flotte virtuelle est pensée pour les opérations court et
            moyen-courrier, avec des appareils adaptés à des rotations
            fréquentes, efficaces et réalistes dans l’esprit d’une exploitation
            européenne moderne.
          </p>
          <p>
            Chaque appareil de la flotte est rattaché à des opérations
            définies, avec un suivi des vols, des réservations et des PIREPs.
          </p>
        </section>

        {aircraft.length === 0 ? (
          <EmptyState
            title="Flotte indisponible"
            description="Aucun appareil n’est publié pour le moment."
          />
        ) : (
          <section className="card-grid">
            {aircraft.map((airframe) => (
              <Card key={airframe.id}>
                <span className="section-eyebrow">{airframe.aircraftType.icaoCode}</span>
                <h2>{airframe.label ?? airframe.registration}</h2>
                <p>
                  {airframe.aircraftType.manufacturer ?? "Constructeur non renseigné"} ·{" "}
                  {airframe.aircraftType.name}
                </p>
                <div className="definition-grid">
                  <div>
                    <span>Immatriculation</span>
                    <strong>{airframe.registration}</strong>
                  </div>
                  <div>
                    <span>Hub</span>
                    <strong>{airframe.hub?.name ?? "Non affecté"}</strong>
                  </div>
                  <div>
                    <span>Catégorie</span>
                    <strong>{formatNullableText(airframe.aircraftType.category)}</strong>
                  </div>
                  <div>
                    <span>Rang minimum</span>
                    <strong>{airframe.aircraftType.minRank?.name ?? "Libre"}</strong>
                  </div>
                </div>
              </Card>
            ))}
          </section>
        )}
      </>
    );
  } catch (error) {
    logWebError("fleet page failed", error);
    return (
      <ErrorState
        title="Flotte indisponible"
        description="La liste des appareils n’a pas pu être chargée."
      />
    );
  }
}
