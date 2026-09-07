import { IsEmail, IsIn } from 'class-validator';

export class SendCodeDto {
  @IsEmail()
  email!: string;

  @IsIn(['register', 'change_password', 'change_email'])
  purpose!: 'register' | 'change_password' | 'change_email';
}
