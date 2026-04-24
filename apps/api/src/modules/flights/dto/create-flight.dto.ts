import { Transform } from "class-transformer";
import { IsNotEmpty, IsString } from "class-validator";
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
}
