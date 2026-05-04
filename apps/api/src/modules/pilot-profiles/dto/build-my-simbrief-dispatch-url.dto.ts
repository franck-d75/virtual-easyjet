import { Transform } from "class-transformer";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class BuildMySimbriefDispatchUrlDto {
  @ApiProperty({
    description: "Reservation identifier used to prefill SimBrief dispatch.",
  })
  @IsString()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  public bookingId!: string;

  @ApiPropertyOptional({
    description:
      "Absolute page URL where SimBrief should return after API dispatch.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  public returnUrl?: string;
}
