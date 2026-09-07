import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AppCreateReviewDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  content!: string;
}
