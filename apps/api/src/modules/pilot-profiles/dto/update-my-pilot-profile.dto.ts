import { Transform } from "class-transformer";
import { IsOptional, IsString, Length, Matches } from "class-validator";

export class UpdateMyPilotProfileDto {
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

