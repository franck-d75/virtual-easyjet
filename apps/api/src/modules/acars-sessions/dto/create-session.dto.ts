import { Transform } from "class-transformer";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateSessionDto {
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  public flightId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  public clientVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  public simulatorProvider?: string;
}
