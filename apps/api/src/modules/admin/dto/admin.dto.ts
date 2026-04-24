import {
  AircraftStatus,
} from "@va/database";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";

export class CreateAdminAircraftDto {
  @IsString()
  @Length(2, 16)
  public registration!: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  public label?: string;

  @IsString()
  public aircraftTypeId!: string;

  @IsOptional()
  @IsString()
  public hubId?: string | null;

  @IsEnum(AircraftStatus)
  public status!: AircraftStatus;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  public notes?: string;
}

export class UpdateAdminAircraftDto {
  @IsOptional()
  @IsString()
  @Length(2, 16)
  public registration?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  public label?: string | null;

  @IsOptional()
  @IsString()
  public aircraftTypeId?: string;

  @IsOptional()
  @IsString()
  public hubId?: string | null;

  @IsOptional()
  @IsEnum(AircraftStatus)
  public status?: AircraftStatus;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  public notes?: string | null;
}

export class CreateAdminHubDto {
  @IsString()
  @Length(2, 8)
  public code!: string;

  @IsString()
  @Length(2, 80)
  public name!: string;

  @IsString()
  public airportId!: string;

  @IsOptional()
  @IsBoolean()
  public isActive?: boolean;
}

export class UpdateAdminHubDto {
  @IsOptional()
  @IsString()
  @Length(2, 8)
  public code?: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  public name?: string;

  @IsOptional()
  @IsString()
  public airportId?: string;

  @IsOptional()
  @IsBoolean()
  public isActive?: boolean;
}

export class CreateAdminRouteDto {
  @IsString()
  @Length(2, 16)
  public code!: string;

  @IsString()
  @Length(2, 16)
  public flightNumber!: string;

  @IsString()
  public departureAirportId!: string;

  @IsString()
  public arrivalAirportId!: string;

  @IsOptional()
  @IsString()
  public departureHubId?: string | null;

  @IsOptional()
  @IsString()
  public arrivalHubId?: string | null;

  @IsOptional()
  @IsString()
  public aircraftTypeId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  public distanceNm?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  public blockTimeMinutes?: number | null;

  @IsOptional()
  @IsBoolean()
  public isActive?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  public notes?: string | null;
}

export class UpdateAdminRouteDto {
  @IsOptional()
  @IsString()
  @Length(2, 16)
  public code?: string;

  @IsOptional()
  @IsString()
  @Length(2, 16)
  public flightNumber?: string;

  @IsOptional()
  @IsString()
  public departureAirportId?: string;

  @IsOptional()
  @IsString()
  public arrivalAirportId?: string;

  @IsOptional()
  @IsString()
  public departureHubId?: string | null;

  @IsOptional()
  @IsString()
  public arrivalHubId?: string | null;

  @IsOptional()
  @IsString()
  public aircraftTypeId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  public distanceNm?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  public blockTimeMinutes?: number | null;

  @IsOptional()
  @IsBoolean()
  public isActive?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  public notes?: string | null;
}
