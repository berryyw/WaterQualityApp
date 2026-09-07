import { randomUUID } from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AdminAuthContext } from '../../common/auth/auth-request.types';
import { PrismaService } from '../../prisma/prisma.service';
import { compareSecret, hashSecret } from '../../common/utils/auth.util';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminRefreshTokenDto } from './dto/admin-refresh-token.dto';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: AdminLoginDto) {
    const admin = await this.prisma.adminAccount.findUnique({
      where: { account: dto.account.trim() },
    });

    if (!admin || admin.status !== 'active') {
      throw new UnauthorizedException('账号不存在或已被禁用');
    }

    const passwordMatched = await compareSecret(
      dto.password,
      admin.passwordHash,
    );

    if (!passwordMatched) {
      throw new UnauthorizedException('账号或密码错误');
    }

    const tokens = await this.issueAdminTokens(admin.id);

    await this.prisma.adminAccount.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      ...tokens,
      admin: {
        id: admin.id,
        account: admin.account,
        name: admin.name,
        role: admin.role,
        status: admin.status,
        lastLoginAt: admin.lastLoginAt,
      },
    };
  }

  async refresh(dto: AdminRefreshTokenDto) {
    const payload = await this.verifyRefreshToken(dto.refreshToken);

    if (payload.type !== 'admin_refresh') {
      throw new UnauthorizedException('无效的管理员刷新令牌');
    }

    const admin = await this.prisma.adminAccount.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        account: true,
        name: true,
        role: true,
        status: true,
        lastLoginAt: true,
      },
    });

    if (!admin || admin.status !== 'active') {
      throw new UnauthorizedException('管理员不存在或已被禁用');
    }

    let matchedSession =
      payload.jti == null
        ? null
        : await this.prisma.adminSession.findUnique({
            where: { tokenId: payload.jti },
          });

    if (
      !matchedSession ||
      matchedSession.adminId !== admin.id ||
      matchedSession.revokedAt != null ||
      matchedSession.expiresAt <= new Date()
    ) {
      const candidateSessions = await this.prisma.adminSession.findMany({
        where: {
          adminId: admin.id,
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      for (const session of candidateSessions) {
        const matched = await compareSecret(
          dto.refreshToken,
          session.refreshTokenHash,
        );
        if (matched) {
          matchedSession = session;
          break;
        }
      }
    }

    if (!matchedSession) {
      throw new UnauthorizedException('管理员登录态已失效');
    }

    await this.prisma.adminSession.update({
      where: { id: matchedSession.id },
      data: { revokedAt: new Date() },
    });

    return {
      ...(await this.issueAdminTokens(admin.id)),
      admin: {
        id: admin.id,
        account: admin.account,
        name: admin.name,
        role: admin.role,
        status: admin.status,
        lastLoginAt: admin.lastLoginAt,
      },
    };
  }

  async logout(admin: AdminAuthContext) {
    if (admin.tokenId) {
      await this.prisma.adminSession.updateMany({
        where: {
          adminId: admin.id,
          tokenId: admin.tokenId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    return {
      success: true,
      message: '管理员已退出登录',
    };
  }

  private async verifyRefreshToken(token: string) {
    try {
      return await this.jwtService.verifyAsync<{
        sub: string;
        type: string;
        jti?: string;
      }>(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('管理员登录态已失效');
    }
  }

  private async issueAdminTokens(adminId: string) {
    const sessionTokenId = randomUUID();

    const accessToken = await this.jwtService.signAsync(
      {
        sub: adminId,
        type: 'admin_access',
        role: 'admin',
      },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
        jwtid: sessionTokenId,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: adminId,
        type: 'admin_refresh',
      },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '30d',
        jwtid: sessionTokenId,
      },
    );

    await this.prisma.adminSession.create({
      data: {
        adminId,
        tokenId: sessionTokenId,
        refreshTokenHash: await hashSecret(refreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }
}
