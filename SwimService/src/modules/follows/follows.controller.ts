import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AppAuthContext } from '../../common/auth/auth-request.types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { AppJwtGuard } from '../../common/guards/app-jwt.guard';
import { AdminListFollowsQueryDto } from './dto/admin-list-follows-query.dto';
import { FollowsService } from './follows.service';

@Controller()
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Get('admin/follows')
  @UseGuards(AdminJwtGuard)
  listForAdmin(@Query() query: AdminListFollowsQueryDto) {
    return this.followsService.listForAdmin(query);
  }

  @Get('app/me/follows')
  @UseGuards(AppJwtGuard)
  listForApp(@CurrentUser() user: AppAuthContext) {
    return this.followsService.listForApp(user.id);
  }

  @Post('app/venues/:venueId/follow')
  @UseGuards(AppJwtGuard)
  follow(
    @Param('venueId') venueId: string,
    @CurrentUser() user: AppAuthContext,
  ) {
    return this.followsService.follow(venueId, user.id);
  }

  @Delete('app/venues/:venueId/follow')
  @UseGuards(AppJwtGuard)
  unfollow(
    @Param('venueId') venueId: string,
    @CurrentUser() user: AppAuthContext,
  ) {
    return this.followsService.unfollow(venueId, user.id);
  }
}
