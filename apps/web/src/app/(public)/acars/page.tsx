import type { JSX } from "react";

import { UnofficialDisclaimer } from "@/components/legal/unofficial-disclaimer";
import { HeroSection } from "@/components/marketing/hero-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { resolveAcarsDownloadTarget } from "@/lib/acars/download";
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
  const downloadTarget = resolveAcarsDownloadTarget();

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
        subtitle="Client desktop Windows pour charger les operations Virtual Easyjet, suivre un vol reel via SimConnect et alimenter la live map sans aucune donnee mock."
        actions={
          <>
            <Button href="/live-map">Ouvrir la carte en direct</Button>
            {downloadTarget.status === "missing" ? (
              <Button href="/profil" variant="secondary">
                Build Windows indisponible
              </Button>
            ) : (
              <Button href={ACARS_DOWNLOAD_PROXY_PATH} variant="secondary">
                Telecharger ACARS
              </Button>
            )}
            <Button href="/connexion" variant="ghost">
              Acceder a l'espace pilote
            </Button>
          </>
        }
        aside={
          <div className="hero-aside-content">
            <span className="section-eyebrow">Module ACARS</span>
            <h2>Pret pour le client reel MSFS2024 / SimConnect</h2>
            <div className="hero-summary-grid">
              <div className="hero-summary-card">
                <span>Version</span>
                <strong>{version}</strong>
                <small>distribution Windows</small>
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
                      : "service live a recontroler"}
                </small>
              </div>
              <div className="hero-summary-card">
                <span>Package Windows</span>
                <strong>
                  {downloadTarget.status === "missing"
                    ? "Non publie"
                    : downloadTarget.fileName}
                </strong>
                <small>
                  {downloadTarget.status === "redirect"
                    ? "telecharge depuis une release"
                    : downloadTarget.status === "local"
                      ? "installeur local detecte"
                      : "generez un build ou configurez ACARS_DOWNLOAD_URL"}
                </small>
              </div>
              <div className="hero-summary-card">
                <span>Simulateur cible</span>
                <strong>MSFS2024</strong>
                <small>integration SimConnect cote desktop</small>
              </div>
            </div>
            <p className="hero-aside-note">
              {downloadTarget.status === "missing"
                ? `Aucun build Windows n'est publie pour ${ACARS_PRODUCT_NAME} sur cet environnement. Générez un package avec pnpm --filter @va/acars package ou configurez ACARS_DOWNLOAD_URL.`
                : `${ACARS_PRODUCT_NAME} est distribue comme un vrai client Windows. Il se connecte au compte pilote, charge les operations reelles, transmet la telemetrie SimConnect et prepare le PIREP sans trafic fictif.`}
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
            La compagnie peut demarrer vierge, sans trafic, sans erreur et sans
            donnee simulee.
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
                  : "Le service live n'a pas repondu pendant le chargement initial. La page reste disponible et la carte peut etre rechargee separement."}
            </p>
            <div className="inline-actions">
              <Button href="/live-map">Voir la carte en direct</Button>
              <Button href="/dashboard" variant="secondary">
                Ouvrir l'espace pilote
              </Button>
            </div>
          </Card>

          <Card className="ops-card">
            <span className="section-eyebrow">Distribution</span>
            <h2>
              {downloadTarget.status === "missing"
                ? "Aucun package publie"
                : "Installeur Windows disponible"}
            </h2>
            <p>
              {downloadTarget.status === "missing"
                ? downloadTarget.message
                : `Le telechargement pointe vers ${downloadTarget.fileName}. Le client Electron pilote l'authentification, SimBrief, SimConnect et la session ACARS reelle.`}
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
            Le socle web gere l'identite pilote, SimBrief, les reservations et
            le suivi. Le desktop prend ensuite le relais pour l'exploitation
            live via SimConnect.
          </p>
        </div>

        <section className="panel-grid">
          <Card>
            <span className="section-eyebrow">Depuis le web</span>
            <h2>Preparer le vol</h2>
            <ul className="list-clean">
              <li>se connecter avec le compte pilote</li>
              <li>charger une reservation ou une rotation issue de SimBrief</li>
              <li>verifier la preparation et la carte en direct</li>
            </ul>
          </Card>

          <Card>
            <span className="section-eyebrow">Depuis ACARS</span>
            <h2>Exploiter le vol reel</h2>
            <ul className="list-clean">
              <li>ouvrir une session ACARS canonique</li>
              <li>envoyer la telemetrie live depuis MSFS2024 via SimConnect</li>
              <li>cloturer le vol et preparer le PIREP reel</li>
            </ul>
          </Card>
        </section>
      </section>

      {availability === "IDLE" ? (
        <section className="section-band">
          <EmptyState
            title="Aucun trafic en direct"
            description="Le module ACARS est pret pour le client reel, mais aucune session active n'est visible pour le moment."
          />
        </section>
      ) : null}

      <section className="section-band">
        <UnofficialDisclaimer />
      </section>
    </>
  );
}
