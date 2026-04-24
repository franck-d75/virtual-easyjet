import type { JSX } from "react";

import { Card } from "@/components/ui/card";

export default function RulesPage(): JSX.Element {
  return (
    <>
      <section className="page-hero">
        <span className="section-eyebrow">Règlement</span>
        <h1>Règlement de la compagnie</h1>
        <p>
          Pour garantir une expérience agréable à tous, chaque pilote doit
          respecter les règles de comportement, de réservation et
          d’exploitation des vols.
        </p>
      </section>

      <section className="card-grid">
        <Card>
          <h2>Comportement</h2>
          <p>
            Chaque pilote doit adopter une attitude respectueuse envers les
            autres membres, le staff et l’environnement de simulation.
          </p>
        </Card>
        <Card>
          <h2>Exploitation</h2>
          <p>
            Les réservations doivent être exploitées de manière cohérente avec
            l’appareil, la route et les outils de suivi fournis par la VA.
          </p>
        </Card>
        <Card>
          <h2>Activité</h2>
          <p>
            Une activité régulière est encouragée afin de maintenir une VA
            vivante, lisible et agréable pour tous les pilotes.
          </p>
        </Card>
        <Card>
          <h2>Sanctions</h2>
          <p>
            En cas de non-respect répété du règlement, le staff peut appliquer
            des mesures adaptées à la gravité de la situation.
          </p>
        </Card>
      </section>
    </>
  );
}
