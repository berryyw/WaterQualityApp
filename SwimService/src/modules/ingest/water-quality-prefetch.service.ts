import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, WaterQualityReportSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FetchResult,
  SwimmableClient,
  SwimmableRateLimitError,
} from './providers/swimmable.client';

export type PrefetchSummary = {
  scannedVenues: number;
  successWrites: number;
  skippedNoCoords: number;
  rateLimitRetries: number;
  fetchErrors: number;
  writeErrors: number;
  dryRun: boolean;
  durationSec: number;
  bySource: Record<string, number>;
};

export type PrefetchOptions = {
  cityCode?: string;
  limit?: number;
  dryRun?: boolean;
  maxPerVenueRateLimitRetries?: number;
  maxTotalErrors?: number;
  expiresHours?: number;
  includeRawResponse?: boolean;
  progressEvery?: number;
  requestIntervalMs?: number;
};

const CHUNK_SIZE = 100;
const DEFAULT_EXPIRES_HOURS = 25;
const DEFAULT_RETRIES = 3;

@Injectable()
export class WaterQualityPrefetchService {
  private readonly logger = new Logger(WaterQualityPrefetchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly swimmable: SwimmableClient,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    name: 'water-quality-prefetch-daily',
    timeZone: 'Asia/Shanghai',
  })
  async runDailyCron(): Promise<PrefetchSummary> {
    this.logger.log(
      '[Cron] Starting daily water quality prefetch @ 2AM CST (all cities: beijing/shanghai/shenzhen/la/...)',
    );
    const summary = await this.runManual({
      dryRun: false,
      maxPerVenueRateLimitRetries: DEFAULT_RETRIES,
      expiresHours: DEFAULT_EXPIRES_HOURS,
      progressEvery: 100,
    });
    this.logger.log(
      `[Cron] Daily prefetch complete: success=${summary.successWrites} scanned=${summary.scannedVenues} errors=${summary.fetchErrors + summary.writeErrors} duration=${summary.durationSec}s`,
    );
    return summary;
  }

  async runManual(opts: PrefetchOptions = {}): Promise<PrefetchSummary> {
    const startedAt = Date.now();
    const dryRun = !!opts.dryRun;
    const expiresHours = opts.expiresHours ?? DEFAULT_EXPIRES_HOURS;
    const maxRetries = opts.maxPerVenueRateLimitRetries ?? DEFAULT_RETRIES;
    const maxTotalErrors = opts.maxTotalErrors ?? Infinity;
    const progressEvery = opts.progressEvery ?? 100;
    const includeRaw = !!opts.includeRawResponse;
    const requestIntervalMs = opts.requestIntervalMs ?? 0;

    const summary: PrefetchSummary = {
      scannedVenues: 0,
      successWrites: 0,
      skippedNoCoords: 0,
      rateLimitRetries: 0,
      fetchErrors: 0,
      writeErrors: 0,
      dryRun,
      durationSec: 0,
      bySource: {
        SWIMMABLE_PUBLIC_DEMO: 0,
        SWIMMABLE_AUTHENTICATED: 0,
      },
    };

    this.logger.log(
      `Prefetch start: cityCode=${opts.cityCode ?? 'ALL'} limit=${opts.limit ?? 'none'} dryRun=${dryRun} maxRetries/venue=${maxRetries} expiresHours=${expiresHours} requestIntervalMs=${requestIntervalMs} swimmableKeyConfigured=${this.swimmable.hasApiKey()}`,
    );

    let cursorId: string | undefined;
    let fetchedChunk = 0;

    outer: while (true) {
      const venues = await this.prisma.venue.findMany({
        where: {
          status: 'normal',
          ...(opts.cityCode
            ? { city: { code: opts.cityCode.trim().toLowerCase() } }
            : {}),
        },
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
          snappedLatitude: true,
          snappedLongitude: true,
        },
        orderBy: { id: 'asc' },
        take: CHUNK_SIZE,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      });

      if (venues.length === 0) break;
      fetchedChunk += venues.length;

      for (const venue of venues) {
        if (opts.limit && summary.scannedVenues >= opts.limit) break outer;
        summary.scannedVenues++;

        let lat: number | null = null;
        let lon: number | null = null;
        if (venue.snappedLatitude != null && venue.snappedLongitude != null) {
          lat = venue.snappedLatitude.toNumber();
          lon = venue.snappedLongitude.toNumber();
        } else {
          lat = venue.latitude.toNumber();
          lon = venue.longitude.toNumber();
        }
        if (
          lat == null ||
          lon == null ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lon)
        ) {
          summary.skippedNoCoords++;
          continue;
        }

        let result: FetchResult | null = null;
        let attemptsLeft = maxRetries + 1;
        let rateLimitedThisVenue = 0;

        while (attemptsLeft > 0) {
          attemptsLeft--;
          try {
            result = await this.swimmable.fetchWaterQualityReport(lat, lon, {
              includeRawResponse: includeRaw,
            });
            break;
          } catch (err) {
            if (err instanceof SwimmableRateLimitError) {
              rateLimitedThisVenue++;
              summary.rateLimitRetries++;
              const sleepMs = err.retryAfterSeconds * 1000;
              this.logger.warn(
                `[429] venue=${venue.id.slice(0, 8)} name="${venue.name.slice(0, 20)}" retryAfter=${err.retryAfterSeconds}s (attempt ${rateLimitedThisVenue}/${maxRetries + 1}) — sleeping`,
              );
              await this.sleep(sleepMs);
              continue;
            }
            summary.fetchErrors++;
            if (summary.fetchErrors + summary.writeErrors >= maxTotalErrors) {
              this.logger.error(
                `Max total errors (${maxTotalErrors}) reached, aborting prefetch. fetchErrors=${summary.fetchErrors} writeErrors=${summary.writeErrors}`,
              );
              break outer;
            }
            if (
              opts.progressEvery &&
              (summary.fetchErrors + summary.writeErrors) % 50 === 0
            ) {
              this.logger.warn(
                `FetchError venue=${venue.id.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)} — cumulative errors=${summary.fetchErrors + summary.writeErrors}`,
              );
            }
            break;
          }
        }

        if (!result) {
          continue;
        }

        const source: WaterQualityReportSource =
          result.source === 'SWIMMABLE_AUTHENTICATED'
            ? 'SWIMMABLE_AUTHENTICATED'
            : 'SWIMMABLE_PUBLIC_DEMO';
        summary.bySource[source] = (summary.bySource[source] ?? 0) + 1;

        if (dryRun) {
          summary.successWrites++;
        } else {
          try {
            await this.persistReport(
              venue.id,
              source,
              result,
              expiresHours,
              includeRaw,
            );
            summary.successWrites++;
          } catch (err) {
            summary.writeErrors++;
            if (summary.fetchErrors + summary.writeErrors >= maxTotalErrors) {
              this.logger.error(
                `Max total errors (${maxTotalErrors}) reached on write, aborting.`,
              );
              break outer;
            }
            this.logger.warn(
              `WriteError venue=${venue.id.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }

        if (progressEvery > 0 && summary.scannedVenues % progressEvery === 0) {
          const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
          this.logger.log(
            `Progress: scanned=${summary.scannedVenues}/${opts.limit ?? '∞'} success=${summary.successWrites} fetchErrors=${summary.fetchErrors} writeErrors=${summary.writeErrors} 429retries=${summary.rateLimitRetries} elapsed=${elapsed}s`,
          );
        }

        if (requestIntervalMs > 0) {
          await this.sleep(requestIntervalMs);
        }
      }

      if (venues.length < CHUNK_SIZE) break;
      cursorId = venues[venues.length - 1].id;
    }

    summary.durationSec = Math.round((Date.now() - startedAt) / 1000);
    this.logger.log('--- Prefetch Summary ---');
    this.logger.log(JSON.stringify(summary, null, 2));
    return summary;
  }

  private async persistReport(
    venueId: string,
    source: WaterQualityReportSource,
    result: FetchResult,
    expiresHours: number,
    includeRaw: boolean,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + expiresHours * 3600 * 1000);
    const r = result.report;

    await this.prisma.$transaction(
      async (tx) => {
        await tx.waterQualityReport.updateMany({
          where: { venueId, isCurrent: true },
          data: { isCurrent: false },
        });

        const data: Prisma.WaterQualityReportCreateInput = {
          venue: { connect: { id: venueId } },
          grade: r.grade,
          note: r.note,
          updatedAt: r.updatedAt,
          turbidity: new Prisma.Decimal(r.turbidity),
          waterTemperature: new Prisma.Decimal(r.waterTemperature),
          phValue: new Prisma.Decimal(r.phValue),
          freeChlorine: new Prisma.Decimal(r.freeChlorine),
          combinedChlorine: new Prisma.Decimal(r.combinedChlorine),
          orp: r.orp,
          bacterialCount: r.bacterialCount,
          totalColiforms: r.totalColiforms,
          urea: new Prisma.Decimal(r.urea),
          cyanuricAcid: new Prisma.Decimal(r.cyanuricAcid),
          tds: r.tds,
          isCurrent: true,
          source,
          expiresAt,
          ...(includeRaw && result.rawResponse !== undefined
            ? { rawResponse: result.rawResponse as Prisma.InputJsonValue }
            : {}),
          createdByAdmin: undefined,
        };

        await tx.waterQualityReport.create({ data });
      },
      { timeout: 15000 },
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
  }
}
