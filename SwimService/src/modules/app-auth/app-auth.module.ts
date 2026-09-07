import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { AppAuthController } from './app-auth.controller';
import { AppAuthService } from './app-auth.service';

@Module({
  imports: [JwtModule.register({}), PrismaModule, EmailModule],
  controllers: [AppAuthController],
  providers: [AppAuthService],
})
export class AppAuthModule {}
