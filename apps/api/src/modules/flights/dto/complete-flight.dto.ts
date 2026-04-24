import { IsISO8601, IsInt, IsOptional, Min } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class CompleteFlightDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601({
    strict: true,
    strictSeparator: true,
  })
  public actualOffBlockAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601({
    strict: true,
    strictSeparator: true,
  })
  public actualTakeoffAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601({
    strict: true,
    strictSeparator: true,
  })
  public actualLandingAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601({
    strict: true,
    strictSeparator: true,
  })
  public actualOnBlockAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  public distanceFlownNm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  public durationMinutes?: number;
}
