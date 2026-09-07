import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';

@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForApp() {
    return this.prisma.city.findMany({
      where: { status: 'enabled' },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async listForAdmin() {
    return this.prisma.city.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: {
          select: {
            venues: true,
          },
        },
      },
    });
  }

  async create(dto: CreateCityDto) {
    const existedCity = await this.prisma.city.findUnique({
      where: { code: dto.code.trim().toLowerCase() },
    });

    if (existedCity) {
      throw new ConflictException('城市编码已存在');
    }

    return this.prisma.city.create({
      data: {
        code: dto.code.trim().toLowerCase(),
        name: dto.name.trim(),
        status: dto.status ?? 'enabled',
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateCityDto) {
    const city = await this.prisma.city.findUnique({ where: { id } });

    if (!city) {
      throw new NotFoundException('城市不存在');
    }

    return this.prisma.city.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(typeof dto.sortOrder === 'number'
          ? { sortOrder: dto.sortOrder }
          : {}),
      },
    });
  }
}
