import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedRequest } from '../auth/auth-request.types';
import { extractBearerToken } from '../auth/bearer-token.util';

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);

    let payload: { sub: string; type: string; role?: string; jti?: string };

    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('管理员登录态已失效');
    }

    if (payload.type !== 'admin_access') {
      throw new UnauthorizedException('无效的管理员访问令牌');
    }

    if (!payload.jti) {
      throw new UnauthorizedException('管理员登录态已失效');
    }

    const session = await this.prisma.adminSession.findUnique({
      where: { tokenId: payload.jti },
      select: {
        adminId: true,
        tokenId: true,
        revokedAt: true,
        expiresAt: true,
      },
    });

    if (
      !session ||
      session.adminId !== payload.sub ||
      session.revokedAt != null ||
      session.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException('管理员登录态已失效');
    }

    const admin = await this.prisma.adminAccount.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        account: true,
        role: true,
        status: true,
      },
    });

    if (!admin || admin.status !== 'active') {
      throw new UnauthorizedException('管理员不存在或已被禁用');
    }

    request.currentAdmin = {
      ...admin,
      tokenId: session.tokenId,
    };
    return true;
  }
}
