import { Transform } from "class-transformer";
import { IsOptional, IsString, IsUrl, Length, Matches, MaxLength } from "class-validator";

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

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl(
    {
      protocols: ["https"],
      require_protocol: true,
      require_tld: true,
    },
    {
      message: "avatarUrl must be a valid https URL.",
    },
  )
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  public avatarUrl?: string | null;
}

