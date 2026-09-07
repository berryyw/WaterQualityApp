import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAuditLogsQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.adminId ? { adminId: query.adminId } : {}),
      ...(query.action
        ? { action: { contains: query.action.trim(), mode: 'insensitive' } }
        : {}),
      ...(query.targetType
        ? {
            targetType: {
              contains: query.targetType.trim(),
              mode: 'insensitive',
            },
          }
        : {}),
    };

    return this.prisma.auditLog.findMany({
      where,
      include: {
        admin: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    adminId: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    payload?: Prisma.InputJsonValue;
    ip?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        adminId: data.adminId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        payload: data.payload,
        ip: data.ip,
      },
    });
  }
}
