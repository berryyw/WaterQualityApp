import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAdminAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  account!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
