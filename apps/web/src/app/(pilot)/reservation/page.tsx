import type { JSX } from "react";
import { redirect } from "next/navigation";

import { ApiActionButton } from "@/components/pilot/api-action-button";
import { SimbriefMatchOverviewCard } from "@/components/pilot/simbrief-match-overview-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMyBookings, getMyLatestSimbriefOfp } from "@/lib/api/pilot";
import type { BookingResponse } from "@/lib/api/types";
import { requirePilotSession } from "@/lib/auth/guards";
import { isActiveBooking } from "@/lib/utils/booking-opportunities";
import {
  formatDateTime,
  formatDurationMinutes,
  formatNullableText,
  formatNumber,
} from "@/lib/utils/format";
import {
  buildBookingSimbriefCandidate,
  summarizeSimbriefMatches,
} from "@/lib/utils/simbrief-match";
import { getBookingStatusPresentation } from "@/lib/utils/status";

export const dynamic = "force-dynamic";

function selectFeaturedBooking(bookings: BookingResponse[]): BookingResponse | null {
  const visibleBookings = bookings.filter(
    (booking) => booking.status !== "CANCELLED" && booking.status !== "EXPIRED",
  );
  const activeBookings = visibleBookings.filter(isActiveBooking);
  const readyBookings = activeBookings.filter(
    (booking) => booking.status === "RESERVED" && booking.flight === null,
  );

  return readyBookings[0] ?? activeBookings[0] ?? null;
}

function buildDistanceLabel(booking: BookingResponse): string {
  if (!booking.route?.distanceNm) {
    return "-";
  }

  return `${formatNumber(booking.route.distanceNm)} NM`;
}

function buildFlightLink(booking: BookingResponse): JSX.Element | null {
  if (!booking.flight) {
    return null;
  }

  return (
    <Button href={`/vols?flight=${booking.flight.id}`} variant="secondary">
      Ouvrir le vol
    </Button>
  );
}

export default async function ReservationPage(): Promise<JSX.Element> {
  const session = await requirePilotSession();
  const [bookings, latestSimbriefOfp] = await Promise.all([
    getMyBookings(session.accessToken),
    getMyLatestSimbriefOfp(session.accessToken),
  ]);
  const featuredBooking = selectFeaturedBooking(bookings);

  if (!featuredBooking) {
    redirect("/routes");
  }

  const bookingPresentation = getBookingStatusPresentation(featuredBooking.status);
  const simbriefSummary = summarizeSimbriefMatches(
    latestSimbriefOfp,
    [buildBookingSimbriefCandidate(featuredBooking)],
    "réservation active",
  );

  return (
    <>
      <section className="page-hero">
        <span className="section-eyebrow">Réservation</span>
        <h1>{featuredBooking.reservedFlightNumber}</h1>
        <p>
          Votre vol est réservé. Préparez maintenant la liaison SimBrief pour
          créer le vol exploitable dans ACARS, puis ouvrez-le depuis la page
          Vols.
        </p>
      </section>

      <section className="panel-grid">
        <Card className="ops-card ops-card--highlight">
          <div className="ops-card__header">
            <div>
              <span className="section-eyebrow">Vol réservé</span>
              <h2>
                {featuredBooking.departureAirport.icao} →{" "}
                {featuredBooking.arrivalAirport.icao}
              </h2>
            </div>
            <Badge label={bookingPresentation.label} tone={bookingPresentation.tone} />
          </div>

          <p>
            Départ prévu le {formatDateTime(featuredBooking.bookedFor)} avec{" "}
            {featuredBooking.aircraft.aircraftType.name}.
          </p>

          <div className="definition-grid">
            <div>
              <span>Numéro de vol</span>
              <strong>{featuredBooking.reservedFlightNumber}</strong>
            </div>
            <div>
              <span>Route VA</span>
              <strong>{featuredBooking.route?.code ?? "-"}</strong>
            </div>
            <div>
              <span>Départ</span>
              <strong>{featuredBooking.departureAirport.icao}</strong>
            </div>
            <div>
              <span>Arrivée</span>
              <strong>{featuredBooking.arrivalAirport.icao}</strong>
            </div>
            <div>
              <span>Appareil</span>
              <strong>
                {featuredBooking.aircraft.registration} ·{" "}
                {featuredBooking.aircraft.aircraftType.icaoCode}
              </strong>
            </div>
            <div>
              <span>Distance</span>
              <strong>{buildDistanceLabel(featuredBooking)}</strong>
            </div>
            <div>
              <span>Temps bloc estimé</span>
              <strong>
                {formatDurationMinutes(featuredBooking.route?.blockTimeMinutes ?? null)}
              </strong>
            </div>
            <div>
              <span>Vol ACARS</span>
              <strong>
                {featuredBooking.flight
                  ? formatNullableText(featuredBooking.flight.status)
                  : "À générer"}
              </strong>
            </div>
          </div>

          <div className="inline-actions">
            {featuredBooking.flight ? (
              buildFlightLink(featuredBooking)
            ) : (
              <ApiActionButton
                body={{
                  bookingId: featuredBooking.id,
                  detectedRegistration: featuredBooking.aircraft.registration,
                  detectedAircraftIcao:
                    featuredBooking.aircraft.aircraftType.icaoCode,
                }}
                endpoint="/api/pilot/simbrief/prepare-flight"
                label="Générer via SimBrief"
                pendingLabel="Génération SimBrief..."
                successMessage="Vol SimBrief prêt pour ACARS."
                variant="primary"
              />
            )}
            <Button href="/routes" variant="ghost">
              Retour aux routes
            </Button>
          </div>
        </Card>

        <Card className="ops-card">
          <div className="ops-card__header">
            <div>
              <span className="section-eyebrow">Étape suivante</span>
              <h2>Préparer l'OFP correspondant</h2>
            </div>
            <Badge
              label={latestSimbriefOfp.status === "AVAILABLE" ? "OFP détecté" : "OFP requis"}
              tone={latestSimbriefOfp.status === "AVAILABLE" ? "success" : "warning"}
            />
          </div>
          <p>
            Le bouton SimBrief utilise votre dernier OFP disponible. Il doit
            correspondre à cette réservation pour que le vol ACARS soit créé
            proprement.
          </p>
          <div className="definition-grid">
            <div>
              <span>Dernier OFP</span>
              <strong>
                {formatNullableText(
                  latestSimbriefOfp.plan?.callsign ??
                    latestSimbriefOfp.plan?.flightNumber ??
                    latestSimbriefOfp.pilotId,
                )}
              </strong>
            </div>
            <div>
              <span>Rotation OFP</span>
              <strong>
                {latestSimbriefOfp.plan?.departureIcao &&
                latestSimbriefOfp.plan.arrivalIcao
                  ? `${latestSimbriefOfp.plan.departureIcao} → ${latestSimbriefOfp.plan.arrivalIcao}`
                  : "-"}
              </strong>
            </div>
          </div>
          <div className="inline-actions">
            <Button href="/profil" variant="ghost">
              Gérer SimBrief
            </Button>
          </div>
        </Card>
      </section>

      <section className="section-band">
        <div className="section-band__header">
          <div>
            <span className="section-eyebrow">Contrôle SimBrief</span>
            <h2>Dernier OFP et réservation active</h2>
          </div>
          <p>
            Ce contrôle indique si le dernier OFP SimBrief pointe vers la même
            rotation que le vol réservé.
          </p>
        </div>

        <SimbriefMatchOverviewCard
          latestOfp={latestSimbriefOfp}
          summary={simbriefSummary}
          title="Correspondance avec cette réservation"
        />
      </section>
    </>
  );
}
