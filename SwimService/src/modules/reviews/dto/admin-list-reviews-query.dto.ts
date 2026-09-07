import { IsIn, IsOptional, IsString } from 'class-validator';

export class AdminListReviewsQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsIn(['normal', 'disabled', 'deleted'])
  status?: 'normal' | 'disabled' | 'deleted';

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
