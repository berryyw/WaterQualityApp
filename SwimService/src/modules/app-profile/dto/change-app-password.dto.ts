import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangeAppPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  newPassword!: string;

  @IsString()
  @IsNotEmpty()
  verificationToken!: string;
}
