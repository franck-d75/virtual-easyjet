import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from "class-validator";

export class IngestTelemetryDto {
  @IsOptional()
  @IsISO8601({
    strict: true,
    strictSeparator: true,
  })
  public capturedAt?: string;

  @Type(() => Number)
  @IsLatitude()
  public latitude!: number;

  @Type(() => Number)
  @IsLongitude()
  public longitude!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  public altitudeFt!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  public groundspeedKts!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(360)
  public headingDeg!: number;

  @Type(() => Number)
  @IsInt()
  public verticalSpeedFpm!: number;

  @Transform(({ value }) =>
    typeof value === "boolean" ? value : value === "true",
  )
  @IsBoolean()
  public onGround!: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  public fuelTotalKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  public gearPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  public flapsPercent?: number;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "boolean" ? value : value === "true",
  )
  @IsBoolean()
  public parkingBrake?: boolean;
}
