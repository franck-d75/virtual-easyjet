import {
  BadRequestException,
  ConflictException,
  Dependencies,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import {
  AircraftStatus,
  BookingStatus,
  FlightStatus,
  Prisma,
} from "@va/database";
import type { AuthenticatedUser } from "@va/shared";

import {
  SimbriefClient,
  type SimbriefAirframeSummary,
  type SimbriefLatestOfpResult,
} from "../../common/integrations/simbrief/simbrief.client.js";
import {
  normalizePrivateSimbriefConfig,
  PRIVATE_SIMBRIEF_CONFIG_SETTING_KEY,
} from "../../common/integrations/simbrief/simbrief-admin-config.js";
import {
  buildSimbriefRouteOverlayFromPlan,
  buildSimbriefRouteOverlaySettingKey,
  normalizePersistedSimbriefRouteOverlay,
  persistableSimbriefRouteOverlay,
  serializeSimbriefRouteOverlay,
} from "../../common/integrations/simbrief/simbrief-route-overlay.js";
import { buildSimbriefFlightPlanLookup } from "../../common/integrations/simbrief/simbrief.utils.js";
import {
  getRequiredPilotProfileId,
  isPrivilegedUser,
} from "../../common/utils/authenticated-user.utils.js";
import { decimalToNumber } from "../../common/utils/decimal.utils.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { BuildMySimbriefDispatchUrlDto } from "./dto/build-my-simbrief-dispatch-url.dto.js";
import type { CreateMySimbriefAirframeDto } from "./dto/create-my-simbrief-airframe.dto.js";
import type { PrepareMySimbriefFlightDto } from "./dto/prepare-my-simbrief-flight.dto.js";
import type { UpdateMyPilotProfileDto } from "./dto/update-my-pilot-profile.dto.js";

const pilotProfileInclude = {
  user: true,
  hub: true,
  rank: true,
} satisfies Prisma.PilotProfileInclude;

type PilotProfileRecord = Prisma.PilotProfileGetPayload<{
  include: typeof pilotProfileInclude;
}>;

const simbriefAirframeInclude = {
  linkedAircraftType: true,
  linkedAircraft: {
    include: {
      aircraftType: true,
      hub: true,
    },
  },
} satisfies Prisma.SimbriefAirframeInclude;

const simbriefDispatchBookingInclude = {
  aircraft: {
    include: {
      aircraftType: true,
      simbriefAirframe: true,
    },
  },
  departureAirport: true,
  arrivalAirport: true,
  route: true,
  flight: true,
} satisfies Prisma.BookingInclude;

type SimbriefAirframeRecord = Prisma.SimbriefAirframeGetPayload<{
  include: typeof simbriefAirframeInclude;
}>;

type SimbriefDispatchBookingRecord = Prisma.BookingGetPayload<{
  include: typeof simbriefDispatchBookingInclude;
}>;

const SIMBRIEF_DISPATCH_API_URL =
  "https://www.simbrief.com/ofp/ofp.loader.api.php";
const DEFAULT_SIMBRIEF_AIRLINE_CODE = "EZS";

const importedRouteInclude = {
  departureAirport: true,
  arrivalAirport: true,
  departureHub: true,
  arrivalHub: true,
  aircraftType: {
    include: {
      minRank: true,
    },
  },
} satisfies Prisma.RouteInclude;

type ImportedRouteRecord = Prisma.RouteGetPayload<{
  include: typeof importedRouteInclude;
}>;

type ProgressSyncSummary = {
  completedFlightsCount: number;
  totalHoursFlownMinutes: number;
  totalExperiencePoints: number;
  promotedRankCode: string | null;
};

function getAvatarUrl(value: unknown): string | null {
  if (
    value &&
    typeof value === "object" &&
    "avatarUrl" in value &&
    (typeof value.avatarUrl === "string" || value.avatarUrl === null)
  ) {
    return value.avatarUrl;
  }

  return null;
}

type SimbriefAirframeSource = "MANUAL" | "SIMBRIEF";

type SimbriefAirframeMetadata = {
  source: SimbriefAirframeSource;
  externalAirframeId: string | null;
  notes: string | null;
};

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readSimbriefAirframeMetadata(rawJson: unknown): SimbriefAirframeMetadata {
  if (!isJsonRecord(rawJson)) {
    return {
      source: "SIMBRIEF",
      externalAirframeId: null,
      notes: null,
    };
  }

  const source = rawJson.source === "MANUAL" ? "MANUAL" : "SIMBRIEF";

  return {
    source,
    externalAirframeId: readOptionalString(rawJson.externalAirframeId),
    notes: readOptionalString(rawJson.notes),
  };
}

function splitSimbriefFlightNumber(value: string): {
  airline: string;
  number: string;
} {
  const normalizedValue = value.trim().toUpperCase();
  const match = normalizedValue.match(/^([A-Z]{2,3})([0-9A-Z]+)$/);

  if (!match) {
    return {
      airline: DEFAULT_SIMBRIEF_AIRLINE_CODE,
      number: normalizedValue,
    };
  }

  return {
    airline: match[1] ?? DEFAULT_SIMBRIEF_AIRLINE_CODE,
    number: match[2] ?? normalizedValue,
  };
}

function buildSimbriefStaticId(bookingId: string): string {
  return `VEZY_${bookingId}`.replace(/[^A-Z0-9_]/gi, "_").toUpperCase();
}

function isSimbriefInternalAirframeId(
  value: string | null | undefined,
): value is string {
  return /^\d+_\d+$/u.test(value?.trim() ?? "");
}

@Injectable()
@Dependencies(PrismaService, SimbriefClient)
export class PilotProfilesService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly simbriefClient: SimbriefClient,
  ) {}

  public async findMe(user: AuthenticatedUser) {
    const pilotProfileId = getRequiredPilotProfileId(user);
    return this.findById(pilotProfileId, user);
  }

  public async getMyLatestSimbriefOfp(
    user: AuthenticatedUser,
    staticId?: string | null,
  ) {
    const profile = await this.getMySimbriefContext(user);

    if (!profile) {
      throw new NotFoundException("Pilot profile not found.");
    }

    const latestOfp = await this.simbriefClient.getLatestOfp(
      profile.simbriefPilotId,
      staticId,
    );

    if (latestOfp.status !== "AVAILABLE" || !latestOfp.plan) {
      return latestOfp;
    }

    const matchedAirframe = await this.findMatchingAirframeForLatestOfp(
      profile.userId,
      latestOfp.plan.aircraft?.simbriefAirframeId ?? null,
      latestOfp.plan.aircraft?.registration ?? null,
      latestOfp.plan.aircraft?.icaoCode ?? null,
    );

    if (latestOfp.plan.routePoints.length >= 2) {
      return this.attachLatestOfpAirframeMatch(latestOfp, matchedAirframe);
    }

    const fallbackRoutePoints = await this.buildAirportFallbackRoutePoints(
      latestOfp.plan.departureIcao,
      latestOfp.plan.arrivalIcao,
    );

    const enrichedLatestOfp = {
      ...latestOfp,
      plan: {
        ...latestOfp.plan,
        routePoints:
          fallbackRoutePoints.length >= 2
            ? fallbackRoutePoints
            : latestOfp.plan.routePoints,
      },
    };

    return this.attachLatestOfpAirframeMatch(enrichedLatestOfp, matchedAirframe);
  }

  public async getMySimbriefRouteOverlay(user: AuthenticatedUser) {
    const profile = await this.getMySimbriefContext(user);

    if (!profile) {
      throw new NotFoundException("Pilot profile not found.");
    }

    const currentFlight = await this.findCurrentRouteOverlayFlight(profile.id);
    let directOverlayFallback: ReturnType<typeof serializeSimbriefRouteOverlay> | null =
      null;

    if (currentFlight?.routeId) {
      const persistedOverlay = await this.getStoredRouteOverlay(currentFlight.routeId);

      if (persistedOverlay) {
        if (persistedOverlay.mode === "WAYPOINTS") {
          return serializeSimbriefRouteOverlay(persistedOverlay);
        }

        directOverlayFallback = serializeSimbriefRouteOverlay(persistedOverlay);
      }
    }

    const latestOfp = await this.getMyLatestSimbriefOfp(user);

    if (latestOfp.status !== "AVAILABLE" || !latestOfp.plan) {
      return null;
    }

    if (
      currentFlight?.routeId &&
      this.doesLatestOfpMatchFlight(latestOfp.plan, currentFlight)
    ) {
      const persistedOverlay = await this.storeRouteOverlayFromPlan(
        currentFlight.routeId,
        latestOfp.plan,
      );

      if (persistedOverlay) {
        return serializeSimbriefRouteOverlay(persistedOverlay);
      }
    }

    const latestOverlay = buildSimbriefRouteOverlayFromPlan(null, latestOfp.plan);

    if (latestOverlay?.mode === "WAYPOINTS") {
      return latestOverlay;
    }

    return directOverlayFallback ?? latestOverlay;
  }

  public async getMySimbriefAirframes(user: AuthenticatedUser) {
    const profile = await this.getMySimbriefContext(user);

    if (!profile) {
      throw new NotFoundException("Pilot profile not found.");
    }

    const persistedAirframes = await this.listPersistedSimbriefAirframes(
      profile.userId,
    );

    if (persistedAirframes.length > 0) {
      return {
        status: "AVAILABLE" as const,
        pilotId: profile.simbriefPilotId,
        detail:
          "Vos airframes SimBrief enregistrees sont disponibles. L'ajout manuel reste la methode fiable pour preparer la flotte reelle.",
        fetchStatus: null,
        fetchedAt: new Date().toISOString(),
        source: profile.simbriefPilotId
          ? buildSimbriefFlightPlanLookup(profile.simbriefPilotId!)
          : null,
        airframes: persistedAirframes.map((airframe) =>
          this.serializePersistedSimbriefAirframe(airframe),
        ),
      };
    }

    if (!profile.simbriefPilotId) {
      return {
        status: "NOT_CONFIGURED" as const,
        pilotId: null,
        detail:
          "Renseignez votre SimBrief Pilot ID pour l'import OFP. Les airframes peuvent etre ajoutees manuellement ci-dessous.",
        fetchStatus: null,
        fetchedAt: new Date().toISOString(),
        source: null,
        airframes: [],
      };
    }

    return {
      status: "NOT_FOUND" as const,
      pilotId: profile.simbriefPilotId,
      detail:
        "SimBrief ne fournit pas de liste airframes via cet endpoint; utilisez l'ajout manuel.",
      fetchStatus: null,
      fetchedAt: new Date().toISOString(),
      source: buildSimbriefFlightPlanLookup(profile.simbriefPilotId!),
      airframes: [],
    };
  }

  public async syncMySimbriefAirframes(user: AuthenticatedUser) {
    const profile = await this.getMySimbriefContext(user);

    if (!profile) {
      throw new NotFoundException("Pilot profile not found.");
    }

    const currentAirframes = await this.listPersistedSimbriefAirframes(
      profile.userId,
    );

    return {
      status: currentAirframes.length > 0 ? ("AVAILABLE" as const) : ("NOT_FOUND" as const),
      pilotId: profile.simbriefPilotId,
      detail:
        "SimBrief ne fournit pas de liste airframes via cet endpoint; utilisez l'ajout manuel.",
      fetchStatus: null,
      fetchedAt: new Date().toISOString(),
      source: profile.simbriefPilotId
        ? buildSimbriefFlightPlanLookup(profile.simbriefPilotId!)
        : null,
      airframes: currentAirframes.map((airframe) =>
        this.serializePersistedSimbriefAirframe(airframe),
      ),
    };
  }

  public async resyncMyProgress(user: AuthenticatedUser) {
    const pilotProfileId = getRequiredPilotProfileId(user);

    const result = await this.prisma.$transaction(async (transaction) => {
      const summary = await this.syncPilotProfileProgress(
        transaction,
        pilotProfileId,
      );
      const profile = await transaction.pilotProfile.findUniqueOrThrow({
        where: { id: pilotProfileId },
        include: pilotProfileInclude,
      });

      return {
        summary,
        profile: this.serializeProfile(profile),
      };
    });

    return {
      message:
        "Les heures de vol, l'XP et le rang ont été recalculés à partir de vos vols terminés.",
      progress: result.summary,
      profile: result.profile,
    };
  }

  public async createMySimbriefAirframe(
    user: AuthenticatedUser,
    dto: CreateMySimbriefAirframeDto,
  ) {
    const profile = await this.getMySimbriefContext(user);

    if (!profile) {
      throw new NotFoundException("Pilot profile not found.");
    }

    console.log("payload:", dto);

    try {
      const normalizedName = dto.name?.trim();
      const normalizedRegistration = dto.registration?.trim().toUpperCase();
      const normalizedIcao =
        dto.icao?.trim().toUpperCase() ??
        dto.aircraftIcao?.trim().toUpperCase() ??
        "A320";
      const normalizedEngineType = dto.engineType?.trim() || "CFM56";
      const normalizedNotes = dto.notes?.trim() || null;
      const normalizedSimbriefAirframeId =
        dto.simbriefAirframeId?.trim() || null;

      if (!normalizedName || !normalizedRegistration || !normalizedIcao) {
        throw new BadRequestException("Invalid airframe data");
      }

      const mappedTypeCode =
        this.simbriefClient.inferAircraftTypeCode(normalizedIcao);

      if (!mappedTypeCode) {
        throw new BadRequestException("Invalid airframe data");
      }

      const linkedAircraftType = await this.prisma.aircraftType.findUnique({
        where: {
          icaoCode: mappedTypeCode,
        },
        select: {
          id: true,
        },
      });

      const persistedAirframeId =
        normalizedSimbriefAirframeId ?? `manual-${randomUUID()}`;

      const airframe = await this.prisma.simbriefAirframe.create({
        data: {
          simbriefAirframeId: persistedAirframeId,
          name: normalizedName,
          aircraftIcao: normalizedIcao,
          registration: normalizedRegistration,
          selcal: null,
          equipment: null,
          engineType: normalizedEngineType,
          wakeCategory: null,
          rawJson: {
            source: "MANUAL",
            externalAirframeId: normalizedSimbriefAirframeId,
            notes: normalizedNotes,
          } satisfies Prisma.InputJsonValue,
          linkedAircraftTypeId: linkedAircraftType?.id ?? null,
          ownerUserId: profile.userId,
          pilotProfileId: profile.id,
        },
        include: simbriefAirframeInclude,
      });

      return this.serializePersistedSimbriefAirframe(airframe);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Cette airframe SimBrief existe deja pour un autre profil ou utilise deja cet identifiant.",
        );
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error("[api][simbrief] create airframe failed", {
        userId: profile.userId,
        pilotProfileId: profile.id,
        payload: dto,
        error: error instanceof Error ? error.message : String(error),
      });

      throw new BadRequestException("Invalid airframe data");
    }
  }

  public async importMySimbriefRoute(user: AuthenticatedUser) {
    const profile = await this.getMySimbriefContext(user);

    if (!profile) {
      throw new NotFoundException("Pilot profile not found.");
    }

    if (!profile.simbriefPilotId) {
      throw new BadRequestException(
        "Configurez d'abord votre SimBrief Pilot ID dans votre profil.",
      );
    }

    const latestOfp = await this.simbriefClient.getLatestOfp(
      profile.simbriefPilotId,
    );

    if (
      latestOfp.status !== "AVAILABLE" ||
      !latestOfp.plan ||
      !latestOfp.plan.departureIcao ||
      !latestOfp.plan.arrivalIcao
    ) {
      throw new BadRequestException(
        latestOfp.detail ??
          "Aucun OFP SimBrief exploitable n'est disponible pour l'import de route.",
      );
    }

    const departureIcao = latestOfp.plan.departureIcao.trim().toUpperCase();
    const arrivalIcao = latestOfp.plan.arrivalIcao.trim().toUpperCase();
    const normalizedFlightNumber =
      latestOfp.plan.flightNumber?.trim().toUpperCase() ||
      latestOfp.plan.callsign?.trim().toUpperCase() ||
      `${departureIcao}${arrivalIcao}`;

    const [departureAirport, arrivalAirport] = await Promise.all([
      this.prisma.airport.findUnique({
        where: { icao: departureIcao },
        select: { id: true, icao: true },
      }),
      this.prisma.airport.findUnique({
        where: { icao: arrivalIcao },
        select: { id: true, icao: true },
      }),
    ]);

    if (!departureAirport || !arrivalAirport) {
      throw new BadRequestException(
        "Le référentiel aéroports doit contenir les aéroports de départ et d'arrivée avant l'import SimBrief.",
      );
    }

    const mappedTypeCode = this.simbriefClient.inferAircraftTypeCode(
      latestOfp.plan.aircraft?.icaoCode,
    );
    const [aircraftType, departureHub, arrivalHub] = await Promise.all([
      mappedTypeCode
        ? this.prisma.aircraftType.findUnique({
            where: { icaoCode: mappedTypeCode },
            select: { id: true },
          })
        : Promise.resolve(null),
      this.prisma.hub.findFirst({
        where: { airportId: departureAirport.id, isActive: true },
        select: { id: true },
      }),
      this.prisma.hub.findFirst({
        where: { airportId: arrivalAirport.id, isActive: true },
        select: { id: true },
      }),
    ]);

    const existingRoute = await this.prisma.route.findFirst({
      where: {
        flightNumber: normalizedFlightNumber,
        departureAirportId: departureAirport.id,
        arrivalAirportId: arrivalAirport.id,
      },
      include: importedRouteInclude,
    });

    const routeNotes = this.buildImportedRouteNotes(latestOfp.plan.route);
    const routeData = {
      flightNumber: normalizedFlightNumber,
      departureAirportId: departureAirport.id,
      arrivalAirportId: arrivalAirport.id,
      departureHubId: departureHub?.id ?? null,
      arrivalHubId: arrivalHub?.id ?? null,
      aircraftTypeId: aircraftType?.id ?? null,
      distanceNm: latestOfp.plan.distanceNm ?? null,
      blockTimeMinutes: latestOfp.plan.blockTimeMinutes ?? null,
      isActive: true,
      notes: routeNotes,
    } satisfies Omit<Prisma.RouteUncheckedCreateInput, "code">;

    const route = existingRoute
      ? await this.prisma.route.update({
          where: { id: existingRoute.id },
          data: routeData,
          include: importedRouteInclude,
        })
      : await this.prisma.route.create({
          data: {
            code: await this.generateImportedRouteCode(
              normalizedFlightNumber,
              departureIcao,
              arrivalIcao,
            ),
            ...routeData,
          },
          include: importedRouteInclude,
        });

    await this.storeRouteOverlayFromPlan(route.id, latestOfp.plan);

    return {
      action: existingRoute ? "updated" : "created",
      message: existingRoute
        ? "La route SimBrief existante a été mise à jour."
        : "La route SimBrief a été créée avec succès.",
      route: this.serializeImportedRoute(route),
    };
  }

  public async buildMySimbriefDispatchUrl(
    user: AuthenticatedUser,
    payload: BuildMySimbriefDispatchUrlDto,
  ) {
    const profile = await this.getMySimbriefContext(user);

    if (!profile) {
      throw new NotFoundException("Pilot profile not found.");
    }

    if (!profile.simbriefPilotId) {
      throw new BadRequestException(
        "Configurez d'abord votre SimBrief Pilot ID dans votre profil.",
      );
    }

    const bookingId = payload.bookingId?.trim();

    if (!bookingId) {
      throw new BadRequestException("La reservation est requise.");
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: simbriefDispatchBookingInclude,
    });

    if (!booking) {
      throw new NotFoundException("Reservation introuvable.");
    }

    this.assertSimbriefDispatchBookingUsable(profile.id, booking);

    const dispatchParams = this.buildSimbriefDispatchParams(
      profile.simbriefPilotId,
      booking,
    );
    const staticId = dispatchParams.get("static_id") ?? "";
    const apiKey = await this.getPrivateSimbriefApiKey();
    const returnUrl = this.normalizeSimbriefReturnUrl(payload.returnUrl);

    if (!apiKey) {
      throw new BadRequestException(
        "Configurez d'abord la cle API SimBrief dans l'administration.",
      );
    }

    if (!returnUrl) {
      throw new BadRequestException(
        "Une page de retour valide est requise pour generer via SimBrief.",
      );
    }

    const timestamp = Math.floor(Date.now() / 1_000).toString();
    const origin = dispatchParams.get("orig") ?? "";
    const destination = dispatchParams.get("dest") ?? "";
    const type = dispatchParams.get("type") ?? "";
    const apicode = createHash("md5")
      .update(`${apiKey}${origin}${destination}${type}${timestamp}${returnUrl}`)
      .digest("hex");
    const signedParams = new URLSearchParams(dispatchParams);
    signedParams.set("timestamp", timestamp);
    signedParams.set("outputpage", returnUrl);
    signedParams.set("apicode", apicode);

    return {
      url: `${SIMBRIEF_DISPATCH_API_URL}?${signedParams.toString()}`,
      mode: "api" as const,
      staticId,
      aircraftTypeInput: type,
    };
  }

  public async prepareMySimbriefFlight(
    user: AuthenticatedUser,
    payload: PrepareMySimbriefFlightDto,
  ) {
    const profile = await this.getMySimbriefContext(user);

    if (!profile) {
      throw new NotFoundException("Pilot profile not found.");
    }

    if (!profile.simbriefPilotId) {
      throw new BadRequestException(
        "Configurez d'abord votre SimBrief Pilot ID dans votre profil.",
      );
    }

    const latestOfp = await this.simbriefClient.getLatestOfp(
      profile.simbriefPilotId,
    );

    if (
      latestOfp.status !== "AVAILABLE" ||
      !latestOfp.plan ||
      !latestOfp.plan.departureIcao ||
      !latestOfp.plan.arrivalIcao
    ) {
      throw new BadRequestException(
        latestOfp.detail ??
          "Aucun OFP SimBrief exploitable n'est disponible pour preparer un vol ACARS.",
      );
    }

    const departureIcao = latestOfp.plan.departureIcao.trim().toUpperCase();
    const arrivalIcao = latestOfp.plan.arrivalIcao.trim().toUpperCase();
    const normalizedFlightNumber =
      latestOfp.plan.flightNumber?.trim().toUpperCase() ||
      latestOfp.plan.callsign?.trim().toUpperCase() ||
      `${departureIcao}${arrivalIcao}`;
    const normalizedDetectedRegistration =
      payload.detectedRegistration?.trim().toUpperCase() || null;
    const normalizedDetectedAircraftIcao =
      payload.detectedAircraftIcao?.trim().toUpperCase() || null;

    const [departureAirport, arrivalAirport] = await Promise.all([
      this.prisma.airport.findUnique({
        where: { icao: departureIcao },
        select: { id: true, icao: true },
      }),
      this.prisma.airport.findUnique({
        where: { icao: arrivalIcao },
        select: { id: true, icao: true },
      }),
    ]);

    if (!departureAirport || !arrivalAirport) {
      throw new BadRequestException(
        "Le referentiel aeroports doit contenir les aeroports de depart et d'arrivee avant la preparation ACARS.",
      );
    }

    const matchedAirframe = await this.findMatchingAirframeForLatestOfp(
      profile.userId,
      latestOfp.plan.aircraft?.simbriefAirframeId ?? null,
      normalizedDetectedRegistration ??
        latestOfp.plan.aircraft?.registration ??
        null,
      normalizedDetectedAircraftIcao ??
        latestOfp.plan.aircraft?.icaoCode ??
        null,
    );

    const selectedAircraft =
      await this.resolveAircraftForPreparedSimbriefFlight(
        profile.userId,
        matchedAirframe,
        normalizedDetectedRegistration,
        normalizedDetectedAircraftIcao ??
          latestOfp.plan.aircraft?.icaoCode ??
          null,
        latestOfp.plan.aircraft?.registration ?? null,
      );

    if (!selectedAircraft) {
      throw new BadRequestException(
        "Aucun appareil flotte actif ne correspond a cet OFP SimBrief. Liez d'abord l'airframe SimBrief ou creez l'appareil reel dans Admin > Flotte.",
      );
    }

    const route = await this.upsertSimbriefRouteFromLatestOfp(
      latestOfp,
      departureAirport.id,
      arrivalAirport.id,
      departureIcao,
      arrivalIcao,
      normalizedFlightNumber,
      selectedAircraft.aircraftTypeId,
    );

    const bookingNotes = this.buildPreparedSimbriefBookingNotes(
      normalizedFlightNumber,
      departureIcao,
      arrivalIcao,
      latestOfp.plan.route ?? null,
      selectedAircraft.registration,
    );

    const preparedFlight = await this.prisma.$transaction(async (transaction) => {
      const existingFlight = await transaction.flight.findFirst({
        where: {
          pilotProfileId: profile.id,
          flightNumber: normalizedFlightNumber,
          departureAirportId: departureAirport.id,
          arrivalAirportId: arrivalAirport.id,
          aircraftId: selectedAircraft.id,
          status: {
            in: [FlightStatus.PLANNED, FlightStatus.IN_PROGRESS],
          },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          bookingId: true,
          status: true,
        },
      });

      if (existingFlight) {
        return {
          action: "reused" as const,
          flightId: existingFlight.id,
          bookingId: existingFlight.bookingId,
          persistedStatus: existingFlight.status,
        };
      }

      const existingBooking = await transaction.booking.findFirst({
        where: {
          pilotProfileId: profile.id,
          reservedFlightNumber: normalizedFlightNumber,
          departureAirportId: departureAirport.id,
          arrivalAirportId: arrivalAirport.id,
          aircraftId: selectedAircraft.id,
          status: {
            in: [BookingStatus.RESERVED, BookingStatus.IN_PROGRESS],
          },
          notes: bookingNotes,
        },
        include: {
          flight: {
            select: {
              id: true,
              bookingId: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      if (existingBooking?.flight) {
        return {
          action: "reused" as const,
          flightId: existingBooking.flight.id,
          bookingId: existingBooking.flight.bookingId,
          persistedStatus: existingBooking.flight.status,
        };
      }

      const booking =
        existingBooking ??
        (await transaction.booking.create({
          data: {
            pilotProfileId: profile.id,
            routeId: route?.id ?? null,
            aircraftId: selectedAircraft.id,
            departureAirportId: departureAirport.id,
            arrivalAirportId: arrivalAirport.id,
            reservedFlightNumber: normalizedFlightNumber,
            bookedFor: new Date(),
            status: BookingStatus.RESERVED,
            notes: bookingNotes,
          },
          select: {
            id: true,
            bookedFor: true,
          },
        }));

      if (existingBooking) {
        await transaction.booking.update({
          where: { id: existingBooking.id },
          data: {
            routeId: route?.id ?? null,
            notes: bookingNotes,
          },
        });
      }

      const createdFlight = await transaction.flight.create({
        data: {
          bookingId: booking.id,
          pilotProfileId: profile.id,
          routeId: route?.id ?? null,
          aircraftId: selectedAircraft.id,
          departureAirportId: departureAirport.id,
          arrivalAirportId: arrivalAirport.id,
          flightNumber: normalizedFlightNumber,
          status: FlightStatus.PLANNED,
          plannedOffBlockAt: booking.bookedFor,
        },
        select: {
          id: true,
          bookingId: true,
          status: true,
        },
      });

      return {
        action: existingBooking ? ("updated" as const) : ("created" as const),
        flightId: createdFlight.id,
        bookingId: createdFlight.bookingId,
        persistedStatus: createdFlight.status,
      };
    });

    return {
      action: preparedFlight.action,
      message:
        preparedFlight.action === "reused"
          ? "Le vol SimBrief etait deja exploitable dans ACARS."
          : "Le vol SimBrief est pret pour ACARS.",
      status: "READY" as const,
      flightId: preparedFlight.flightId,
      bookingId: preparedFlight.bookingId,
      persistedStatus: preparedFlight.persistedStatus,
      flightNumber: normalizedFlightNumber,
      departureIcao,
      arrivalIcao,
      route: latestOfp.plan.route ?? null,
      distanceNm: latestOfp.plan.distanceNm ?? null,
      blockTimeMinutes: latestOfp.plan.blockTimeMinutes ?? null,
      aircraft: {
        id: selectedAircraft.id,
        registration: selectedAircraft.registration,
        label: selectedAircraft.label,
        aircraftType: {
          icaoCode: selectedAircraft.aircraftType.icaoCode,
          name: selectedAircraft.aircraftType.name,
        },
      },
    };
  }

  public async updateMe(
    user: AuthenticatedUser,
    payload: UpdateMyPilotProfileDto,
  ) {
    const pilotProfileId = getRequiredPilotProfileId(user);
    const username = payload.username?.trim().toLowerCase() ?? undefined;
    const firstName = payload.firstName?.trim() ?? undefined;
    const lastName = payload.lastName?.trim() ?? undefined;
    const pilotNumber = payload.pilotNumber?.trim().toUpperCase() ?? undefined;
    const callsign =
      payload.callsign !== undefined
        ? payload.callsign?.trim().toUpperCase() || null
        : undefined;
    const countryCode =
      payload.countryCode !== undefined
        ? payload.countryCode?.trim().toUpperCase() || null
        : undefined;
    const simbriefPilotId =
      payload.simbriefPilotId !== undefined
        ? payload.simbriefPilotId?.trim() || null
        : undefined;
    const preferredHubId =
      payload.preferredHubId !== undefined
        ? payload.preferredHubId?.trim() || null
        : undefined;

    try {
      const profile = await this.prisma.$transaction(async (transaction) => {
        const existingProfile = await transaction.pilotProfile.findUnique({
          where: { id: pilotProfileId },
          include: {
            user: true,
          },
        });

        if (!existingProfile) {
          throw new NotFoundException("Pilot profile not found.");
        }

        if (preferredHubId) {
          const hub = await transaction.hub.findUnique({
            where: { id: preferredHubId },
            select: { id: true },
          });

          if (!hub) {
            throw new BadRequestException("Le hub préféré sélectionné est introuvable.");
          }
        }

        const userUpdateData: Prisma.UserUpdateInput = {};
        const profileUpdateData: Prisma.PilotProfileUpdateInput = {};

        if (username !== undefined) {
          userUpdateData.username = username;
        }

        if (firstName !== undefined) {
          profileUpdateData.firstName = firstName;
        }

        if (lastName !== undefined) {
          profileUpdateData.lastName = lastName;
        }

        if (pilotNumber !== undefined) {
          profileUpdateData.pilotNumber = pilotNumber;
        }

        if (callsign !== undefined) {
          profileUpdateData.callsign = callsign;
        }

        if (countryCode !== undefined) {
          profileUpdateData.countryCode = countryCode;
        }

        if (simbriefPilotId !== undefined) {
          profileUpdateData.simbriefPilotId = simbriefPilotId;
        }

        if (preferredHubId !== undefined) {
          profileUpdateData.hub = preferredHubId
            ? {
                connect: {
                  id: preferredHubId,
                },
              }
            : {
                disconnect: true,
              };
        }

        if (Object.keys(userUpdateData).length > 0) {
          await transaction.user.update({
            where: { id: existingProfile.userId },
            data: userUpdateData,
          });
        }

        if (Object.keys(profileUpdateData).length > 0) {
          await transaction.pilotProfile.update({
            where: { id: pilotProfileId },
            data: profileUpdateData,
          });
        }

        return transaction.pilotProfile.findUniqueOrThrow({
          where: { id: pilotProfileId },
          include: pilotProfileInclude,
        });
      });

      return this.serializeProfile(profile);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(",")
          : "";

        if (target.includes("username")) {
          throw new ConflictException(
            "Ce nom d'utilisateur est déjà utilisé par un autre compte.",
          );
        }

        if (target.includes("pilotNumber")) {
          throw new ConflictException(
            "Ce numéro pilote est déjà attribué à un autre pilote.",
          );
        }

        if (target.includes("callsign")) {
          throw new ConflictException(
            "Cet indicatif est déjà attribué à un autre pilote.",
          );
        }

        throw new ConflictException(
          "Ce SimBrief Pilot ID est déjà associé à un autre pilote.",
        );
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("Pilot profile not found.");
      }

      throw error;
    }
  }

  public async listProfiles() {
    const profiles = await this.prisma.pilotProfile.findMany({
      orderBy: { joinedAt: "desc" },
      include: pilotProfileInclude,
    });

    return profiles.map((profile) => this.serializeProfile(profile));
  }

  public async findById(id: string, requester: AuthenticatedUser) {
    if (!isPrivilegedUser(requester) && requester.pilotProfileId !== id) {
      throw new ForbiddenException("You cannot access this pilot profile.");
    }

    const profile = await this.prisma.pilotProfile.findUnique({
      where: { id },
      include: pilotProfileInclude,
    });

    if (!profile) {
      throw new NotFoundException("Pilot profile not found.");
    }

    return this.serializeProfile(profile);
  }

  private async syncPilotProfileProgress(
    transaction: Prisma.TransactionClient,
    pilotProfileId: string,
  ): Promise<ProgressSyncSummary> {
    const [pilotProfile, completedFlightsCount, completedFlightMinutes, activeRanks] =
      await Promise.all([
        transaction.pilotProfile.findUniqueOrThrow({
          where: { id: pilotProfileId },
          include: {
            rank: true,
          },
        }),
        transaction.flight.count({
          where: {
            pilotProfileId,
            status: FlightStatus.COMPLETED,
          },
        }),
        transaction.flight.aggregate({
          where: {
            pilotProfileId,
            status: FlightStatus.COMPLETED,
          },
          _sum: {
            durationMinutes: true,
          },
        }),
        transaction.rank.findMany({
          where: {
            isActive: true,
          },
          orderBy: {
            sortOrder: "asc",
          },
        }),
      ]);

    const totalHoursFlownMinutes = Math.max(
      completedFlightMinutes._sum.durationMinutes ?? 0,
      0,
    );
    const totalExperiencePoints = totalHoursFlownMinutes;
    const highestEligibleRank =
      activeRanks
        .filter(
          (rank) =>
            rank.minFlights <= completedFlightsCount &&
            rank.minHoursMinutes <= totalHoursFlownMinutes,
        )
        .sort((left, right) => right.sortOrder - left.sortOrder)[0] ?? null;
    const currentRankSortOrder = pilotProfile.rank?.sortOrder ?? -1;
    const nextRankId =
      highestEligibleRank && highestEligibleRank.sortOrder > currentRankSortOrder
        ? highestEligibleRank.id
        : pilotProfile.rankId;

    await transaction.pilotProfile.update({
      where: { id: pilotProfileId },
      data: {
        hoursFlownMinutes: totalHoursFlownMinutes,
        experiencePoints: totalExperiencePoints,
        rankId: nextRankId,
      },
    });

    return {
      completedFlightsCount,
      totalHoursFlownMinutes,
      totalExperiencePoints,
      promotedRankCode:
        nextRankId === pilotProfile.rankId ? null : highestEligibleRank?.code ?? null,
    };
  }

  private async buildAirportFallbackRoutePoints(
    departureIcao: string | null,
    arrivalIcao: string | null,
  ) {
    const requestedIcaos = [departureIcao, arrivalIcao].filter(
      (icao): icao is string => typeof icao === "string" && icao.length > 0,
    );

    if (requestedIcaos.length < 2) {
      return [];
    }

    const airports = await this.prisma.airport.findMany({
      where: {
        icao: {
          in: requestedIcaos.map((icao) => icao.toUpperCase()),
        },
      },
      select: {
        icao: true,
        latitude: true,
        longitude: true,
      },
    });

    const airportMap = new Map(
      airports.map((airport) => [
        airport.icao.toUpperCase(),
        {
          lat: decimalToNumber(airport.latitude),
          lon: decimalToNumber(airport.longitude),
        },
      ]),
    );

    const departure = airportMap.get(departureIcao?.toUpperCase() ?? "");
    const arrival = airportMap.get(arrivalIcao?.toUpperCase() ?? "");

    if (
      departure?.lat === null ||
      departure?.lat === undefined ||
      departure?.lon === null ||
      departure?.lon === undefined ||
      arrival?.lat === null ||
      arrival?.lat === undefined ||
      arrival?.lon === null ||
      arrival?.lon === undefined
    ) {
      return [];
    }

    return [
      {
        ident: departureIcao,
        lat: departure.lat,
        lon: departure.lon,
        source: "ORIGIN" as const,
      },
      {
        ident: arrivalIcao,
        lat: arrival.lat,
        lon: arrival.lon,
        source: "DESTINATION" as const,
      },
    ];
  }

  private async findCurrentRouteOverlayFlight(pilotProfileId: string) {
    const activeFlight = await this.prisma.flight.findFirst({
      where: {
        pilotProfileId,
        status: FlightStatus.IN_PROGRESS,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        routeId: true,
        flightNumber: true,
        departureAirport: {
          select: {
            icao: true,
          },
        },
        arrivalAirport: {
          select: {
            icao: true,
          },
        },
      },
    });

    if (activeFlight) {
      return activeFlight;
    }

    return this.prisma.flight.findFirst({
      where: {
        pilotProfileId,
        status: FlightStatus.PLANNED,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        routeId: true,
        flightNumber: true,
        departureAirport: {
          select: {
            icao: true,
          },
        },
        arrivalAirport: {
          select: {
            icao: true,
          },
        },
      },
    });
  }

  private doesLatestOfpMatchFlight(
    plan: NonNullable<SimbriefLatestOfpResult["plan"]>,
    flight: Awaited<ReturnType<PilotProfilesService["findCurrentRouteOverlayFlight"]>>,
  ) {
    if (!flight) {
      return false;
    }

    const normalizedPlanFlightNumber =
      plan.flightNumber?.trim().toUpperCase() ??
      plan.callsign?.trim().toUpperCase() ??
      null;

    return (
      normalizedPlanFlightNumber === flight.flightNumber.trim().toUpperCase() &&
      plan.departureIcao?.trim().toUpperCase() ===
        flight.departureAirport.icao.trim().toUpperCase() &&
      plan.arrivalIcao?.trim().toUpperCase() ===
        flight.arrivalAirport.icao.trim().toUpperCase()
    );
  }

  private async getStoredRouteOverlay(routeId: string) {
    const setting = await this.prisma.setting.findUnique({
      where: {
        key: buildSimbriefRouteOverlaySettingKey(routeId),
      },
      select: {
        value: true,
      },
    });

    return normalizePersistedSimbriefRouteOverlay(setting?.value);
  }

  private async storeRouteOverlayFromPlan(
    routeId: string,
    plan: NonNullable<SimbriefLatestOfpResult["plan"]>,
  ) {
    const overlay = persistableSimbriefRouteOverlay(routeId, plan);

    if (!overlay) {
      return null;
    }

    await this.prisma.setting.upsert({
      where: {
        key: buildSimbriefRouteOverlaySettingKey(routeId),
      },
      update: {
        value: overlay as unknown as Prisma.InputJsonValue,
        isPublic: false,
        description:
          "Tracé détaillé SimBrief (navlog/dispatch) associé à une route importée.",
      },
      create: {
        key: buildSimbriefRouteOverlaySettingKey(routeId),
        value: overlay as unknown as Prisma.InputJsonValue,
        isPublic: false,
        description:
          "Tracé détaillé SimBrief (navlog/dispatch) associé à une route importée.",
      },
    });

    return overlay;
  }

  private async listPersistedSimbriefAirframes(userId: string) {
    return this.prisma.simbriefAirframe.findMany({
      where: {
        ownerUserId: userId,
      },
      orderBy: [{ registration: "asc" }, { name: "asc" }],
      include: simbriefAirframeInclude,
    });
  }

  private assertSimbriefDispatchBookingUsable(
    pilotProfileId: string,
    booking: SimbriefDispatchBookingRecord,
  ): void {
    if (booking.pilotProfileId !== pilotProfileId) {
      throw new ForbiddenException("Cette reservation appartient a un autre pilote.");
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException("Cette reservation est deja annulee.");
    }

    if (booking.status === BookingStatus.EXPIRED) {
      throw new BadRequestException("Cette reservation est expiree.");
    }

    if (booking.flight) {
      throw new BadRequestException("Un vol ACARS existe deja pour cette reservation.");
    }
  }

  private buildSimbriefDispatchParams(
    simbriefPilotId: string,
    booking: SimbriefDispatchBookingRecord,
  ): URLSearchParams {
    const departureIcao = booking.departureAirport.icao.trim().toUpperCase();
    const arrivalIcao = booking.arrivalAirport.icao.trim().toUpperCase();
    const flightNumber = booking.reservedFlightNumber.trim().toUpperCase();
    const flightNumberParts = splitSimbriefFlightNumber(flightNumber);
    const airframeMetadata = booking.aircraft.simbriefAirframe
      ? readSimbriefAirframeMetadata(booking.aircraft.simbriefAirframe.rawJson)
      : null;
    const persistedAirframeId =
      booking.aircraft.simbriefAirframe?.simbriefAirframeId?.trim() ?? null;
    const externalAirframeId = airframeMetadata?.externalAirframeId ?? null;
    const aircraftTypeInput = isSimbriefInternalAirframeId(persistedAirframeId)
      ? persistedAirframeId
      : isSimbriefInternalAirframeId(externalAirframeId)
        ? externalAirframeId
        : booking.aircraft.aircraftType.icaoCode.trim().toUpperCase();
    const params = new URLSearchParams({
      userid: simbriefPilotId.trim(),
      static_id: buildSimbriefStaticId(booking.id),
      airline: flightNumberParts.airline,
      fltnum: flightNumberParts.number,
      callsign: flightNumber,
      orig: departureIcao,
      dest: arrivalIcao,
      type: aircraftTypeInput,
      reg: booking.aircraft.registration.trim().toUpperCase(),
      altn: "AUTO",
      toaltn: "AUTO",
      eualtn: "AUTO",
      units: "KGS",
      navlog: "1",
      planformat: "LIDO",
    });

    if (booking.route?.blockTimeMinutes) {
      const hours = Math.floor(booking.route.blockTimeMinutes / 60);
      const minutes = booking.route.blockTimeMinutes % 60;
      params.set("steh", hours.toString());
      params.set("stem", minutes.toString());
    }

    return params;
  }

  private async getPrivateSimbriefApiKey(): Promise<string | null> {
    const setting = await this.prisma.setting.findUnique({
      where: {
        key: PRIVATE_SIMBRIEF_CONFIG_SETTING_KEY,
      },
      select: {
        value: true,
      },
    });
    return normalizePrivateSimbriefConfig(setting?.value).apiKey;
  }

  private normalizeSimbriefReturnUrl(value: string | null | undefined) {
    const rawValue = value?.trim() ?? "";

    if (rawValue.length === 0) {
      return null;
    }

    try {
      const parsedUrl = new URL(rawValue);
      return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:"
        ? parsedUrl.toString()
        : null;
    } catch {
      return null;
    }
  }

  private async getMySimbriefContext(user: AuthenticatedUser) {
    const pilotProfileId = getRequiredPilotProfileId(user);

    return this.prisma.pilotProfile.findUnique({
      where: { id: pilotProfileId },
      select: {
        id: true,
        userId: true,
        simbriefPilotId: true,
      },
    });
  }

  private async findMatchingAirframeForLatestOfp(
    userId: string,
    simbriefAirframeId: string | null,
    registration: string | null,
    aircraftIcao: string | null,
  ): Promise<SimbriefAirframeRecord | null> {
    if (simbriefAirframeId) {
      const directMatch = await this.prisma.simbriefAirframe.findUnique({
        where: {
          simbriefAirframeId,
        },
        include: simbriefAirframeInclude,
      });

      if (directMatch) {
        return directMatch;
      }
    }

    if (!registration && !aircraftIcao) {
      return null;
    }

    return this.prisma.simbriefAirframe.findFirst({
      where: {
        ownerUserId: userId,
        ...(registration
          ? {
              registration: registration.toUpperCase(),
            }
          : {}),
        ...(aircraftIcao
          ? {
              aircraftIcao: aircraftIcao.toUpperCase(),
            }
          : {}),
      },
      include: simbriefAirframeInclude,
    });
  }

  private async resolveAircraftForPreparedSimbriefFlight(
    userId: string,
    matchedAirframe: SimbriefAirframeRecord | null,
    detectedRegistration: string | null,
    detectedAircraftIcao: string | null,
    latestOfpRegistration: string | null,
  ) {
    if (matchedAirframe?.linkedAircraft) {
      return {
        id: matchedAirframe.linkedAircraft.id,
        registration: matchedAirframe.linkedAircraft.registration,
        label: matchedAirframe.linkedAircraft.label,
        aircraftTypeId: matchedAirframe.linkedAircraft.aircraftTypeId,
        aircraftType: {
          icaoCode: matchedAirframe.linkedAircraft.aircraftType.icaoCode,
          name: matchedAirframe.linkedAircraft.aircraftType.name,
        },
      };
    }

    const registrationCandidates = [
      detectedRegistration,
      latestOfpRegistration,
      matchedAirframe?.registration ?? null,
    ]
      .map((value) => value?.trim().toUpperCase() ?? null)
      .filter((value, index, array): value is string =>
        Boolean(value) && array.indexOf(value) === index,
      );

    if (registrationCandidates.length === 0) {
      return null;
    }

    const effectiveIcao =
      detectedAircraftIcao?.trim().toUpperCase() ??
      matchedAirframe?.aircraftIcao ??
      matchedAirframe?.linkedAircraftType?.icaoCode ??
      null;

    return this.prisma.aircraft.findFirst({
      where: {
        registration: {
          in: registrationCandidates,
        },
        status: AircraftStatus.ACTIVE,
        ...(effectiveIcao
          ? {
              aircraftType: {
                icaoCode: effectiveIcao,
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        registration: true,
        label: true,
        aircraftTypeId: true,
        aircraftType: {
          select: {
            icaoCode: true,
            name: true,
          },
        },
      },
    });
  }

  private async upsertSimbriefRouteFromLatestOfp(
    latestOfp: SimbriefLatestOfpResult,
    departureAirportId: string,
    arrivalAirportId: string,
    departureIcao: string,
    arrivalIcao: string,
    normalizedFlightNumber: string,
    fallbackAircraftTypeId: string | null,
  ) {
    if (latestOfp.status !== "AVAILABLE" || !latestOfp.plan) {
      return null;
    }

    const mappedTypeCode = this.simbriefClient.inferAircraftTypeCode(
      latestOfp.plan.aircraft?.icaoCode,
    );
    const [aircraftType, departureHub, arrivalHub] = await Promise.all([
      mappedTypeCode
        ? this.prisma.aircraftType.findUnique({
            where: { icaoCode: mappedTypeCode },
            select: { id: true },
          })
        : Promise.resolve(null),
      this.prisma.hub.findFirst({
        where: { airportId: departureAirportId, isActive: true },
        select: { id: true },
      }),
      this.prisma.hub.findFirst({
        where: { airportId: arrivalAirportId, isActive: true },
        select: { id: true },
      }),
    ]);

    const existingRoute = await this.prisma.route.findFirst({
      where: {
        flightNumber: normalizedFlightNumber,
        departureAirportId,
        arrivalAirportId,
      },
      include: importedRouteInclude,
    });

    const routeData = {
      flightNumber: normalizedFlightNumber,
      departureAirportId,
      arrivalAirportId,
      departureHubId: departureHub?.id ?? null,
      arrivalHubId: arrivalHub?.id ?? null,
      aircraftTypeId: aircraftType?.id ?? fallbackAircraftTypeId ?? null,
      distanceNm: latestOfp.plan.distanceNm ?? null,
      blockTimeMinutes: latestOfp.plan.blockTimeMinutes ?? null,
      isActive: true,
      notes: this.buildImportedRouteNotes(latestOfp.plan.route ?? null),
    } satisfies Omit<Prisma.RouteUncheckedCreateInput, "code">;

    const route = existingRoute
      ? await this.prisma.route.update({
          where: { id: existingRoute.id },
          data: routeData,
          include: importedRouteInclude,
        })
      : await this.prisma.route.create({
          data: {
            code: await this.generateImportedRouteCode(
              normalizedFlightNumber,
              departureIcao,
              arrivalIcao,
            ),
            ...routeData,
          },
          include: importedRouteInclude,
        });

    await this.storeRouteOverlayFromPlan(route.id, latestOfp.plan);

    return route;
  }

  private buildPreparedSimbriefBookingNotes(
    flightNumber: string,
    departureIcao: string,
    arrivalIcao: string,
    route: string | null,
    registration: string,
  ) {
    const normalizedRoute = route?.trim();
    const routeSuffix =
      normalizedRoute && normalizedRoute.length > 0
        ? ` Route: ${normalizedRoute}`
        : "";

    return `AUTO_SIMBRIEF_OFP ${flightNumber} ${departureIcao}-${arrivalIcao} ${registration}.${routeSuffix}`;
  }

  private attachLatestOfpAirframeMatch(
    latestOfp: SimbriefLatestOfpResult,
    airframe: SimbriefAirframeRecord | null,
  ) {
    if (
      latestOfp.status !== "AVAILABLE" ||
      !latestOfp.plan ||
      !latestOfp.plan.aircraft
    ) {
      return latestOfp;
    }

    return {
      ...latestOfp,
      plan: {
        ...latestOfp.plan,
        aircraft: {
          ...latestOfp.plan.aircraft,
          matchedAirframe: airframe
            ? this.serializePersistedSimbriefAirframe(airframe)
            : null,
        },
      },
    };
  }

  private serializeSimbriefAirframeLive(
    liveAirframe: SimbriefAirframeSummary,
    persistedAirframe: SimbriefAirframeRecord | null,
  ) {
    const metadata = persistedAirframe
      ? readSimbriefAirframeMetadata(persistedAirframe.rawJson)
      : {
          source: "SIMBRIEF" as const,
          externalAirframeId: liveAirframe.simbriefAirframeId,
          notes: null,
        };

    return {
      id: persistedAirframe?.id ?? null,
      simbriefAirframeId: liveAirframe.simbriefAirframeId,
      externalAirframeId:
        metadata.externalAirframeId ?? liveAirframe.simbriefAirframeId,
      source: metadata.source,
      name: liveAirframe.name,
      aircraftIcao: liveAirframe.aircraftIcao,
      registration: liveAirframe.registration,
      selcal: liveAirframe.selcal,
      equipment: liveAirframe.equipment,
      engineType: liveAirframe.engineType,
      wakeCategory: liveAirframe.wakeCategory,
      notes: metadata.notes,
      rawJson: liveAirframe.rawJson,
      linkedAircraftType: persistedAirframe?.linkedAircraftType
        ? {
            id: persistedAirframe.linkedAircraftType.id,
            icaoCode: persistedAirframe.linkedAircraftType.icaoCode,
            name: persistedAirframe.linkedAircraftType.name,
            manufacturer: persistedAirframe.linkedAircraftType.manufacturer,
          }
        : null,
      linkedAircraft: persistedAirframe?.linkedAircraft
        ? {
            id: persistedAirframe.linkedAircraft.id,
            registration: persistedAirframe.linkedAircraft.registration,
            label: persistedAirframe.linkedAircraft.label,
            status: persistedAirframe.linkedAircraft.status,
            aircraftType: {
              id: persistedAirframe.linkedAircraft.aircraftType.id,
              icaoCode: persistedAirframe.linkedAircraft.aircraftType.icaoCode,
              name: persistedAirframe.linkedAircraft.aircraftType.name,
            },
            hub: persistedAirframe.linkedAircraft.hub
              ? {
                  id: persistedAirframe.linkedAircraft.hub.id,
                  code: persistedAirframe.linkedAircraft.hub.code,
                  name: persistedAirframe.linkedAircraft.hub.name,
                }
              : null,
          }
        : null,
      syncedAt: persistedAirframe?.updatedAt ?? null,
    };
  }

  private serializePersistedSimbriefAirframe(airframe: SimbriefAirframeRecord) {
    return this.serializeSimbriefAirframeLive(
      {
        simbriefAirframeId: airframe.simbriefAirframeId,
        name: airframe.name,
        aircraftIcao: airframe.aircraftIcao,
        registration: airframe.registration,
        selcal: airframe.selcal,
        equipment: airframe.equipment,
        engineType: airframe.engineType,
        wakeCategory: airframe.wakeCategory,
        rawJson: airframe.rawJson,
      },
      airframe,
    );
  }

  private async generateImportedRouteCode(
    flightNumber: string,
    departureIcao: string,
    arrivalIcao: string,
  ): Promise<string> {
    const normalizedFlightNumber = flightNumber.replace(/[^A-Z0-9]/g, "");
    const baseCode =
      normalizedFlightNumber.length > 0
        ? normalizedFlightNumber.slice(0, 12)
        : `${departureIcao}${arrivalIcao}`.slice(0, 12);

    let candidateCode = baseCode;
    let suffix = 1;

    for (;;) {
      const existingRoute = await this.prisma.route.findUnique({
        where: {
          code: candidateCode,
        },
        select: {
          id: true,
        },
      });

      if (!existingRoute) {
        return candidateCode;
      }

      candidateCode = `${baseCode.slice(0, 12)}-${String(suffix)}`.slice(0, 16);
      suffix += 1;
    }
  }

  private buildImportedRouteNotes(route: string | null): string | null {
    const normalizedRoute = route?.trim();

    if (!normalizedRoute) {
      return "Importée depuis le dernier OFP SimBrief.";
    }

    return `Importée depuis le dernier OFP SimBrief. Route : ${normalizedRoute}`;
  }

  private serializeImportedRoute(route: ImportedRouteRecord) {
    return {
      id: route.id,
      code: route.code,
      flightNumber: route.flightNumber,
      distanceNm: route.distanceNm,
      blockTimeMinutes: route.blockTimeMinutes,
      isActive: route.isActive,
      notes: route.notes,
      departureAirport: {
        id: route.departureAirport.id,
        icao: route.departureAirport.icao,
        iata: route.departureAirport.iata,
        name: route.departureAirport.name,
        city: route.departureAirport.city,
        countryCode: route.departureAirport.countryCode,
      },
      arrivalAirport: {
        id: route.arrivalAirport.id,
        icao: route.arrivalAirport.icao,
        iata: route.arrivalAirport.iata,
        name: route.arrivalAirport.name,
        city: route.arrivalAirport.city,
        countryCode: route.arrivalAirport.countryCode,
      },
      departureHub: route.departureHub
        ? {
            id: route.departureHub.id,
            code: route.departureHub.code,
            name: route.departureHub.name,
          }
        : null,
      arrivalHub: route.arrivalHub
        ? {
            id: route.arrivalHub.id,
            code: route.arrivalHub.code,
            name: route.arrivalHub.name,
          }
        : null,
      aircraftType: route.aircraftType
        ? {
            id: route.aircraftType.id,
            icaoCode: route.aircraftType.icaoCode,
            name: route.aircraftType.name,
            manufacturer: route.aircraftType.manufacturer,
            category: route.aircraftType.category,
            minRank: route.aircraftType.minRank
              ? {
                  id: route.aircraftType.minRank.id,
                  code: route.aircraftType.minRank.code,
                  name: route.aircraftType.minRank.name,
                  sortOrder: route.aircraftType.minRank.sortOrder,
                }
              : null,
          }
        : null,
    };
  }

  private serializeProfile(profile: PilotProfileRecord) {
    return {
      id: profile.id,
      pilotNumber: profile.pilotNumber,
      callsign: profile.callsign,
      firstName: profile.firstName,
      lastName: profile.lastName,
      countryCode: profile.countryCode,
      simbriefPilotId: profile.simbriefPilotId,
      status: profile.status,
      experiencePoints: profile.experiencePoints,
      hoursFlownMinutes: profile.hoursFlownMinutes,
      joinedAt: profile.joinedAt,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      simbrief: profile.simbriefPilotId
        ? buildSimbriefFlightPlanLookup(profile.simbriefPilotId!)
        : null,
      user: {
        id: profile.user.id,
        email: profile.user.email,
        username: profile.user.username,
        avatarUrl: getAvatarUrl(profile.user),
        status: profile.user.status,
      },
      hub: profile.hub
        ? {
            id: profile.hub.id,
            code: profile.hub.code,
            name: profile.hub.name,
          }
        : null,
      rank: profile.rank
        ? {
            id: profile.rank.id,
            code: profile.rank.code,
            name: profile.rank.name,
            sortOrder: profile.rank.sortOrder,
          }
        : null,
    };
  }
}

