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
        subtitle="Le module ACARS relie l'espace pilote, le suivi live et le futur client desktop MSFS2024. La plateforme reste exploitable meme sans trafic actif."
        actions={
          <>
            <Button href="/live-map">Ouvrir la carte en direct</Button>
            <Button href={ACARS_DOWNLOAD_PROXY_PATH} variant="secondary">
              Telecharger ACARS
            </Button>
            <Button href="/connexion" variant="ghost">
              Acceder a l'espace pilote
            </Button>
          </>
        }
        aside={
          <div className="hero-aside-content">
            <span className="section-eyebrow">Module ACARS</span>
            <h2>Une base propre pour le client desktop reel</h2>
            <div className="hero-summary-grid">
              <div className="hero-summary-card">
                <span>Version</span>
                <strong>{version}</strong>
                <small>distribution actuelle</small>
              </div>
              <div className="hero-summary-card">
                <span>Etat live</span>
                <strong>
                  {availability === "ONLINE"
                    ? "En ligne"
                    : availability === "IDLE"
                      ? "Disponible"
                      : "A verifier"}
                </strong>
                <small>
                  {availability === "ONLINE"
                    ? `${activeFlightsCount} vol(s) suivi(s)`
                    : availability === "IDLE"
                      ? "aucun trafic actif"
                      : "service live a reessayer"}
                </small>
              </div>
              <div className="hero-summary-card">
                <span>Map</span>
                <strong>/live-map</strong>
                <small>suivi public en temps reel</small>
              </div>
              <div className="hero-summary-card">
                <span>Simulateur cible</span>
                <strong>MSFS2024</strong>
                <small>integration SimConnect preparee</small>
              </div>
            </div>
            <p className="hero-aside-note">
              {ACARS_PRODUCT_NAME} reste telechargeable et la plateforme
              production ne cree aucune session fictive. Le client desktop reel
              devra se connecter au compte pilote, charger une rotation, suivre
              le vol et preparer un PIREP sans donnees mock en production.
            </p>
          </div>
        }
      />

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Etat ACARS</span>
            <h2>Disponibilite du module en temps reel</h2>
          </div>
          <p>
            Cette page reste accessible meme quand aucun avion n'est en ligne.
            La compagnie peut demarrer vierge, sans trafic et sans erreur
            technique.
          </p>
        </div>

        <section className="panel-grid">
          <Card className="ops-card">
            <span className="section-eyebrow">Synthese</span>
            <h2>
              {availability === "ONLINE"
                ? "Trafic ACARS actif"
                : availability === "IDLE"
                  ? "Aucun trafic en direct"
                  : "Etat live temporairement indisponible"}
            </h2>
            <p>
              {availability === "ONLINE"
                ? `${activeFlightsCount} avion(s) sont actuellement visibles sur la carte live.`
                : availability === "IDLE"
                  ? "Aucune session ACARS active n'est detectee pour le moment."
                  : "Le service live n'a pas repondu pendant le chargement initial. La page reste disponible et la carte peut etre reessayee separerement."}
            </p>
            <div className="inline-actions">
              <Button href="/live-map">Voir la carte en direct</Button>
              <Button href="/dashboard" variant="secondary">
                Ouvrir l'espace pilote
              </Button>
            </div>
          </Card>

          <Card className="ops-card">
            <span className="section-eyebrow">Mode production</span>
            <h2>Zero trafic fictif, zero session mock</h2>
            <p>
              La seed de production garde la plateforme vide par defaut. La
              live map, le dashboard pilote et l'administration restent
              fonctionnels meme sans flotte, hubs, routes ou vols precharges.
            </p>
          </Card>
        </section>
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Flux reel cible</span>
            <h2>Le parcours attendu pour le client MSFS2024</h2>
          </div>
          <p>
            Le socle web gere l'identite pilote, les reservations, SimBrief et
            le suivi. Le desktop devra ensuite prendre le relais pour
            l'exploitation live via SimConnect.
          </p>
        </div>

        <section className="panel-grid">
          <Card>
            <span className="section-eyebrow">Depuis le web</span>
            <h2>Preparer le vol</h2>
            <ul className="list-clean">
              <li>se connecter avec le compte pilote</li>
              <li>charger une reservation ou une rotation issue de SimBrief</li>
              <li>verifier le vol et la carte en direct</li>
            </ul>
          </Card>

          <Card>
            <span className="section-eyebrow">Depuis ACARS</span>
            <h2>Exploiter le vol reel</h2>
            <ul className="list-clean">
              <li>ouvrir une session ACARS canonique</li>
              <li>envoyer la telemetrie live depuis MSFS2024</li>
              <li>cloturer le vol et preparer le PIREP</li>
            </ul>
          </Card>
        </section>
      </section>

      {availability === "IDLE" ? (
        <section className="section-band">
          <EmptyState
            title="Aucun trafic en direct"
            description="Le module ACARS est bien accessible, mais aucune session active n'est visible pour le moment."
          />
        </section>
      ) : null}

      <section className="section-band">
        <UnofficialDisclaimer />
      </section>
    </>
  );
}
