import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WaterQualityController } from './water-quality.controller';
import { WaterQualityService } from './water-quality.service';

@Module({
  imports: [PrismaModule],
  controllers: [WaterQualityController],
  providers: [WaterQualityService],
})
export class WaterQualityModule {}
