import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AppAuthModule } from './modules/app-auth/app-auth.module';
import { AppProfileModule } from './modules/app-profile/app-profile.module';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { AdminAccountsModule } from './modules/admin-accounts/admin-accounts.module';
import { UsersModule } from './modules/users/users.module';
import { CitiesModule } from './modules/cities/cities.module';
import { VenuesModule } from './modules/venues/venues.module';
import { WaterQualityModule } from './modules/water-quality/water-quality.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { FollowsModule } from './modules/follows/follows.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { IngestModule } from './modules/ingest/ingest.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CommonModule,
    ConfigModule,
    HealthModule,
    PrismaModule,
    AppAuthModule,
    AppProfileModule,
    AdminAuthModule,
    AdminAccountsModule,
    UsersModule,
    CitiesModule,
    VenuesModule,
    WaterQualityModule,
    ReviewsModule,
    FollowsModule,
    UploadsModule,
    AuditLogsModule,
    IngestModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
