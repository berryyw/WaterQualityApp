import { UnauthorizedException } from '@nestjs/common';

export function extractBearerToken(authorization?: string | string[]) {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;

  if (!value) {
    throw new UnauthorizedException('缺少访问令牌');
  }

  const [scheme, token] = value.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new UnauthorizedException('访问令牌格式不正确');
  }

  return token;
}
