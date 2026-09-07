import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { CreateAdminAccountDto } from './dto/create-admin-account.dto';
import { AdminAccountsService } from './admin-accounts.service';

@Controller('admin/accounts')
@UseGuards(AdminJwtGuard)
export class AdminAccountsController {
  constructor(private readonly adminAccountsService: AdminAccountsService) {}

  @Get()
  list() {
    return this.adminAccountsService.list();
  }

  @Post()
  create(@Body() dto: CreateAdminAccountDto) {
    return this.adminAccountsService.create(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.adminAccountsService.remove(id);
  }
}
