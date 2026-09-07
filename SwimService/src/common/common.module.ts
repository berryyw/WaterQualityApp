import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { AppJwtGuard } from './guards/app-jwt.guard';

@Global()
@Module({
  imports: [JwtModule.register({}), ConfigModule, PrismaModule],
  providers: [AppJwtGuard, AdminJwtGuard],
  exports: [JwtModule, AppJwtGuard, AdminJwtGuard],
})
export class CommonModule {}
