import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { CitiesService } from './cities.service';

@Controller()
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Get('app/cities')
  listForApp() {
    return this.citiesService.listForApp();
  }

  @Get('admin/cities')
  @UseGuards(AdminJwtGuard)
  listForAdmin() {
    return this.citiesService.listForAdmin();
  }

  @Post('admin/cities')
  @UseGuards(AdminJwtGuard)
  create(@Body() dto: CreateCityDto) {
    return this.citiesService.create(dto);
  }

  @Patch('admin/cities/:id')
  @UseGuards(AdminJwtGuard)
  update(@Param('id') id: string, @Body() dto: UpdateCityDto) {
    return this.citiesService.update(id, dto);
  }
}
