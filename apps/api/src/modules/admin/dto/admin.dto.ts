import {
  AircraftStatus,
  UserPlatformRole,
  UserStatus,
} from "@va/database";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from "class-validator";

const PLAIN_TEXT_REGEX = /^[^<>]*$/;

export class CreateAdminAircraftDto {
  @IsString()
  @Length(2, 16)
  public registration!: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Matches(PLAIN_TEXT_REGEX, {
    message: "Le libellé ne doit pas contenir de balises HTML.",
  })
  public label?: string;

  @IsString()
  public aircraftTypeId!: string;

  @IsOptional()
  @IsString()
  public hubId?: string | null;

  @IsEnum(AircraftStatus)
  public status!: AircraftStatus;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  @Matches(PLAIN_TEXT_REGEX, {
    message: "Les notes ne doivent pas contenir de balises HTML.",
  })
  public notes?: string;

  @IsOptional()
  @IsString()
  public simbriefAirframeId?: string | null;
}

export class UpdateAdminAircraftDto {
  @IsOptional()
  @IsString()
  @Length(2, 16)
  public registration?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Matches(PLAIN_TEXT_REGEX, {
    message: "Le libellé ne doit pas contenir de balises HTML.",
  })
  public label?: string | null;

  @IsOptional()
  @IsString()
  public aircraftTypeId?: string;

  @IsOptional()
  @IsString()
  public hubId?: string | null;

  @IsOptional()
  @IsEnum(AircraftStatus)
  public status?: AircraftStatus;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  @Matches(PLAIN_TEXT_REGEX, {
    message: "Les notes ne doivent pas contenir de balises HTML.",
  })
  public notes?: string | null;

  @IsOptional()
  @IsString()
  public simbriefAirframeId?: string | null;
}

export class ImportAdminAircraftFromSimbriefAirframeDto {
  @IsString()
  public simbriefAirframeId!: string;

  @IsOptional()
  @IsString()
  public hubId?: string | null;

  @IsOptional()
  @IsEnum(AircraftStatus)
  public status?: AircraftStatus;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  @Matches(PLAIN_TEXT_REGEX, {
    message: "Les notes ne doivent pas contenir de balises HTML.",
  })
  public notes?: string | null;
}

export class LinkAdminAircraftSimbriefAirframeDto {
  @IsString()
  public simbriefAirframeId!: string;
}

export class CreateAdminHubDto {
  @IsString()
  @Length(2, 8)
  public code!: string;

  @IsString()
  @Length(2, 80)
  @Matches(PLAIN_TEXT_REGEX, {
    message: "Le nom du hub ne doit pas contenir de balises HTML.",
  })
  public name!: string;

  @IsString()
  public airportId!: string;

  @IsOptional()
  @IsBoolean()
  public isActive?: boolean;
}

export class UpdateAdminHubDto {
  @IsOptional()
  @IsString()
  @Length(2, 8)
  public code?: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  @Matches(PLAIN_TEXT_REGEX, {
    message: "Le nom du hub ne doit pas contenir de balises HTML.",
  })
  public name?: string;

  @IsOptional()
  @IsString()
  public airportId?: string;

  @IsOptional()
  @IsBoolean()
  public isActive?: boolean;
}

export class CreateAdminRouteDto {
  @IsString()
  @Length(2, 16)
  public code!: string;

  @IsString()
  @Length(2, 16)
  public flightNumber!: string;

  @IsString()
  public departureAirportId!: string;

  @IsString()
  public arrivalAirportId!: string;

  @IsOptional()
  @IsString()
  public departureHubId?: string | null;

  @IsOptional()
  @IsString()
  public arrivalHubId?: string | null;

  @IsOptional()
  @IsString()
  public aircraftTypeId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  public distanceNm?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  public blockTimeMinutes?: number | null;

  @IsOptional()
  @IsBoolean()
  public isActive?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  @Matches(PLAIN_TEXT_REGEX, {
    message: "Les notes ne doivent pas contenir de balises HTML.",
  })
  public notes?: string | null;
}

export class UpdateAdminRouteDto {
  @IsOptional()
  @IsString()
  @Length(2, 16)
  public code?: string;

  @IsOptional()
  @IsString()
  @Length(2, 16)
  public flightNumber?: string;

  @IsOptional()
  @IsString()
  public departureAirportId?: string;

  @IsOptional()
  @IsString()
  public arrivalAirportId?: string;

  @IsOptional()
  @IsString()
  public departureHubId?: string | null;

  @IsOptional()
  @IsString()
  public arrivalHubId?: string | null;

  @IsOptional()
  @IsString()
  public aircraftTypeId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  public distanceNm?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  public blockTimeMinutes?: number | null;

  @IsOptional()
  @IsBoolean()
  public isActive?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  public notes?: string | null;
}

const ADMIN_USER_STATUSES = [
  UserStatus.ACTIVE,
  UserStatus.PENDING,
  UserStatus.SUSPENDED,
] as const;

export class UpdateAdminUserDto {
  @IsOptional()
  @IsEnum(UserPlatformRole)
  public role?: UserPlatformRole;

  @IsOptional()
  @IsIn(ADMIN_USER_STATUSES)
  public status?: UserStatus;

  @IsOptional()
  @IsString()
  @Length(3, 24)
  @Matches(/^[a-z0-9._-]+$/i)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  public username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(PLAIN_TEXT_REGEX, {
    message: "Le prénom ne doit pas contenir de balises HTML.",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  public firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(PLAIN_TEXT_REGEX, {
    message: "Le nom ne doit pas contenir de balises HTML.",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  public lastName?: string;

  @IsOptional()
  @IsString()
  @Length(3, 16, {
    message: "Le numéro pilote doit contenir entre 3 et 16 caractères.",
  })
  @Matches(/^[A-Z0-9-]+$/, {
    message:
      "Le numéro pilote ne peut contenir que des lettres, des chiffres ou des tirets.",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  public pilotNumber?: string;

  @IsOptional()
  @IsString()
  @Length(2, 16, {
    message: "L'indicatif doit contenir entre 2 et 16 caractères.",
  })
  @Matches(/^[A-Z0-9-]+$/, {
    message:
      "L'indicatif ne peut contenir que des lettres, des chiffres ou des tirets.",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  public callsign?: string | null;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  public countryCode?: string | null;
}

export class CleanupAdminAcarsTestDataDto {
  @IsOptional()
  @IsBoolean()
  public dryRun?: boolean;
}
