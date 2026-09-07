import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { AppProfileController } from './app-profile.controller';
import { AppProfileService } from './app-profile.service';

@Module({
  imports: [JwtModule.register({}), PrismaModule, StorageModule],
  controllers: [AppProfileController],
  providers: [AppProfileService],
})
export class AppProfileModule {}
