import { Transform } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateFlightDto {
  @ApiProperty({
    description: "Booking identifier used to create the canonical flight.",
  })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  public bookingId!: string;

  @ApiProperty({
    description:
      "Optional aircraft identifier to align the flight with a linked SimBrief airframe.",
    required: false,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  public aircraftId?: string;
}
