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
        viewBox="0 0 920 420"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="hero-a320-body" x1="108" y1="152" x2="812" y2="238">
            <stop stopColor="#F8FAFC" stopOpacity="0.98" />
            <stop offset="0.56" stopColor="#E2E8F0" stopOpacity="0.95" />
            <stop offset="1" stopColor="#CBD5E1" stopOpacity="0.88" />
          </linearGradient>
          <linearGradient id="hero-a320-top" x1="364" y1="118" x2="726" y2="156">
            <stop stopColor="#FFFFFF" stopOpacity="0.94" />
            <stop offset="1" stopColor="#E2E8F0" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id="hero-a320-orange" x1="646" y1="108" x2="830" y2="250">
            <stop stopColor="#FF7A1A" />
            <stop offset="1" stopColor="#E65C00" />
          </linearGradient>
          <linearGradient id="hero-a320-wing" x1="350" y1="145" x2="545" y2="310">
            <stop stopColor="#F8FAFC" stopOpacity="0.92" />
            <stop offset="1" stopColor="#94A3B8" stopOpacity="0.78" />
          </linearGradient>
          <linearGradient id="hero-a320-engine" x1="420" y1="220" x2="420" y2="286">
            <stop stopColor="#DCE5F0" stopOpacity="0.96" />
            <stop offset="1" stopColor="#8EA0B5" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        <path
          d="M102 220C103 203 111 186 126 175L193 125C221 105 255 95 290 95H639C664 95 688 107 702 127L726 162L766 176C791 185 807 208 807 234C807 256 791 276 769 284L727 300L706 333C694 351 674 362 652 362H309C277 362 245 352 218 333L126 269C110 258 101 240 102 220Z"
          fill="url(#hero-a320-body)"
        />
        <path
          d="M647 95L729 48C748 37 771 36 791 44L833 61L777 176L647 163V95Z"
          fill="url(#hero-a320-orange)"
        />
        <path
          d="M344 216L507 138L565 143L454 236L598 327L540 334L403 253L273 300H221L331 236L344 216Z"
          fill="url(#hero-a320-wing)"
        />
        <path
          d="M429 216H462L452 286C451 291 447 295 442 296H426C420 296 415 291 415 285L429 216Z"
          fill="url(#hero-a320-engine)"
        />
        <path
          d="M492 206H527L517 282C516 287 512 291 507 292H491C485 292 480 287 480 281L492 206Z"
          fill="url(#hero-a320-engine)"
        />
        <path
          d="M160 192L104 188C94 187 87 180 84 171C82 161 86 151 95 145L133 120L160 128V192Z"
          fill="#F8FAFC"
          fillOpacity="0.9"
        />
        <path
          d="M306 120H639"
          stroke="url(#hero-a320-top)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M228 247H675"
          stroke="#FF7A1A"
          strokeOpacity="0.96"
          strokeWidth="17"
          strokeLinecap="round"
        />
        <path
          d="M337 283H561"
          stroke="#0F172A"
          strokeOpacity="0.28"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M682 82L746 57C761 51 777 49 792 53L811 58L785 120L682 132V82Z"
          fill="#FFFFFF"
          fillOpacity="0.92"
        />
        <path
          d="M752 70H775V108H752V70Z"
          fill="#FFFFFF"
        />
        <path
          d="M763 57V120"
          stroke="#FFFFFF"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M742 89H785"
          stroke="#FFFFFF"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M184 157C194 149 205 143 216 139L246 128"
          stroke="#475569"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M199 172C210 165 224 159 238 155"
          stroke="#475569"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M278 154H621"
          stroke="#334155"
          strokeOpacity="0.22"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="1 24"
        />
        <text
          x="500"
          y="223"
          fill="#FFF7ED"
          fontSize="22"
          fontWeight="700"
          letterSpacing="0.08em"
        >
          easyJet Switzerland
        </text>
        <text
          x="544"
          y="256"
          fill="#FFF7ED"
          fontSize="24"
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
