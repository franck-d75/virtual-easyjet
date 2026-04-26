import { Transform } from "class-transformer";
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from "class-validator";

const PLAIN_TEXT_REGEX = /^[^<>]*$/;

export class UpdateMyPilotProfileDto {
  @IsOptional()
  @IsString()
  @Length(3, 24, {
    message:
      "Le nom d'utilisateur doit contenir entre 3 et 24 caractères.",
  })
  @Matches(/^[a-z0-9._-]+$/i, {
    message:
      "Le nom d'utilisateur ne peut contenir que des lettres, chiffres, points, tirets ou underscores.",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  public username?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80, {
    message: "Le prénom doit contenir entre 1 et 80 caractères.",
  })
  @Matches(PLAIN_TEXT_REGEX, {
    message: "Le prénom ne doit pas contenir de balises HTML.",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  public firstName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80, {
    message: "Le nom doit contenir entre 1 et 80 caractères.",
  })
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
  public pilotNumber?: string | null;

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
    typeof value === "string" ? value.trim().toUpperCase() || null : value,
  )
  public callsign?: string | null;

  @IsOptional()
  @IsString()
  @Length(2, 2, {
    message: "Le pays doit être renseigné avec un code ISO à 2 lettres.",
  })
  @Matches(/^[A-Z]{2}$/, {
    message: "Le pays doit être renseigné avec un code ISO à 2 lettres.",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() || null : value,
  )
  public countryCode?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  @Matches(/^\d+$/, {
    message: "Le SimBrief Pilot ID doit contenir uniquement des chiffres.",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || null : value,
  )
  public simbriefPilotId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64, {
    message: "Le hub préféré sélectionné est invalide.",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || null : value,
  )
  public preferredHubId?: string | null;
}

