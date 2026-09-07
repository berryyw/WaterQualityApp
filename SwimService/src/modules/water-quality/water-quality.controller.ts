import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AdminAuthContext } from '../../common/auth/auth-request.types';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { CreateWaterQualityReportDto } from './dto/create-water-quality-report.dto';
import { WaterQualityService } from './water-quality.service';

@Controller()
export class WaterQualityController {
  constructor(private readonly waterQualityService: WaterQualityService) {}

  @Get('admin/venues/:venueId/water-quality')
  @UseGuards(AdminJwtGuard)
  listForAdmin(@Param('venueId') venueId: string) {
    return this.waterQualityService.listForAdmin(venueId);
  }

  @Post('admin/venues/:venueId/water-quality')
  @UseGuards(AdminJwtGuard)
  create(
    @Param('venueId') venueId: string,
    @CurrentAdmin() admin: AdminAuthContext,
    @Body() dto: CreateWaterQualityReportDto,
  ) {
    return this.waterQualityService.create(venueId, admin.id, dto);
  }

  @Get('app/venues/:venueId/water-quality')
  getCurrentForApp(@Param('venueId') venueId: string) {
    return this.waterQualityService.getCurrentForApp(venueId);
  }
}
