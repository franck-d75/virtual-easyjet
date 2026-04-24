import type { JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function RecruitmentPage(): JSX.Element {
  return (
    <>
      <section className="page-hero">
        <span className="section-eyebrow">Recrutement</span>
        <h1>Rejoindre Virtual Easyjet</h1>
        <p>
          Vous souhaitez intégrer une compagnie aérienne virtuelle moderne et
          active ? Virtual Easyjet accueille les pilotes motivés qui veulent
          voler régulièrement dans un cadre clair, simple et structuré.
        </p>
      </section>

      <div className="two-column">
        <Card>
          <h2>Conditions d’accès</h2>
          <ul className="list-clean">
            <li>Disposer d’un simulateur compatible</li>
            <li>Respecter le règlement de la VA</li>
            <li>Voler de manière sérieuse et respectueuse</li>
            <li>Utiliser les outils de suivi de vol mis à disposition</li>
          </ul>
        </Card>

        <Card>
          <h2>Prêt à commencer ?</h2>
          <p>
            Connectez-vous à votre espace pilote pour exploiter vos vols,
            utiliser l’ACARS et suivre vos PIREPs.
          </p>
          <div className="inline-actions">
            <Button href="/connexion#create-account">Créer un compte</Button>
          </div>
        </Card>
      </div>
    </>
  );
}
