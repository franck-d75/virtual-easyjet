import type { JSX } from "react";

import { UnofficialDisclaimer } from "@/components/legal/unofficial-disclaimer";
import { HeroSection } from "@/components/marketing/hero-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getBackendAcarsLiveTraffic } from "@/lib/api/public";
import {
  ACARS_DOWNLOAD_PROXY_PATH,
  ACARS_PRODUCT_NAME,
  getAcarsCurrentVersion,
} from "@/lib/config/env";

type AcarsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type AcarsAvailabilityState = "ONLINE" | "IDLE" | "UNAVAILABLE";

export const dynamic = "force-dynamic";

export default async function AcarsPage({
  searchParams,
}: AcarsPageProps): Promise<JSX.Element> {
  await searchParams;

  const version = getAcarsCurrentVersion();

  let availability: AcarsAvailabilityState = "IDLE";
  let activeFlightsCount = 0;

  try {
    const liveTraffic = await getBackendAcarsLiveTraffic();
    activeFlightsCount = liveTraffic.length;
    availability = liveTraffic.length > 0 ? "ONLINE" : "IDLE";
  } catch {
    availability = "UNAVAILABLE";
  }

  return (
    <>
      <HeroSection
        eyebrow="ACARS"
        title="Virtual Easyjet ACARS"
        subtitle="Le module ACARS relie l’espace pilote, le suivi live et le futur client desktop MSFS2024. La plateforme reste pleinement exploitable même sans trafic actif."
        actions={
          <>
            <Button href="/live-map">Ouvrir la carte en direct</Button>
            <Button href={ACARS_DOWNLOAD_PROXY_PATH} variant="secondary">
              Télécharger ACARS
            </Button>
            <Button href="/connexion" variant="ghost">
              Accéder à l’espace pilote
            </Button>
          </>
        }
        aside={
          <div className="hero-aside-content">
            <span className="section-eyebrow">Module ACARS</span>
            <h2>Prêt pour le client réel MSFS2024 / SimConnect</h2>
            <div className="hero-summary-grid">
              <div className="hero-summary-card">
                <span>Version</span>
                <strong>{version}</strong>
                <small>distribution actuelle</small>
              </div>
              <div className="hero-summary-card">
                <span>État live</span>
                <strong>
                  {availability === "ONLINE"
                    ? "En ligne"
                    : availability === "IDLE"
                      ? "Disponible"
                      : "À vérifier"}
                </strong>
                <small>
                  {availability === "ONLINE"
                    ? `${activeFlightsCount} vol(s) suivi(s)`
                    : availability === "IDLE"
                      ? "aucun trafic actif"
                      : "service live à recontrôler"}
                </small>
              </div>
              <div className="hero-summary-card">
                <span>Carte live</span>
                <strong>/live-map</strong>
                <small>suivi public en temps réel</small>
              </div>
              <div className="hero-summary-card">
                <span>Simulateur cible</span>
                <strong>MSFS2024</strong>
                <small>intégration SimConnect prévue pour la production</small>
              </div>
            </div>
            <p className="hero-aside-note">
              {ACARS_PRODUCT_NAME} reste téléchargeable et la plateforme de
              production ne crée aucune session fictive. Le client desktop réel
              devra se connecter au compte pilote, charger une rotation,
              transmettre la télémétrie SimConnect et préparer un PIREP sans
              données mock.
            </p>
          </div>
        }
      />

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">État ACARS</span>
            <h2>Disponibilité du module en temps réel</h2>
          </div>
          <p>
            Cette page reste accessible même quand aucun avion n’est en ligne.
            La compagnie peut démarrer vierge, sans trafic, sans erreur et sans
            donnée simulée.
          </p>
        </div>

        <section className="panel-grid">
          <Card className="ops-card">
            <span className="section-eyebrow">Synthèse</span>
            <h2>
              {availability === "ONLINE"
                ? "Trafic ACARS actif"
                : availability === "IDLE"
                  ? "Aucun trafic en direct"
                  : "État live temporairement indisponible"}
            </h2>
            <p>
              {availability === "ONLINE"
                ? `${activeFlightsCount} avion(s) sont actuellement visibles sur la carte live.`
                : availability === "IDLE"
                  ? "Aucune session ACARS active n’est détectée pour le moment."
                  : "Le service live n’a pas répondu pendant le chargement initial. La page reste disponible et la carte peut être rechargée séparément."}
            </p>
            <div className="inline-actions">
              <Button href="/live-map">Voir la carte en direct</Button>
              <Button href="/dashboard" variant="secondary">
                Ouvrir l’espace pilote
              </Button>
            </div>
          </Card>

          <Card className="ops-card">
            <span className="section-eyebrow">Mode production</span>
            <h2>Zéro trafic fictif, zéro session simulée</h2>
            <p>
              La seed de production conserve une plateforme vide par défaut. La
              live map, le dashboard pilote et l’administration restent
              fonctionnels même sans flotte, hubs, routes ou vols préchargés.
            </p>
          </Card>
        </section>
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Flux réel cible</span>
            <h2>Le parcours attendu pour le client MSFS2024</h2>
          </div>
          <p>
            Le socle web gère l’identité pilote, SimBrief, les réservations et
            le suivi. Le desktop prendra ensuite le relais pour l’exploitation
            live via SimConnect.
          </p>
        </div>

        <section className="panel-grid">
          <Card>
            <span className="section-eyebrow">Depuis le web</span>
            <h2>Préparer le vol</h2>
            <ul className="list-clean">
              <li>se connecter avec le compte pilote</li>
              <li>charger une réservation ou une rotation issue de SimBrief</li>
              <li>vérifier la préparation et la carte en direct</li>
            </ul>
          </Card>

          <Card>
            <span className="section-eyebrow">Depuis ACARS</span>
            <h2>Exploiter le vol réel</h2>
            <ul className="list-clean">
              <li>ouvrir une session ACARS canonique</li>
              <li>envoyer la télémétrie live depuis MSFS2024 via SimConnect</li>
              <li>clôturer le vol et préparer le PIREP réel</li>
            </ul>
          </Card>
        </section>
      </section>

      {availability === "IDLE" ? (
        <section className="section-band">
          <EmptyState
            title="Aucun trafic en direct"
            description="Le module ACARS est prêt pour le client réel, mais aucune session active n’est visible pour le moment."
          />
        </section>
      ) : null}

      <section className="section-band">
        <UnofficialDisclaimer />
      </section>
    </>
  );
}
