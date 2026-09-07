import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAppProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickname?: string;
}
