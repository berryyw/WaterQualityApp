import { IsString } from 'class-validator';

export class AppRefreshTokenDto {
  @IsString()
  refreshToken!: string;
}
