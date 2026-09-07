import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hashSecret } from '../../common/utils/auth.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAdminAccountDto } from './dto/create-admin-account.dto';

@Injectable()
export class AdminAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.adminAccount.findMany({
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  async create(dto: CreateAdminAccountDto) {
    const account = dto.account.trim();
    const existed = await this.prisma.adminAccount.findUnique({
      where: { account },
      select: { id: true },
    });

    if (existed) {
      throw new ConflictException('后台账号已存在');
    }

    return this.prisma.adminAccount.create({
      data: {
        account,
        name: dto.name.trim(),
        passwordHash: await hashSecret(dto.password),
        role: 'admin',
        status: 'active',
      },
    });
  }

  async remove(id: string) {
    const account = await this.prisma.adminAccount.findUnique({
      where: { id },
      select: { id: true, account: true },
    });

    if (!account) {
      throw new NotFoundException('后台账号不存在');
    }

    if (account.account === 'admin') {
      throw new ConflictException('默认 admin 账号不允许删除');
    }

    await this.prisma.adminAccount.delete({
      where: { id },
    });

    return { success: true };
  }
}
