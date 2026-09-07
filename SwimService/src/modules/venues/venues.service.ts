import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppListVenuesQueryDto } from './dto/app-list-venues-query.dto';
import { AdminListVenuesQueryDto } from './dto/admin-list-venues-query.dto';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueStatusDto } from './dto/update-venue-status.dto';

@Injectable()
export class VenuesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForAdmin(query: AdminListVenuesQueryDto) {
    const where: Prisma.VenueWhereInput = {
      ...(query.name
        ? { name: { contains: query.name.trim(), mode: 'insensitive' } }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.location
        ? {
            OR: [
              {
                address: {
                  contains: query.location.trim(),
                  mode: 'insensitive',
                },
              },
              {
                district: {
                  contains: query.location.trim(),
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    return this.prisma.venue.findMany({
      where,
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
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForApp(query: AppListVenuesQueryDto) {
    const where: Prisma.VenueWhereInput = {
      status: 'normal',
      ...(query.cityCode
        ? { city: { code: query.cityCode.trim().toLowerCase() } }
        : {}),
      ...(query.keyword
        ? {
            OR: [
              { name: { contains: query.keyword.trim(), mode: 'insensitive' } },
              {
                address: {
                  contains: query.keyword.trim(),
                  mode: 'insensitive',
                },
              },
              {
                district: {
                  contains: query.keyword.trim(),
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    return this.prisma.venue.findMany({
      where,
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
      orderBy: [{ followersCount: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getAppVenueDetail(id: string) {
    const venue = await this.prisma.venue.findFirst({
      where: {
        id,
        status: 'normal',
      },
      include: {
        city: true,
        images: true,
        waterQuality: {
          where: { isCurrent: true },
          take: 1,
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    if (!venue) {
      throw new NotFoundException('泳馆不存在');
    }

    return venue;
  }

  async create(dto: CreateVenueDto) {
    const city = await this.prisma.city.findUnique({
      where: { id: dto.cityId },
    });
    if (!city) {
      throw new NotFoundException('所属城市不存在');
    }

    const existedVenue = await this.prisma.venue.findFirst({
      where: {
        cityId: dto.cityId,
        name: dto.name.trim(),
        address: dto.address.trim(),
      },
    });

    if (existedVenue) {
      throw new ConflictException('相同名称和地址的泳馆已存在');
    }

    return this.prisma.venue.create({
      data: {
        cityId: dto.cityId,
        name: dto.name.trim(),
        district: dto.district.trim(),
        address: dto.address.trim(),
        latitude: new Prisma.Decimal(dto.latitude),
        longitude: new Prisma.Decimal(dto.longitude),
        summary: dto.summary?.trim(),
        imageCaption: dto.imageCaption?.trim(),
        status: dto.status ?? 'normal',
      },
      include: {
        city: true,
      },
    });
  }

  async updateStatus(id: string, dto: UpdateVenueStatusDto) {
    const venue = await this.prisma.venue.findUnique({ where: { id } });
    if (!venue) {
      throw new NotFoundException('泳馆不存在');
    }

    return this.prisma.venue.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  async remove(id: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!venue) {
      throw new NotFoundException('泳馆不存在');
    }

    await this.prisma.venue.delete({
      where: { id },
    });

    return { success: true };
  }
}
