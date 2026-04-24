import type { JSX } from "react";

import { Card } from "@/components/ui/card";
import { ContentSection } from "@/components/marketing/content-section";
import { UnofficialDisclaimer } from "@/components/legal/unofficial-disclaimer";

export default function CompanyPage(): JSX.Element {
  return (
    <>
      <section className="page-hero">
        <span className="section-eyebrow">La compagnie</span>
        <h1>À propos de Virtual Easyjet</h1>
        <p>
          Virtual Easyjet est une compagnie aérienne virtuelle non officielle
          créée pour les passionnés de simulation de vol souhaitant évoluer
          dans un cadre moderne, structuré et accessible.
        </p>
      </section>

      <ContentSection title="Notre approche">
        <p>
          Notre plateforme combine un espace web pilote, un système ACARS et un
          suivi précis des vols pour offrir une expérience réaliste sans
          complexité excessive. Que vous soyez pilote débutant ou confirmé,
          vous pouvez réserver vos vols, suivre votre carrière et soumettre vos
          PIREPs dans un environnement pensé pour la régularité et le plaisir
          de voler.
        </p>
      </ContentSection>

      <Card>
        <h2>Information importante</h2>
        <UnofficialDisclaimer />
      </Card>
    </>
  );
}
