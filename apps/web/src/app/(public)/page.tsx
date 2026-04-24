import type { JSX } from "react";

import { ContentSection } from "@/components/marketing/content-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { StatsStrip } from "@/components/marketing/stats-strip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import {
  getPublicHome,
} from "@/lib/api/public";
import { logWebError } from "@/lib/observability/log";

export const dynamic = "force-dynamic";

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
          aside={
            <div className="hero-aside-content">
              <span className="section-eyebrow">Réseau MVP</span>
              <h2>Une VA exploitable, structurée et crédible dès aujourd’hui.</h2>
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
                Backend live, espace pilote et ACARS MVP sont déjà reliés dans
                une plateforme pensée pour une vraie activité de VA.
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
              <span className="section-eyebrow">Vue d’ensemble</span>
              <h2>Une compagnie virtuelle conçue comme un véritable outil pilote.</h2>
            </div>
            <p>
              Le site public et l’espace pilote partagent une même logique :
              offrir une lecture claire de l’activité, du réseau et des
              opérations sans alourdir l’expérience.
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
              L’objectif n’est pas de multiplier les effets visuels, mais de
              proposer une façade moderne, lisible et crédible pour un usage
              régulier.
            </p>
          </div>
          <div className="content-grid">
            <ContentSection eyebrow="Plateforme" title="Présentation">
              <p>
                Virtual Easyjet est une compagnie aérienne virtuelle non
                officielle, inspirée de l’univers des opérations court et
                moyen-courrier en Europe. Notre objectif est de proposer une
                expérience fluide, accessible et immersive autour du vol en
                ligne, avec ACARS, gestion des vols, suivi des PIREPs et
                progression pilote.
              </p>
            </ContentSection>

            <ContentSection
              eyebrow="Expérience"
              title="Pourquoi nous rejoindre ?"
            >
              <p>
                Une VA simple à prendre en main, structurée pour voler
                régulièrement, progresser, suivre ses performances et profiter
                d’un environnement moderne orienté simulation.
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
              Le MVP relie déjà réservations, vols, ACARS et PIREPs autour
              d’un parcours pilote unique. La page d’accueil met désormais
              davantage cette cohérence en avant.
            </p>
          </div>
          <section className="panel-grid">
            <Card>
              <span className="section-eyebrow">Fonctionnel</span>
              <h2>Un flux pilote cohérent</h2>
              <p>
                Réservations, vols, ACARS et PIREPs sont déjà reliés au backend
                live existant. Le site web s’inscrit directement dans ce socle
                MVP.
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
        description="Les données publiques n’ont pas pu être chargées depuis l’API pour le moment."
      />
    );
  }
}
