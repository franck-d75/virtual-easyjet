import { Transform } from "class-transformer";
import { IsOptional, IsString, Length, Matches } from "class-validator";

export class UpdateMyPilotProfileDto {
  @IsOptional()
  @IsString()
  @Length(3, 16, {
    message: "pilotNumber must contain between 3 and 16 characters.",
  })
  @Matches(/^[A-Z0-9-]+$/, {
    message:
      "pilotNumber may only contain letters, digits, and dashes.",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  public pilotNumber?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 32)
  @Matches(/^\d+$/, {
    message: "simbriefPilotId must contain digits only.",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  public simbriefPilotId?: string | null;
}

