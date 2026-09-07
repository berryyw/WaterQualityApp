import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWaterQualityReportDto } from './dto/create-water-quality-report.dto';

@Injectable()
export class WaterQualityService {
  constructor(private readonly prisma: PrismaService) {}

  async listForAdmin(venueId: string) {
    await this.ensureVenueExists(venueId);

    return this.prisma.waterQualityReport.findMany({
      where: { venueId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getCurrentForApp(venueId: string) {
    await this.ensureVenueExists(venueId);

    const report = await this.prisma.waterQualityReport.findFirst({
      where: {
        venueId,
        isCurrent: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!report) {
      throw new NotFoundException('当前水质报告不存在');
    }

    return report;
  }

  async create(
    venueId: string,
    adminId: string,
    dto: CreateWaterQualityReportDto,
  ) {
    await this.ensureVenueExists(venueId);

    await this.prisma.waterQualityReport.updateMany({
      where: {
        venueId,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
      },
    });

    return this.prisma.waterQualityReport.create({
      data: {
        venueId,
        grade: dto.grade,
        note: dto.note.trim(),
        updatedAt: new Date(dto.updatedAt),
        turbidity: new Prisma.Decimal(dto.turbidity),
        waterTemperature: new Prisma.Decimal(dto.waterTemperature),
        phValue: new Prisma.Decimal(dto.phValue),
        freeChlorine: new Prisma.Decimal(dto.freeChlorine),
        combinedChlorine: new Prisma.Decimal(dto.combinedChlorine),
        orp: dto.orp,
        bacterialCount: dto.bacterialCount,
        totalColiforms: dto.totalColiforms,
        urea: new Prisma.Decimal(dto.urea),
        cyanuricAcid: new Prisma.Decimal(dto.cyanuricAcid),
        tds: dto.tds,
        isCurrent: true,
        createdByAdminId: adminId,
      },
    });
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
