import { IsOptional, IsString, Length, Matches } from "class-validator";

export class UpdateMyPilotProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 32)
  @Matches(/^\d+$/, {
    message: "simbriefPilotId must contain digits only.",
  })
  public simbriefPilotId?: string | null;
}
