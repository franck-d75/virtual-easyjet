import { Transform } from "class-transformer";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  public email!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Length(3, 24)
  @Matches(/^[a-z0-9._-]+$/i)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  public username!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Length(8, 72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      "password must contain at least one uppercase letter, one lowercase letter and one digit",
  })
  public password!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  @Matches(/^[^<>]*$/, {
    message: "firstName must not contain HTML tags",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  public firstName!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  @Matches(/^[^<>]*$/, {
    message: "lastName must not contain HTML tags",
  })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value,
  )
  public lastName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  public countryCode?: string;
}

