import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateReviewStatusDto {
  @IsIn(['normal', 'disabled', 'deleted'])
  status!: 'normal' | 'disabled' | 'deleted';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
