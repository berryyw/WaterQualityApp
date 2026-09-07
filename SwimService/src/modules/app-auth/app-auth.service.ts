import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  compareSecret,
  deriveNicknameFromEmail,
  generateVerificationCode,
  hashSecret,
  normalizeEmail,
} from '../../common/utils/auth.util';
import { EmailService } from '../email/email.service';
import { AppLoginDto } from './dto/app-login.dto';
import { AppRefreshTokenDto } from './dto/app-refresh-token.dto';
import { AppRegisterDto } from './dto/app-register.dto';
import { SendCodeDto } from './dto/send-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';

@Injectable()
export class AppAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async sendCode(dto: SendCodeDto) {
    const email = normalizeEmail(dto.email);

    if (dto.purpose === 'register') {
      const existedUser = await this.prisma.user.findUnique({
        where: { email },
      });
      if (existedUser) {
        throw new ConflictException('该邮箱已注册');
      }
    }

    const code = generateVerificationCode();

    await this.prisma.emailVerificationCode.create({
      data: {
        email,
        purpose: dto.purpose,
        codeHash: await hashSecret(code),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    await this.emailService.sendVerificationCode({
      email,
      code,
      purpose: dto.purpose,
      expiresInMinutes: 10,
    });

    return {
      success: true,
      message: '验证码已发送，请查收邮件',
      expiresInSeconds: 600,
    };
  }

  async verifyCode(dto: VerifyCodeDto) {
    const email = normalizeEmail(dto.email);

    const codeRecord = await this.prisma.emailVerificationCode.findFirst({
      where: {
        email,
        purpose: dto.purpose,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!codeRecord) {
      throw new BadRequestException('验证码不存在或已过期');
    }

    const codeMatched = await compareSecret(dto.code, codeRecord.codeHash);

    if (!codeMatched) {
      throw new UnauthorizedException('验证码错误');
    }

    await this.prisma.emailVerificationCode.update({
      where: { id: codeRecord.id },
      data: { usedAt: new Date() },
    });

    const verificationToken = await this.jwtService.signAsync(
      {
        sub: email,
        type: 'app_verification',
        purpose: dto.purpose,
      },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
        jwtid: randomUUID(),
      },
    );

    return {
      verificationToken,
      expiresInSeconds: 900,
    };
  }

  async register(dto: AppRegisterDto) {
    const email = normalizeEmail(dto.email);
    const payload = await this.verifyVerificationToken(dto.verificationToken);

    if (payload.sub !== email || payload.purpose !== 'register') {
      throw new UnauthorizedException('注册凭证无效');
    }

    const existedUser = await this.prisma.user.findUnique({ where: { email } });
    if (existedUser) {
      throw new ConflictException('该邮箱已注册');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await hashSecret(dto.password),
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            nickname: dto.nickname?.trim() || deriveNicknameFromEmail(email),
          },
        },
      },
      include: {
        profile: true,
      },
    });

    const tokens = await this.issueUserTokens(user.id);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.profile?.nickname ?? deriveNicknameFromEmail(user.email),
        avatarUrl: user.profile?.avatarUrl ?? null,
        status: user.status,
      },
    };
  }

  async login(dto: AppLoginDto) {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('账号不存在或已被禁用');
    }

    const passwordMatched = await compareSecret(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatched) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const tokens = await this.issueUserTokens(user.id);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.profile?.nickname ?? deriveNicknameFromEmail(user.email),
        avatarUrl: user.profile?.avatarUrl ?? null,
        status: user.status,
      },
    };
  }

  async refresh(dto: AppRefreshTokenDto) {
    const payload = await this.verifyRefreshToken(dto.refreshToken);

    if (payload.type !== 'user_refresh') {
      throw new UnauthorizedException('无效的用户刷新令牌');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true },
    });

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('用户不存在或已被禁用');
    }

    let matchedSession =
      payload.jti == null
        ? null
        : await this.prisma.userSession.findUnique({
            where: { tokenId: payload.jti },
          });

    if (
      !matchedSession ||
      matchedSession.userId !== user.id ||
      matchedSession.revokedAt != null ||
      matchedSession.expiresAt <= new Date()
    ) {
      const candidateSessions = await this.prisma.userSession.findMany({
        where: {
          userId: user.id,
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
      throw new UnauthorizedException('用户登录态已失效');
    }

    await this.prisma.userSession.update({
      where: { id: matchedSession.id },
      data: { revokedAt: new Date() },
    });

    return this.issueUserTokens(user.id);
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
      throw new UnauthorizedException('用户登录态已失效');
    }
  }

  private async issueUserTokens(userId: string) {
    const sessionTokenId = randomUUID();

    const accessToken = await this.jwtService.signAsync(
      {
        sub: userId,
        type: 'user_access',
      },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
        jwtid: randomUUID(),
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: userId,
        type: 'user_refresh',
      },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '30d',
        jwtid: sessionTokenId,
      },
    );

    await this.prisma.userSession.create({
      data: {
        userId,
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
