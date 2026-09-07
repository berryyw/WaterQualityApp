import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ChangeAppEmailDto {
  @IsEmail()
  newEmail!: string;

  @IsString()
  @IsNotEmpty()
  verificationToken!: string;
}
