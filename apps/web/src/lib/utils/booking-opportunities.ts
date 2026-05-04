import type { BookingResponse, RouteDetailResponse } from "@/lib/api/types";
import { buildNextBookedForIso } from "@/lib/utils/schedule";

export type BookingOpportunity = {
  route: RouteDetailResponse;
  schedule: RouteDetailResponse["schedules"][number];
  bookedFor: string;
  isRankAllowed: boolean;
  requiredRankName: string | null;
};

export function isActiveBooking(booking: Pick<BookingResponse, "status">): boolean {
  return booking.status === "RESERVED" || booking.status === "IN_PROGRESS";
}

export function buildBookingOpportunities(
  routes: RouteDetailResponse[],
  pilotRankSortOrder: number | null,
): BookingOpportunity[] {
  const opportunities = routes.flatMap((route) =>
    route.schedules.flatMap((schedule) => {
      if (!schedule.isActive || !schedule.aircraft) {
        return [];
      }

      const bookedFor = buildNextBookedForIso(schedule);

      if (!bookedFor) {
        return [];
      }

      const requiredRank = route.aircraftType?.minRank ?? null;

      return [
        {
          route,
          schedule,
          bookedFor,
          isRankAllowed:
            !requiredRank ||
            (pilotRankSortOrder !== null &&
              pilotRankSortOrder >= requiredRank.sortOrder),
          requiredRankName: requiredRank?.name ?? null,
        },
      ];
    }),
  );

  return opportunities.sort((left, right) =>
    left.bookedFor.localeCompare(right.bookedFor),
  );
}

export function buildFirstOpportunityByRouteId(
  opportunities: BookingOpportunity[],
): Map<string, BookingOpportunity> {
  const opportunityByRouteId = new Map<string, BookingOpportunity>();

  for (const opportunity of opportunities) {
    if (!opportunityByRouteId.has(opportunity.route.id)) {
      opportunityByRouteId.set(opportunity.route.id, opportunity);
    }
  }

  return opportunityByRouteId;
}
