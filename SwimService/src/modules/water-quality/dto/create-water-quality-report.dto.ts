import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateWaterQualityReportDto {
  @IsIn(['excellent', 'good', 'attention'])
  grade!: 'excellent' | 'good' | 'attention';

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note!: string;

  @IsString()
  updatedAt!: string;

  @IsNumber()
  turbidity!: number;

  @IsNumber()
  waterTemperature!: number;

  @IsNumber()
  phValue!: number;

  @IsNumber()
  freeChlorine!: number;

  @IsNumber()
  combinedChlorine!: number;

  @IsInt()
  orp!: number;

  @IsString()
  bacterialCount!: string;

  @IsString()
  totalColiforms!: string;

  @IsNumber()
  urea!: number;

  @IsNumber()
  cyanuricAcid!: number;

  @IsInt()
  tds!: number;
}
