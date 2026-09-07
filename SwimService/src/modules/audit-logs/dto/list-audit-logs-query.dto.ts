import { IsOptional, IsString } from 'class-validator';

export class ListAuditLogsQueryDto {
  @IsOptional()
  @IsString()
  adminId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  targetType?: string;
}
