import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  name!: string;

  @IsOptional()
  @IsString()
  status?: 'enabled' | 'disabled';

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
