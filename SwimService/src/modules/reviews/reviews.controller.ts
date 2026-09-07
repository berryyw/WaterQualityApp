import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  AdminAuthContext,
  AppAuthContext,
} from '../../common/auth/auth-request.types';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminJwtGuard } from '../../common/guards/admin-jwt.guard';
import { AppJwtGuard } from '../../common/guards/app-jwt.guard';
import { AdminListReviewsQueryDto } from './dto/admin-list-reviews-query.dto';
import { AppCreateReviewDto } from './dto/app-create-review.dto';
import { UpdateReviewStatusDto } from './dto/update-review-status.dto';
import { ReviewsService } from './reviews.service';

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('admin/reviews')
  @UseGuards(AdminJwtGuard)
  listForAdmin(@Query() query: AdminListReviewsQueryDto) {
    return this.reviewsService.listForAdmin(query);
  }

  @Patch('admin/reviews/:id/status')
  @UseGuards(AdminJwtGuard)
  updateStatus(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminAuthContext,
    @Body() dto: UpdateReviewStatusDto,
  ) {
    return this.reviewsService.updateStatus(id, admin.id, dto);
  }

  @Get('app/venues/:venueId/reviews')
  listForApp(@Param('venueId') venueId: string) {
    return this.reviewsService.listForApp(venueId);
  }

  @Post('app/venues/:venueId/reviews')
  @UseGuards(AppJwtGuard)
  createForApp(
    @Param('venueId') venueId: string,
    @CurrentUser() user: AppAuthContext,
    @Body() dto: AppCreateReviewDto,
  ) {
    return this.reviewsService.createForApp(venueId, user.id, dto);
  }
}
