import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, Length } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RefreshTokenDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Length(20, 4096)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  public refreshToken!: string;
}

