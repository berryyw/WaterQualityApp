import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateCityDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  name?: string;

  @IsOptional()
  @IsString()
  status?: 'enabled' | 'disabled';

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
