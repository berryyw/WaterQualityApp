import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { extname } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  deriveNicknameFromEmail,
  hashSecret,
  normalizeEmail,
} from '../../common/utils/auth.util';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ChangeAppEmailDto } from './dto/change-app-email.dto';
import { ChangeAppPasswordDto } from './dto/change-app-password.dto';
import { UpdateAppProfileDto } from './dto/update-app-profile.dto';

@Injectable()
export class AppProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        profile: true,
        follows: {
          where: { status: 'active' },
          select: {
            venueId: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return {
      id: user.id,
      email: user.email,
      nickname: user.profile?.nickname ?? deriveNicknameFromEmail(user.email),
      avatarUrl: user.profile?.avatarUrl ?? null,
      status: user.status,
      followedVenueIds: user.follows.map((item) => item.venueId),
    };
  }

  async updateProfile(userId: string, dto: UpdateAppProfileDto) {
    const currentUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    });

    const nickname =
      dto.nickname?.trim() ||
      currentUser.profile?.nickname ||
      deriveNicknameFromEmail(currentUser.email);

    await this.prisma.userProfile.upsert({
      where: { userId },
      update: {
        nickname,
      },
      create: {
        userId,
        nickname,
      },
    });

    return this.getMe(userId);
  }

  async uploadAvatar(
    userId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    const currentUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true },
    });

    const extension = this.resolveAvatarExtension(file);
    const objectKey = this.storageService.buildObjectKey(
      'user-avatar',
      userId,
      extension,
    );
    const uploadedAvatar = await this.storageService.uploadBuffer({
      objectKey,
      mimeType: file.mimetype,
      body: file.buffer,
    });

    await this.storageService.deleteByPublicUrl(currentUser.profile?.avatarUrl);

    const nickname =
      currentUser.profile?.nickname ??
      deriveNicknameFromEmail(currentUser.email);

    await this.prisma.userProfile.upsert({
      where: { userId },
      update: {
        nickname,
        avatarUrl: uploadedAvatar.publicUrl,
      },
      create: {
        userId,
        nickname,
        avatarUrl: uploadedAvatar.publicUrl,
      },
    });

    return this.getMe(userId);
  }

  async changeEmail(userId: string, dto: ChangeAppEmailDto) {
    const payload = await this.verifyVerificationToken(dto.verificationToken);
    const newEmail = normalizeEmail(dto.newEmail);

    if (payload.sub !== newEmail || payload.purpose !== 'change_email') {
      throw new UnauthorizedException('邮箱修改凭证无效');
    }

    const existedUser = await this.prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    });

    if (existedUser && existedUser.id !== userId) {
      throw new ConflictException('该邮箱已被占用');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
        emailVerifiedAt: new Date(),
      },
    });

    return this.getMe(userId);
  }

  async changePassword(userId: string, dto: ChangeAppPasswordDto) {
    const currentUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        email: true,
      },
    });

    const payload = await this.verifyVerificationToken(dto.verificationToken);

    if (
      payload.sub !== currentUser.email ||
      payload.purpose !== 'change_password'
    ) {
      throw new UnauthorizedException('密码修改凭证无效');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hashSecret(dto.newPassword),
      },
    });

    await this.prisma.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return {
      success: true,
    };
  }

  private async verifyVerificationToken(token: string) {
    try {
      return await this.jwtService.verifyAsync<{
        sub: string;
        type: string;
        purpose: string;
      }>(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('验证令牌已失效');
    }
  }
  private resolveAvatarExtension(file: {
    mimetype: string;
    originalname: string;
  }) {
    const mimeExtensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/heic': '.heic',
      'image/heif': '.heif',
    };

    if (mimeExtensions[file.mimetype]) {
      return mimeExtensions[file.mimetype];
    }

    const originalExtension = extname(file.originalname).toLowerCase();
    return originalExtension || '.jpg';
  }
}
