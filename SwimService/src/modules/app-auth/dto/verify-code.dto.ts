import { IsEmail, IsIn, IsNotEmpty, Length } from 'class-validator';

export class VerifyCodeDto {
  @IsEmail()
  email!: string;

  @IsIn(['register', 'change_password', 'change_email'])
  purpose!: 'register' | 'change_password' | 'change_email';

  @IsNotEmpty()
  @Length(6, 6)
  code!: string;
}
