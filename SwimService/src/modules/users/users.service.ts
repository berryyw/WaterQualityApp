import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hashSecret, normalizeEmail } from '../../common/utils/auth.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminListUsersQueryDto } from './dto/admin-list-users-query.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminListUsersQueryDto) {
    const where: Prisma.UserWhereInput = {
      ...(query.email
        ? {
            email: {
              contains: query.email.trim().toLowerCase(),
              mode: 'insensitive',
            },
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.nickname
        ? {
            profile: {
              nickname: {
                contains: query.nickname.trim(),
                mode: 'insensitive',
              },
            },
          }
        : {}),
    };

    return this.prisma.user.findMany({
      where,
      include: {
        profile: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateUserDto) {
    const email = normalizeEmail(dto.email);
    const existedUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existedUser) {
      throw new ConflictException('该邮箱已存在');
    }

    return this.prisma.user.create({
      data: {
        email,
        passwordHash: await hashSecret(dto.password),
        status: 'active',
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            nickname: dto.nickname.trim(),
            avatarUrl: dto.avatarUrl?.trim() || null,
          },
        },
      },
      include: {
        profile: true,
      },
    });
  }

  async updateStatus(id: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
      include: {
        profile: true,
      },
    });
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return { success: true };
  }
}
