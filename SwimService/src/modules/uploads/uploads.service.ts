import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildUserAvatarObjectKey,
  buildVenueCoverObjectKey,
} from '../../common/utils/storage.util';
import { StorageService } from '../storage/storage.service';
import { CreateUploadTicketDto } from './dto/create-upload-ticket.dto';

@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async createTicket(dto: CreateUploadTicketDto) {
    if (dto.type === 'user-avatar') {
      if (!dto.userId) {
        throw new BadRequestException('用户头像上传必须提供 userId');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: dto.userId },
        select: { id: true },
      });

      if (!user) {
        throw new NotFoundException('用户不存在');
      }

      const objectKey = buildUserAvatarObjectKey(dto.userId, dto.fileName);
      return this.storageService.createUploadTicket({
        objectKey,
        mimeType: dto.mimeType,
      });
    }

    if (!dto.venueId) {
      throw new BadRequestException('泳馆封面上传必须提供 venueId');
    }

    const venue = await this.prisma.venue.findUnique({
      where: { id: dto.venueId },
      select: { id: true },
    });

    if (!venue) {
      throw new NotFoundException('泳馆不存在');
    }

    const objectKey = buildVenueCoverObjectKey(dto.venueId, dto.fileName);
    return this.storageService.createUploadTicket({
      objectKey,
      mimeType: dto.mimeType,
    });
  }
}
