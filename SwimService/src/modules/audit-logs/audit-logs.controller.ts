import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { AuditLogsService } from './audit-logs.service';

@Controller('admin/audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @UseGuards(AdminJwtGuard)
  list(@Query() query: ListAuditLogsQueryDto) {
    return this.auditLogsService.list(query);
  }
}
