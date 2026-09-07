import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AdminLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  account!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
