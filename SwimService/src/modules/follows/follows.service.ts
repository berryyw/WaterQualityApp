import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminListFollowsQueryDto } from './dto/admin-list-follows-query.dto';

@Injectable()
export class FollowsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForAdmin(query: AdminListFollowsQueryDto) {
    const where: Prisma.FollowEventWhereInput = {
      ...(query.venueId ? { venueId: query.venueId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.type ? { eventType: query.type } : {}),
      ...(query.venueName
        ? {
            venue: {
              name: {
                contains: query.venueName.trim(),
                mode: 'insensitive',
              },
            },
          }
        : {}),
      ...(query.userNickname
        ? {
            user: {
              profile: {
                nickname: {
                  contains: query.userNickname.trim(),
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

    return this.prisma.followEvent.findMany({
      where,
      include: {
        venue: true,
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForApp(userId: string) {
    return this.prisma.follow.findMany({
      where: {
        userId,
        status: 'active',
      },
      include: {
        venue: {
          include: {
            city: true,
            images: {
              where: { type: 'cover' },
              take: 1,
            },
            waterQuality: {
              where: { isCurrent: true },
              take: 1,
              orderBy: { updatedAt: 'desc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async follow(venueId: string, userId: string) {
    const [venue, user] = await Promise.all([
      this.prisma.venue.findUnique({ where: { id: venueId } }),
      this.prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!venue) {
      throw new NotFoundException('泳馆不存在');
    }

    if (!user || user.status !== 'active') {
      throw new NotFoundException('用户不存在或已被禁用');
    }

    const existingFollow = await this.prisma.follow.findUnique({
      where: {
        venueId_userId: {
          venueId,
          userId,
        },
      },
    });

    const result = existingFollow
      ? await this.prisma.follow.update({
          where: {
            venueId_userId: {
              venueId,
              userId,
            },
          },
          data: {
            status: 'active',
            canceledAt: null,
          },
        })
      : await this.prisma.follow.create({
          data: {
            venueId,
            userId,
            status: 'active',
          },
        });

    await this.prisma.followEvent.create({
      data: {
        venueId,
        userId,
        eventType: 'follow',
      },
    });

    await this.recalculateFollowersCount(venueId);

    return result;
  }

  async unfollow(venueId: string, userId: string) {
    const follow = await this.prisma.follow.findUnique({
      where: {
        venueId_userId: {
          venueId,
          userId,
        },
      },
    });

    if (!follow) {
      throw new NotFoundException('关注关系不存在');
    }

    const result = await this.prisma.follow.update({
      where: {
        venueId_userId: {
          venueId,
          userId,
        },
      },
      data: {
        status: 'canceled',
        canceledAt: new Date(),
      },
    });

    await this.prisma.followEvent.create({
      data: {
        venueId,
        userId,
        eventType: 'unfollow',
      },
    });

    await this.recalculateFollowersCount(venueId);

    return result;
  }

  private async recalculateFollowersCount(venueId: string) {
    const activeCount = await this.prisma.follow.count({
      where: {
        venueId,
        status: 'active',
      },
    });

    await this.prisma.venue.update({
      where: { id: venueId },
      data: {
        followersCount: activeCount,
      },
    });
  }
}
