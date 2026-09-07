import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { AdminAuthContext } from '../../common/auth/auth-request.types';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminRefreshTokenDto } from './dto/admin-refresh-token.dto';
import { AdminAuthService } from './admin-auth.service';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.login(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: AdminRefreshTokenDto) {
    return this.adminAuthService.refresh(dto);
  }

  @Post('logout')
  @UseGuards(AdminJwtGuard)
  logout(@CurrentAdmin() admin: AdminAuthContext) {
    return this.adminAuthService.logout(admin);
  }
}
