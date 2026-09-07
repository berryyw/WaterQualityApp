import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminListReviewsQueryDto } from './dto/admin-list-reviews-query.dto';
import { AppCreateReviewDto } from './dto/app-create-review.dto';
import { UpdateReviewStatusDto } from './dto/update-review-status.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForAdmin(query: AdminListReviewsQueryDto) {
    const where: Prisma.ReviewWhereInput = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.content
        ? { content: { contains: query.content.trim(), mode: 'insensitive' } }
        : {}),
      ...(query.nickname
        ? {
            user: {
              profile: {
                nickname: {
                  contains: query.nickname.trim(),
                  mode: 'insensitive',
                },
              },
            },
          }
        : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    return this.prisma.review.findMany({
      where,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        venue: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForApp(venueId: string) {
    await this.ensureVenueExists(venueId);

    return this.prisma.review.findMany({
      where: {
        venueId,
        status: 'normal',
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createForApp(venueId: string, userId: string, dto: AppCreateReviewDto) {
    await this.ensureVenueExists(venueId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user || user.status !== 'active') {
      throw new NotFoundException('用户不存在或已被禁用');
    }

    return this.prisma.review.create({
      data: {
        venueId,
        userId,
        content: dto.content.trim(),
        status: 'normal',
      },
      include: {
        user: {
          include: { profile: true },
        },
      },
    });
  }

  async updateStatus(
    reviewId: string,
    adminId: string,
    dto: UpdateReviewStatusDto,
  ) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('评价不存在');
    }

    const updatedReview = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        status: dto.status,
        moderatedByAdminId: adminId,
        moderatedAt: new Date(),
      },
    });

    if (review.status !== dto.status) {
      await this.prisma.reviewStatusLog.create({
        data: {
          reviewId,
          fromStatus: review.status,
          toStatus: dto.status,
          reason: dto.reason?.trim(),
          adminId,
        },
      });
    }

    return updatedReview;
  }

  private async ensureVenueExists(venueId: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true },
    });

    if (!venue) {
      throw new NotFoundException('泳馆不存在');
    }
  }
}
