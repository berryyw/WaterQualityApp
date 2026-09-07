import { IsIn, IsOptional, IsString } from 'class-validator';

export class AdminListVenuesQueryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsIn(['normal', 'disabled'])
  status?: 'normal' | 'disabled';

  @IsOptional()
  @IsString()
  waterQualityStart?: string;

  @IsOptional()
  @IsString()
  waterQualityEnd?: string;
}
