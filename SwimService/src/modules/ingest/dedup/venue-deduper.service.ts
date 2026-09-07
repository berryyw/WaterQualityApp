import { Injectable, Logger } from '@nestjs/common';
import { Prisma, VenueDataSource } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  isVenueNameLikelyPool,
  normalizeAddress,
  normalizeVenueName,
  snapLatLon,
} from '../normalizer';

export interface IngestCandidate {
  source: VenueDataSource;
  externalId: string;
  rawName: string;
  rawAddress?: string | null;
  latitude: number;
  longitude: number;
  cityId: string;
  district?: string | null;
  summary?: string | null;
  typeHint?: string | null;
}

export type MatchAction =
  | 'created'
  | 'external_id_attached'
  | 'duplicate_skipped'
  | 'not_a_pool_filtered';

export interface MatchResult {
  venueId: string;
  created: boolean;
  action: MatchAction;
  matchedOn: 'external_id' | 'name_plus_snap' | 'address_plus_city' | 'new';
  normalizedName: string;
}

@Injectable()
export class VenueDeduper {
  private readonly logger = new Logger(VenueDeduper.name);

  constructor(private readonly prisma: PrismaService) {}

  async matchOrCreate(
    candidate: IngestCandidate,
    options: { dryRun?: boolean } = {},
  ): Promise<MatchResult> {
    const { dryRun = false } = options;

    const normalizedName = normalizeVenueName(candidate.rawName);
    if (!isVenueNameLikelyPool(normalizedName)) {
      return {
        venueId: '',
        created: false,
        action: 'not_a_pool_filtered',
        matchedOn: 'new',
        normalizedName,
      };
    }

    const { snappedLatitude, snappedLongitude } = snapLatLon(
      candidate.latitude,
      candidate.longitude,
    );
    const normalizedAddress = normalizeAddress(candidate.rawAddress ?? '');

    // Rule 1: external ID unique
    const existingByExtId = await this.prisma.venueExternalId.findUnique({
      where: {
        source_externalId: {
          source: candidate.source,
          externalId: candidate.externalId,
        },
      },
      select: { venueId: true },
    });
    if (existingByExtId) {
      return {
        venueId: existingByExtId.venueId,
        created: false,
        action: 'duplicate_skipped',
        matchedOn: 'external_id',
        normalizedName,
      };
    }

    // Rule 2: normalized name + snapped coordinate
    const candidatesByNameCoord = await this.prisma.venue.findFirst({
      where: {
        cityId: candidate.cityId,
        snappedLatitude,
        snappedLongitude,
        OR: [
          { name: { equals: candidate.rawName, mode: 'insensitive' } },
          { name: { contains: normalizedName, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true },
    });
    if (candidatesByNameCoord) {
      await this.attachExternalId(candidatesByNameCoord.id, candidate, dryRun);
      return {
        venueId: candidatesByNameCoord.id,
        created: false,
        action: 'external_id_attached',
        matchedOn: 'name_plus_snap',
        normalizedName,
      };
    }

    // Rule 3: normalized address + cityId
    if (normalizedAddress.length >= 6) {
      const byAddress = await this.prisma.venue.findFirst({
        where: {
          cityId: candidate.cityId,
          address: { contains: normalizedAddress, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (byAddress) {
        await this.attachExternalId(byAddress.id, candidate, dryRun);
        return {
          venueId: byAddress.id,
          created: false,
          action: 'external_id_attached',
          matchedOn: 'address_plus_city',
          normalizedName,
        };
      }
    }

    // None matched -> create
    const venueId = await this.createVenue(
      candidate,
      snappedLatitude,
      snappedLongitude,
      normalizedName,
      dryRun,
    );
    return {
      venueId,
      created: true,
      action: 'created',
      matchedOn: 'new',
      normalizedName,
    };
  }

  private async attachExternalId(
    venueId: string,
    candidate: IngestCandidate,
    dryRun: boolean,
  ): Promise<void> {
    if (dryRun) return;
    try {
      await this.prisma.venueExternalId.create({
        data: {
          venueId,
          source: candidate.source,
          externalId: candidate.externalId,
          rawName: candidate.rawName,
          rawAddress: candidate.rawAddress ?? undefined,
        },
      });
      await this.prisma.venue.update({
        where: { id: venueId },
        data: { lastIngestedAt: new Date() },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return;
      }
      this.logger.warn(
        `[attachExternalId] failed venueId=${venueId} extId=${candidate.externalId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async createVenue(
    candidate: IngestCandidate,
    snappedLatitude: number,
    snappedLongitude: number,
    _normalizedName: string,
    dryRun: boolean,
  ): Promise<string> {
    if (dryRun) {
      return `dry-run_${candidate.source}_${candidate.externalId}`;
    }
    const created = await this.prisma.venue.create({
      data: {
        cityId: candidate.cityId,
        name: candidate.rawName.slice(0, 128),
        district: (candidate.district ?? '未知').slice(0, 64),
        address: (candidate.rawAddress ?? candidate.rawName).slice(0, 255),
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        snappedLatitude,
        snappedLongitude,
        summary: candidate.summary
          ? candidate.summary.slice(0, 512)
          : [
              candidate.typeHint ? `POI分类：${candidate.typeHint}` : null,
              `数据来源：${this.sourceLabel(candidate.source)}`,
            ]
              .filter(Boolean)
              .join(' · ')
              .slice(0, 512),
        status: 'normal',
        dataSource: candidate.source,
        lastIngestedAt: new Date(),
        externalIds: {
          create: {
            source: candidate.source,
            externalId: candidate.externalId,
            rawName: candidate.rawName,
            rawAddress: candidate.rawAddress ?? undefined,
          },
        },
      },
      select: { id: true },
    });
    return created.id;
  }

  private sourceLabel(source: VenueDataSource): string {
    switch (source) {
      case 'AMAP_POI':
        return '高德 POI 公开数据';
      case 'GOOGLE_PLACES':
        return 'Google Places';
      case 'GOV_LICENSE':
        return '体育局许可公示';
      case 'OSM_OVERPASS':
        return 'OpenStreetMap (Overpass API)';
      case 'MANUAL':
      default:
        return '人工录入';
    }
  }
}
