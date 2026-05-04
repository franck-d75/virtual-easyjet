import type { JSX } from "react";

import { UnofficialDisclaimer } from "@/components/legal/unofficial-disclaimer";
import { HeroSection } from "@/components/marketing/hero-section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  type AcarsDownloadTarget,
  type AcarsDownloadVariant,
  resolveAcarsDownloadTargets,
} from "@/lib/acars/download";
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

function getDownloadHref(variant: AcarsDownloadVariant): string {
  return `${ACARS_DOWNLOAD_PROXY_PATH}?variant=${variant}`;
}

function getDownloadSourceLabel(target: AcarsDownloadTarget): string {
  if (target.status === "redirect") {
    return target.source === "configured-url"
      ? "lien public configure"
      : "GitHub Releases";
  }

  return "indisponible";
}

export default async function AcarsPage({
  searchParams,
}: AcarsPageProps): Promise<JSX.Element> {
  await searchParams;

  const version = getAcarsCurrentVersion();
  const downloadTargets = resolveAcarsDownloadTargets();
  const downloadCards = [
    {
      variant: "installer" as const,
      eyebrow: "Installation",
      title: "Version installation",
      helper: "Setup Windows avec raccourcis et integration systeme.",
      buttonLabel: "Telecharger l'installateur",
      target: downloadTargets.installer,
    },
    {
      variant: "portable" as const,
      eyebrow: "Portable",
      title: "Version portable",
      helper: "Executable autonome, pratique pour tester sans installation.",
      buttonLabel: "Telecharger la portable",
      target: downloadTargets.portable,
    },
  ];

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
            <Button href={getDownloadHref("installer")} variant="secondary">
              Version installation
            </Button>
            <Button href={getDownloadHref("portable")} variant="ghost">
              Version portable
            </Button>
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
                <span>Packages Windows</span>
                <strong>2 versions</strong>
                <small>installation et portable</small>
              </div>
              <div className="hero-summary-card">
                <span>Simulateur cible</span>
                <strong>MSFS2024</strong>
                <small>integration SimConnect cote desktop</small>
              </div>
            </div>
            <p className="hero-aside-note">
              {`${ACARS_PRODUCT_NAME} est distribue en version installation et portable. Il se connecte au compte pilote, charge les operations reelles, transmet la telemetrie SimConnect et prepare le PIREP sans trafic fictif.`}
            </p>
          </div>
        }
      />

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Telechargement</span>
            <h2>Choisissez votre package ACARS</h2>
          </div>
          <p>
            Les deux packages pointent vers la version {version}. Les anciennes
            releases restent conservees dans GitHub Releases.
          </p>
        </div>

        <section className="panel-grid">
          {downloadCards.map((downloadCard) => (
            <Card className="ops-card" key={downloadCard.variant}>
              <span className="section-eyebrow">{downloadCard.eyebrow}</span>
              <h2>{downloadCard.title}</h2>
              <p>{downloadCard.helper}</p>
              <div className="definition-grid">
                <div>
                  <span>Version</span>
                  <strong>{version}</strong>
                </div>
                <div>
                  <span>Source</span>
                  <strong>{getDownloadSourceLabel(downloadCard.target)}</strong>
                </div>
                <div>
                  <span>Fichier</span>
                  <strong>
                    {downloadCard.target.status === "missing"
                      ? "Non disponible"
                      : downloadCard.target.fileName}
                  </strong>
                </div>
              </div>
              <div className="inline-actions">
                {downloadCard.target.status === "missing" ? (
                  <Button href="/profil" variant="secondary">
                    Package indisponible
                  </Button>
                ) : (
                  <Button href={getDownloadHref(downloadCard.variant)}>
                    {downloadCard.buttonLabel}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </section>
      </section>

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
            <h2>Deux packages Windows disponibles</h2>
            <p>
              Choisissez l'installateur pour une utilisation reguliere, ou la
              portable pour lancer ACARS sans installation.
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
