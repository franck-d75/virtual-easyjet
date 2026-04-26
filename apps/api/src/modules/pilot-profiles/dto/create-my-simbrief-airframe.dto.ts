import { Transform } from "class-transformer";
import {
  IsOptional,
  IsString,
  Length,
  Matches,
} from "class-validator";

const PLAIN_TEXT_REGEX = /^[^<>]*$/;

export class CreateMySimbriefAirframeDto {
  @IsString()
  @Length(2, 80, {
    message: "Le nom de l'airframe doit contenir entre 2 et 80 caracteres.",
  })
  @Matches(PLAIN_TEXT_REGEX, {
    message: "Le nom de l'airframe ne doit pas contenir de balises HTML.",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  public name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 64, {
    message:
      "L'identifiant SimBrief Airframe doit contenir entre 1 et 64 caracteres.",
  })
  @Matches(/^[a-z0-9._:-]+$/i, {
    message:
      "L'identifiant SimBrief Airframe ne peut contenir que des lettres, chiffres, points, deux-points, underscores ou tirets.",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || null : value,
  )
  public simbriefAirframeId?: string | null;

  @IsString()
  @Length(2, 16, {
    message: "L'immatriculation doit contenir entre 2 et 16 caracteres.",
  })
  @Matches(/^[A-Z0-9-]+$/, {
    message:
      "L'immatriculation ne peut contenir que des lettres, des chiffres ou des tirets.",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  public registration!: string;

  @IsString()
  @Length(3, 8, {
    message: "Le type ICAO doit contenir entre 3 et 8 caracteres.",
  })
  @Matches(/^[A-Z0-9]+$/, {
    message:
      "Le type ICAO ne peut contenir que des lettres et des chiffres.",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  public aircraftIcao!: string;

  @IsOptional()
  @IsString()
  @Length(2, 80, {
    message: "Le type moteur doit contenir entre 2 et 80 caracteres.",
  })
  @Matches(PLAIN_TEXT_REGEX, {
    message: "Le type moteur ne doit pas contenir de balises HTML.",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || null : value,
  )
  public engineType?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 500, {
    message: "Les notes doivent contenir entre 1 et 500 caracteres.",
  })
  @Matches(PLAIN_TEXT_REGEX, {
    message: "Les notes ne doivent pas contenir de balises HTML.",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || null : value,
  )
  public notes?: string | null;
}
