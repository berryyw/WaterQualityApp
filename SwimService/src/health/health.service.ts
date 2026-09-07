import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HealthService {
  constructor(private readonly configService: ConfigService) {}

  getStatus() {
    const redisEnabled =
      String(
        this.configService.get<string>('REDIS_ENABLED') ?? 'false',
      ).toLowerCase() === 'true';

    return {
      service: 'SwimService',
      status: 'ok',
      environment: this.configService.get<string>('NODE_ENV') ?? 'development',
      storageProvider:
        this.configService.get<string>('STORAGE_PROVIDER') ?? 'local',
      emailProvider: this.configService.get<string>('EMAIL_PROVIDER') ?? 'log',
      redis: {
        enabled: redisEnabled,
        mode: redisEnabled
          ? 'reserved-for-future-cache-and-session'
          : 'disabled',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
