import { Transform } from "class-transformer";
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

const REGISTRATION_PATTERN =
  /^([A-Z]{1,2}-[A-Z0-9]{2,5}|N\d{1,5}[A-Z]{0,2}|C-[FGI][A-Z]{3}|JA\d{3,4}[A-Z]?)$/u;

export class PrepareMySimbriefFlightDto {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  @Matches(REGISTRATION_PATTERN, {
    message:
      "La registration detectee doit ressembler a une immatriculation valide.",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  public detectedRegistration?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  public detectedAircraftIcao?: string | null;
}
