import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { VenueDeduper } from './dedup/venue-deduper.service';
import { AmapPoiProvider } from './providers/amap-poi.provider';
import { OsmOverpassProvider } from './providers/osm-overpass.provider';
import { SwimmableClient } from './providers/swimmable.client';
import { WaterQualityPrefetchService } from './water-quality-prefetch.service';

@Module({
  imports: [PrismaModule],
  providers: [
    VenueDeduper,
    AmapPoiProvider,
    OsmOverpassProvider,
    SwimmableClient,
    WaterQualityPrefetchService,
  ],
  exports: [
    VenueDeduper,
    AmapPoiProvider,
    OsmOverpassProvider,
    SwimmableClient,
    WaterQualityPrefetchService,
  ],
})
export class IngestModule {}
