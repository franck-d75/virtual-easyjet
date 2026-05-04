import { Transform } from "class-transformer";
import { IsISO8601, IsOptional, IsString, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateBookingDto {
  @ApiProperty({
    description: "Active schedule identifier used to derive route and aircraft.",
    required: false,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  public scheduleId?: string;

  @ApiPropertyOptional({
    description:
      "Route identifier used for direct route booking when no schedule exists.",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  public routeId?: string;

  @ApiProperty({
    description: "Requested UTC datetime for the booked flight.",
    required: false,
  })
  @IsOptional()
  @IsISO8601({
    strict: true,
    strictSeparator: true,
  })
  public bookedFor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  public notes?: string;
}
