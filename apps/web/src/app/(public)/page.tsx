import type { JSX } from "react";

import { ContentSection } from "@/components/marketing/content-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { StatsStrip } from "@/components/marketing/stats-strip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { getPublicHome } from "@/lib/api/public";
import { logWebError } from "@/lib/observability/log";

export const dynamic = "force-dynamic";

function HeroAircraftArtwork(): JSX.Element {
  return (
    <div className="hero-aircraft" aria-hidden="true">
      <svg
        className="hero-aircraft__svg"
        viewBox="0 0 760 420"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="hero-a320-body" x1="120" y1="146" x2="645" y2="274">
            <stop stopColor="#F8FAFC" stopOpacity="0.96" />
            <stop offset="0.52" stopColor="#E2E8F0" stopOpacity="0.92" />
            <stop offset="1" stopColor="#CBD5E1" stopOpacity="0.82" />
          </linearGradient>
          <linearGradient id="hero-a320-orange" x1="470" y1="110" x2="644" y2="268">
            <stop stopColor="#FF7A1A" />
            <stop offset="1" stopColor="#E65C00" />
          </linearGradient>
          <linearGradient id="hero-a320-wing" x1="278" y1="122" x2="442" y2="284">
            <stop stopColor="#F8FAFC" stopOpacity="0.86" />
            <stop offset="1" stopColor="#94A3B8" stopOpacity="0.72" />
          </linearGradient>
        </defs>

        <path
          d="M117 243C116 221 126 196 145 182L221 125C247 105 279 96 311 99H553C604 99 647 136 655 186L663 235C668 267 644 297 612 297H308C273 297 239 288 209 270L143 229C128 220 119 204 117 186Z"
          fill="url(#hero-a320-body)"
          fillOpacity="0.92"
        />
        <path
          d="M532 105L609 53C624 43 643 41 660 47L676 53L624 164L532 149V105Z"
          fill="url(#hero-a320-orange)"
        />
        <path
          d="M278 199L420 111L500 121L375 222L479 313L423 320L323 253L236 287H170L263 236L278 199Z"
          fill="url(#hero-a320-wing)"
          fillOpacity="0.88"
        />
        <path
          d="M160 187L110 181C98 179 89 169 88 157C87 145 93 134 104 129L139 114L160 129V187Z"
          fill="#F8FAFC"
          fillOpacity="0.82"
        />
        <path
          d="M187 170H535"
          stroke="#0F172A"
          strokeOpacity="0.18"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M218 209H532"
          stroke="#FF7A1A"
          strokeOpacity="0.96"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <path
          d="M327 243H443"
          stroke="#0F172A"
          strokeOpacity="0.4"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M554 85L604 58C617 51 632 49 646 53L659 57L631 104L554 120V85Z"
          fill="#FFFFFF"
          fillOpacity="0.95"
        />
        <path d="M611 69H639V96H611V69Z" fill="#FFFFFF" />
        <path d="M621 58V107" stroke="#FFFFFF" strokeWidth="8" />
        <path d="M599 83H648" stroke="#FFFFFF" strokeWidth="8" />
        <path
          d="M490 222C490 215.373 495.373 210 502 210H540C546.627 210 552 215.373 552 222V224C552 230.627 546.627 236 540 236H502C495.373 236 490 230.627 490 224V222Z"
          fill="#0F172A"
          fillOpacity="0.16"
        />
        <path
          d="M507 124H544"
          stroke="#FFFFFF"
          strokeOpacity="0.54"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <text
          x="508"
          y="198"
          fill="#FFF7ED"
          fontSize="18"
          fontWeight="700"
          letterSpacing="0.08em"
        >
          easyJet Switzerland
        </text>
        <text
          x="510"
          y="226"
          fill="#FFF7ED"
          fontSize="20"
          fontWeight="800"
          letterSpacing="0.18em"
        >
          HB-JXB
        </text>
      </svg>
    </div>
  );
}

export default async function HomePage(): Promise<JSX.Element> {
  try {
    const { stats, aircraft, hubs, routes } = await getPublicHome();

    return (
      <>
        <HeroSection
          actions={
            <>
              <Button href="/connexion#create-account">
                Rejoindre la compagnie
              </Button>
              <Button href="/connexion" variant="secondary">
                Se connecter
              </Button>
              <Button href="/flotte" variant="ghost">
                Découvrir la flotte
              </Button>
            </>
          }
          artwork={<HeroAircraftArtwork />}
          aside={
            <div className="hero-aside-content">
              <span className="section-eyebrow">Réseau MVP</span>
              <h2>Une VA exploitable, structurée et crédible dès aujourd&apos;hui.</h2>
              <div className="hero-summary-grid">
                <div className="hero-summary-card">
                  <span>Flotte</span>
                  <strong>{aircraft.length}</strong>
                  <small>appareil(s)</small>
                </div>
                <div className="hero-summary-card">
                  <span>Hubs</span>
                  <strong>{hubs.length}</strong>
                  <small>base(s) active(s)</small>
                </div>
                <div className="hero-summary-card">
                  <span>Routes</span>
                  <strong>{routes.length}</strong>
                  <small>rotation(s) publiée(s)</small>
                </div>
                <div className="hero-summary-card">
                  <span>PIREPs</span>
                  <strong>{stats.validatedPireps}</strong>
                  <small>rapport(s) validé(s)</small>
                </div>
              </div>
              <p className="hero-aside-note">
                Backend live, espace pilote et ACARS sont déjà reliés dans une
                plateforme pensée pour une vraie activité de VA.
              </p>
            </div>
          }
          eyebrow="Compagnie virtuelle"
          subtitle="Rejoignez une compagnie aérienne virtuelle moderne, pensée pour les passionnés de simulation de vol. Effectuez vos rotations, soumettez vos PIREPs et progressez comme un véritable pilote de ligne virtuel."
          title="Bienvenue chez Virtual Easyjet"
        />

        <section className="section-band">
          <div className="section-band__header">
            <div>
              <span className="section-eyebrow">Vue d&apos;ensemble</span>
              <h2>Une compagnie virtuelle conçue comme un véritable outil pilote.</h2>
            </div>
            <p>
              Le site public et l&apos;espace pilote partagent une même logique :
              offrir une lecture claire de l&apos;activité, du réseau et des
              opérations sans alourdir l&apos;expérience.
            </p>
          </div>
          <StatsStrip
            items={[
              { label: "Pilotes actifs", value: stats.activePilots },
              { label: "Vols effectués", value: stats.completedFlights },
              { label: "Heures de vol", value: stats.totalFlightHours },
              { label: "PIREPs validés", value: stats.validatedPireps },
            ]}
          />
        </section>

        <section className="section-band">
          <div className="section-band__header">
            <div>
              <span className="section-eyebrow">Positionnement</span>
              <h2>Une VA premium, sobre et agréable à utiliser dans la durée.</h2>
            </div>
            <p>
              L&apos;objectif n&apos;est pas de multiplier les effets visuels,
              mais de proposer une façade moderne, lisible et crédible pour un
              usage régulier.
            </p>
          </div>
          <div className="content-grid">
            <ContentSection eyebrow="Plateforme" title="Présentation">
              <p>
                Virtual Easyjet est une compagnie aérienne virtuelle non
                officielle, inspirée de l&apos;univers des opérations court et
                moyen-courrier en Europe. Notre objectif est de proposer une
                expérience fluide, accessible et immersive autour du vol en
                ligne, avec ACARS, gestion des vols, suivi des PIREPs et
                progression pilote.
              </p>
            </ContentSection>

            <ContentSection eyebrow="Expérience" title="Pourquoi nous rejoindre ?">
              <p>
                Une VA simple à prendre en main, structurée pour voler
                régulièrement, progresser, suivre ses performances et profiter
                d&apos;un environnement moderne orienté simulation.
              </p>
            </ContentSection>
          </div>
        </section>

        <section className="section-band">
          <div className="section-band__header">
            <div>
              <span className="section-eyebrow">Opérations</span>
              <h2>Un socle cohérent pour réserver, voler et suivre ses rapports.</h2>
            </div>
            <p>
              Le socle actuel relie déjà réservations, vols, ACARS et PIREPs
              autour d&apos;un parcours pilote unique. La page d&apos;accueil met
              désormais davantage cette cohérence en avant.
            </p>
          </div>
          <section className="panel-grid">
            <Card>
              <span className="section-eyebrow">Fonctionnel</span>
              <h2>Un flux pilote cohérent</h2>
              <p>
                Réservations, vols, ACARS et PIREPs sont déjà reliés au backend
                live existant. Le site web s&apos;inscrit directement dans ce
                socle opérationnel.
              </p>
            </Card>
            <Card>
              <span className="section-eyebrow">Orientation</span>
              <h2>Des opérations européennes courtes et régulières</h2>
              <p>
                La flotte, les hubs et le réseau sont pensés pour des rotations
                réalistes, efficaces et faciles à exploiter dans un cadre VA
                clair.
              </p>
            </Card>
          </section>
        </section>
      </>
    );
  } catch (error) {
    logWebError("home page failed", error);
    return (
      <ErrorState
        title="Accueil indisponible"
        description="Les données publiques n'ont pas pu être chargées depuis l'API pour le moment."
      />
    );
  }
}
