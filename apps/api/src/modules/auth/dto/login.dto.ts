import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, Length } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({
    description: "Pilot email address or username.",
  })
  @IsNotEmpty()
  @IsString()
  @Length(3, 120)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  public identifier!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Length(8, 72)
  public password!: string;
}

