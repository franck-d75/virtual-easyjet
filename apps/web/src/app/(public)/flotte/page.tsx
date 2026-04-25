import type { JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { getPublicAircraft } from "@/lib/api/public";
import { logWebError } from "@/lib/observability/log";
import { formatNullableText } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

function getAircraftStatusPresentation(status: string): {
  label: string;
  tone: "success" | "warning" | "neutral";
} {
  switch (status) {
    case "ACTIVE":
      return { label: "En ligne", tone: "success" };
    case "MAINTENANCE":
      return { label: "Maintenance", tone: "warning" };
    case "RETIRED":
      return { label: "Retiré", tone: "neutral" };
    default:
      return { label: status, tone: "neutral" };
  }
}

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
            moyen-courrier, avec des appareils efficaces, fréquents et adaptés
            à un réseau européen moderne.
          </p>
          <p>
            Chaque avion est rattaché à une base, à un type précis et à un
            statut opérationnel lisible pour les pilotes comme pour le staff.
          </p>
        </section>

        {aircraft.length === 0 ? (
          <EmptyState
            title="Flotte indisponible"
            description="Aucun appareil n'est publié pour le moment."
          />
        ) : (
          <section className="card-grid">
            {aircraft.map((airframe) => {
              const status = getAircraftStatusPresentation(airframe.status);

              return (
                <Card
                  key={airframe.id}
                  className="showcase-card showcase-card--aircraft"
                >
                  <div className="showcase-card__header">
                    <div>
                      <span className="section-eyebrow">
                        {airframe.aircraftType.icaoCode}
                      </span>
                      <h2>{airframe.registration}</h2>
                      <p>{airframe.label ?? airframe.aircraftType.name}</p>
                    </div>
                    <Badge label={status.label} tone={status.tone} />
                  </div>

                  <div className="showcase-card__spotlight">
                    <strong>{airframe.aircraftType.name}</strong>
                    <span>
                      {airframe.aircraftType.manufacturer ?? "Constructeur non renseigné"}{" "}
                      · {airframe.hub?.name ?? "Base non affectée"}
                    </span>
                  </div>

                  <div className="definition-grid">
                    <div>
                      <span>Immatriculation</span>
                      <strong>{airframe.registration}</strong>
                    </div>
                    <div>
                      <span>Type</span>
                      <strong>{airframe.aircraftType.name}</strong>
                    </div>
                    <div>
                      <span>Hub</span>
                      <strong>{airframe.hub?.code ?? "Libre"}</strong>
                    </div>
                    <div>
                      <span>Statut</span>
                      <strong>{status.label}</strong>
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
              );
            })}
          </section>
        )}
      </>
    );
  } catch (error) {
    logWebError("fleet page failed", error);
    return (
      <ErrorState
        title="Flotte indisponible"
        description="La liste des appareils n'a pas pu être chargée."
      />
    );
  }
}
