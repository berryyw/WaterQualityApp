import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { AppListVenuesQueryDto } from './dto/app-list-venues-query.dto';
import { AdminListVenuesQueryDto } from './dto/admin-list-venues-query.dto';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueStatusDto } from './dto/update-venue-status.dto';
import { VenuesService } from './venues.service';

@Controller()
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Get('admin/venues')
  @UseGuards(AdminJwtGuard)
  listForAdmin(@Query() query: AdminListVenuesQueryDto) {
    return this.venuesService.listForAdmin(query);
  }

  @Post('admin/venues')
  @UseGuards(AdminJwtGuard)
  create(@Body() dto: CreateVenueDto) {
    return this.venuesService.create(dto);
  }

  @Patch('admin/venues/:id/status')
  @UseGuards(AdminJwtGuard)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateVenueStatusDto) {
    return this.venuesService.updateStatus(id, dto);
  }

  @Delete('admin/venues/:id')
  @UseGuards(AdminJwtGuard)
  remove(@Param('id') id: string) {
    return this.venuesService.remove(id);
  }

  @Get('app/venues')
  listForApp(@Query() query: AppListVenuesQueryDto) {
    return this.venuesService.listForApp(query);
  }

  @Get('app/venues/:id')
  getAppVenueDetail(@Param('id') id: string) {
    return this.venuesService.getAppVenueDetail(id);
  }
}
