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
            <h2>Le poste opérationnel relié au site web</h2>
            <div className="hero-summary-grid">
              <div className="hero-summary-card">
                <span>Version</span>
                <strong>{version}</strong>
                <small>client desktop actuel</small>
              </div>
              <div className="hero-summary-card">
                <span>État</span>
                <strong>
                  {availability === "ONLINE"
                    ? "En ligne"
                    : availability === "IDLE"
                      ? "Disponible"
                      : "Indisponible"}
                </strong>
                <small>
                  {availability === "ONLINE"
                    ? `${activeFlightsCount} vol(s) suivi(s)`
                    : availability === "IDLE"
                      ? "aucun trafic actif"
                      : "vérification à relancer"}
                </small>
              </div>
              <div className="hero-summary-card">
                <span>Carte live</span>
                <strong>/live-map</strong>
                <small>suivi web public</small>
              </div>
              <div className="hero-summary-card">
                <span>Distribution</span>
                <strong>Prête</strong>
                <small>via téléchargement web</small>
              </div>
            </div>
            <p className="hero-aside-note">
              {ACARS_PRODUCT_NAME} permet de charger un vol canonique, d’ouvrir
              une session ACARS, d’envoyer la télémétrie et de finaliser un
              PIREP, sans exposer de route API protégée directement dans le
              navigateur.
            </p>
          </div>
        }
        eyebrow="ACARS"
        subtitle="Le module ACARS regroupe le client desktop, l’état du suivi live et le point d’entrée opérationnel entre l’espace pilote et la carte en direct."
        title="Virtual Easyjet ACARS"
      />

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">État ACARS</span>
            <h2>Disponibilité du module en temps réel</h2>
          </div>
          <p>
            Cette page reste toujours accessible. Si aucun trafic n’est actif,
            l’interface l’indique simplement sans générer d’erreur.
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
                  : "ACARS temporairement indisponible"}
            </h2>
            <p>
              {availability === "ONLINE"
                ? `${activeFlightsCount} avion(s) sont actuellement visibles sur la carte live.`
                : availability === "IDLE"
                  ? "Aucune session ACARS active n’est détectée pour le moment."
                  : "Le service live n’a pas répondu pendant le chargement initial. La page reste disponible et la carte en direct peut être réessayée séparément."}
            </p>
            <div className="inline-actions">
              <Button href="/live-map">Voir la carte en direct</Button>
              <Button href="/dashboard" variant="secondary">
                Revenir à l’espace pilote
              </Button>
            </div>
          </Card>

          <Card className="ops-card">
            <span className="section-eyebrow">Fonction</span>
            <h2>Web pour gérer, ACARS pour exploiter</h2>
            <p>
              Le site web reste l’interface de gestion de la VA. Le client
              desktop prend ensuite le relais pour la session ACARS, la
              télémétrie, la phase de vol et la finalisation du PIREP.
            </p>
          </Card>
        </section>
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Parcours pilote</span>
            <h2>Le flux attendu pour le MVP</h2>
          </div>
          <p>
            Le module ACARS s’intègre au flux déjà validé entre réservation,
            vol, session et rapport final.
          </p>
        </div>

        <section className="panel-grid">
          <Card>
            <span className="section-eyebrow">Depuis le web</span>
            <h2>Préparer et suivre</h2>
            <ul className="list-clean">
              <li>réserver une rotation</li>
              <li>créer un vol canonique</li>
              <li>ouvrir la carte en direct si besoin</li>
            </ul>
          </Card>

          <Card>
            <span className="section-eyebrow">Depuis ACARS</span>
            <h2>Exploiter et finaliser</h2>
            <ul className="list-clean">
              <li>ouvrir la session ACARS</li>
              <li>envoyer la télémétrie mock ou live</li>
              <li>finaliser le PIREP</li>
            </ul>
          </Card>
        </section>
      </section>

      {availability === "IDLE" ? (
        <section className="section-band">
          <EmptyState
            title="Aucun trafic en direct"
            description="Le module ACARS est bien accessible, mais aucune session active n’est visible pour le moment."
          />
        </section>
      ) : null}

      <section className="section-band">
        <UnofficialDisclaimer />
      </section>
    </>
  );
}
