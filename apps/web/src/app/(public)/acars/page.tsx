import type { JSX } from "react";

import { ContentSection } from "@/components/marketing/content-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { UnofficialDisclaimer } from "@/components/legal/unofficial-disclaimer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ACARS_DOWNLOAD_PROXY_PATH,
  ACARS_PRODUCT_NAME,
  getAcarsCurrentVersion,
} from "@/lib/config/env";

type AcarsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getFirstQueryValue(
  value: string | string[] | undefined,
): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.find((item) => item.trim().length > 0) ?? null;
  }

  return null;
}

export const dynamic = "force-dynamic";

export default async function AcarsPage({
  searchParams,
}: AcarsPageProps): Promise<JSX.Element> {
  const query = await searchParams;
  const version = getAcarsCurrentVersion();
  const downloadConfigured = Boolean(
    process.env.ACARS_DOWNLOAD_URL?.trim() ||
      process.env.NEXT_PUBLIC_ACARS_DOWNLOAD_URL?.trim(),
  );
  const downloadState = getFirstQueryValue(query.download);

  return (
    <>
      <HeroSection
        actions={
          <>
            <Button href={ACARS_DOWNLOAD_PROXY_PATH}>Télécharger</Button>
            <Button href="/connexion" variant="secondary">
              Accéder à mon espace pilote
            </Button>
            <Button href="/routes" variant="ghost">
              Voir le réseau VA
            </Button>
          </>
        }
        aside={
          <div className="hero-aside-content">
            <span className="section-eyebrow">Distribution Windows</span>
            <h2>Un client desktop installé, pas un simple outil de test.</h2>
            <div className="hero-summary-grid">
              <div className="hero-summary-card">
                <span>Version</span>
                <strong>{version}</strong>
                <small>version actuelle</small>
              </div>
              <div className="hero-summary-card">
                <span>Plateforme</span>
                <strong>Windows</strong>
                <small>build x64</small>
              </div>
              <div className="hero-summary-card">
                <span>Modes</span>
                <strong>Réel + mock</strong>
                <small>toujours disponibles</small>
              </div>
              <div className="hero-summary-card">
                <span>Packaging</span>
                <strong>NSIS</strong>
                <small>installeur + portable</small>
              </div>
            </div>
            <p className="hero-aside-note">
              {ACARS_PRODUCT_NAME} est l’extension opérationnelle du site
              Virtual Easyjet : connexion pilote, session ACARS, télémétrie,
              phases de vol et génération du PIREP final.
            </p>
          </div>
        }
        eyebrow="Client ACARS"
        subtitle="Le client Virtual Easyjet ACARS permet de reprendre un vol canonique depuis la plateforme web, d’ouvrir une session ACARS, d’envoyer la télémétrie et de finaliser le PIREP dans une interface Windows sombre, premium et cohérente avec le site."
        title={ACARS_PRODUCT_NAME}
      />

      {downloadState === "unavailable" ? (
        <section className="section-band">
          <Card className="ops-card ops-card--highlight">
            <span className="section-eyebrow">Lien de distribution</span>
            <h2>Le binaire n’est pas encore relié à ce site</h2>
            <p>
              Le bouton de téléchargement est prêt, mais l’URL publique du
              binaire n’est pas encore configurée. Renseignez
              `ACARS_DOWNLOAD_URL` pour activer la distribution web.
            </p>
          </Card>
        </section>
      ) : null}

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Usage</span>
            <h2>À quoi sert le logiciel ?</h2>
          </div>
          <p>
            Le web gère la réservation et le suivi pilote. Le desktop gère
            l’exploitation en temps réel d’un vol déjà créé dans la VA.
          </p>
        </div>

        <section className="panel-grid">
          <Card>
            <span className="section-eyebrow">Fonction principale</span>
            <h2>Exploiter un vol dans un cadre VA</h2>
            <p>
              Chargez vos vols disponibles, ouvrez une session ACARS, envoyez
              la télémétrie mock ou live, suivez la phase détectée et finalisez
              le rapport de vol.
            </p>
          </Card>
          <Card>
            <span className="section-eyebrow">Cohérence produit</span>
            <h2>Le prolongement naturel du site web</h2>
            <p>
              Même thème dark premium, mêmes statuts, mêmes termes métier :
              réservation, vol, session ACARS, PIREP. Le desktop prolonge le
              parcours pilote sans changer de logique.
            </p>
          </Card>
        </section>
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Fonctionnalités</span>
            <h2>Ce que cette version permet déjà</h2>
          </div>
          <p>
            Le périmètre reste volontairement simple et limité au MVP
            opérationnel déjà validé côté backend.
          </p>
        </div>

        <div className="content-grid">
          <ContentSection eyebrow="Desktop" title="Ce que vous pouvez faire">
            <ul className="list-clean">
              <li>connexion pilote en mode réel ou mock</li>
              <li>chargement des réservations et vols exploitables</li>
              <li>création et reprise d’une session ACARS</li>
              <li>envoi de télémétrie manuelle ou mock</li>
              <li>suivi de la phase de vol détectée</li>
              <li>finalisation de session et affichage du PIREP</li>
            </ul>
          </ContentSection>

          <ContentSection eyebrow="Windows" title="Configuration minimale">
            <div className="definition-grid">
              <div>
                <span>Système</span>
                <strong>Windows 10 ou 11 64 bits</strong>
              </div>
              <div>
                <span>Réseau</span>
                <strong>Accès à l’API VA et au service ACARS</strong>
              </div>
              <div>
                <span>Espace disque</span>
                <strong>Environ 500 Mo libres</strong>
              </div>
              <div>
                <span>Mémoire</span>
                <strong>4 Go de RAM recommandés</strong>
              </div>
            </div>
          </ContentSection>
        </div>
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Installation</span>
            <h2>Procédure rapide</h2>
          </div>
          <p>
            Une fois le binaire publié, l’installation doit rester simple pour
            un pilote : télécharger, installer, renseigner les URL backend, se
            connecter et voler.
          </p>
        </div>

        <section className="panel-grid">
          <Card>
            <span className="section-eyebrow">Étapes</span>
            <ol className="list-clean">
              <li>télécharger l’installeur ou la version portable</li>
              <li>lancer Virtual Easyjet ACARS</li>
              <li>renseigner l’API VA et le backend ACARS si nécessaire</li>
              <li>se connecter avec son compte pilote</li>
              <li>charger un vol exploitable puis ouvrir la session ACARS</li>
            </ol>
          </Card>
          <Card>
            <span className="section-eyebrow">Distribution</span>
            <h2>État de la publication</h2>
            <p>
              {downloadConfigured
                ? "Le site est prêt à rediriger vers le binaire public configuré."
                : "Le site est prêt, mais l’URL publique du binaire reste à renseigner."}
            </p>
            <div className="inline-actions">
              <Button href={ACARS_DOWNLOAD_PROXY_PATH}>Télécharger</Button>
              <Button href="/compagnie" variant="secondary">
                En savoir plus sur la VA
              </Button>
            </div>
          </Card>
        </section>
      </section>

      <section className="section-band">
        <UnofficialDisclaimer />
      </section>
    </>
  );
}
