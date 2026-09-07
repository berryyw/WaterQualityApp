import { IsIn, IsOptional, IsString } from 'class-validator';

export class AdminListFollowsQueryDto {
  @IsOptional()
  @IsString()
  venueId?: string;

  @IsOptional()
  @IsString()
  venueName?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  userNickname?: string;

  @IsOptional()
  @IsIn(['follow', 'unfollow'])
  type?: 'follow' | 'unfollow';

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
