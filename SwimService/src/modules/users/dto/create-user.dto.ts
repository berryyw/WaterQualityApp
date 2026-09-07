import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(20)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  nickname!: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
