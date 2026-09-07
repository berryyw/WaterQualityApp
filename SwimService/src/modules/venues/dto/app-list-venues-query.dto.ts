import { IsOptional, IsString } from 'class-validator';

export class AppListVenuesQueryDto {
  @IsOptional()
  @IsString()
  cityCode?: string;

  @IsOptional()
  @IsString()
  keyword?: string;
}
