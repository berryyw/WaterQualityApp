import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { VenueDataSource } from '@prisma/client';
import 'reflect-metadata';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../prisma/prisma.service';
import { IngestCityStats } from '../ingest.types';
import { AmapPoiProvider, OsmOverpassProvider } from '../providers';
import { IngestCities, IngestProviderKind } from './ingest-cities.catalog';
import { VenueDeduper } from '../dedup/venue-deduper.service';

const DEFAULT_AMAP_KEYWORDS = [
  '游泳馆',
  '游泳池',
  '恒温泳池',
  '体育中心 游泳',
  '健身中心 泳池',
  '室内游泳馆',
];

const CITY_PLACEHOLDER =
  '请指定 --city <adcode|cityCode>，例如 --city 110000 或 --city beijing 或 --city la';

function parseArgs(argv: string[]): {
  cityToken: string | null;
  keywords: string[];
  dryRun: boolean;
  maxPages: number;
  sleepMs: number;
  verbose: boolean;
  provider: IngestProviderKind | 'AUTO';
} {
  const args = argv.slice(2);
  let cityToken: string | null = null;
  const keywords: string[] = [];
  let dryRun = false;
  let maxPages = 20;
  let sleepMs = 250;
  let verbose = false;
  let provider: IngestProviderKind | 'AUTO' = 'AUTO';

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a) continue;
    if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    }
    if (a === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (a === '--verbose' || a === '-v') {
      verbose = true;
      continue;
    }
    const eq = a.indexOf('=');
    let key: string;
    let value: string | undefined;
    if (eq > 0) {
      key = a.slice(0, eq);
      value = a.slice(eq + 1);
    } else {
      key = a;
      value = args[i + 1];
      if (value && !value.startsWith('--')) i++;
    }
    switch (key) {
      case '--city':
      case '--city-code':
      case '--adcode':
        cityToken = value?.trim() ?? null;
        break;
      case '--keywords':
      case '--keyword':
        for (const piece of (value ?? '').split(',')) {
          const k = piece.trim();
          if (k) keywords.push(k);
        }
        break;
      case '--max-pages':
        maxPages = Math.max(1, parseInt(value ?? '20', 10) || 20);
        break;
      case '--sleep-ms':
        sleepMs = Math.max(0, parseInt(value ?? '250', 10) || 250);
        break;
      case '--provider':
        if (value) {
          const v = value.toUpperCase();
          if (
            v === 'AMAP' ||
            v === 'OSM_OVERPASS' ||
            v === 'OSM' ||
            v === 'AUTO'
          ) {
            provider = v === 'OSM' ? 'OSM_OVERPASS' : v;
          }
        }
        break;
    }
  }

  return {
    cityToken,
    keywords: keywords.length ? keywords : DEFAULT_AMAP_KEYWORDS,
    dryRun,
    maxPages,
    sleepMs,
    verbose,
    provider,
  };
}

function printHelp(): void {
  const lines = [
    'Usage: npm run ingest:city -- --city <adcode|cityCode> [options]',
    '',
    'Options:',
    '  --city, --city-code, --adcode   Target city, e.g. 110000 / beijing / shanghai / shenzhen / hangzhou / la (Los Angeles)',
    '  --provider AUTO|AMAP|OSM        Select POI source explicitly. AUTO (default): 中国城市用高德, 洛杉矶等用 OSM Overpass',
    '  --keywords a,b,c                Comma-separated POI keywords (AMAP only). Default: 游泳馆,游泳池,恒温泳池,体育中心 游泳,健身中心 泳池,室内游泳馆',
    '  --max-pages N                    Max pages per keyword (AMAP only, default: 20)',
    '  --sleep-ms N                     Sleep ms between requests (default: 250). OSM recommends >= 500',
    '  --dry-run                        Collect candidates and run dedupe logic but do NOT write to the DB',
    '  --verbose, -v                    Print per-candidate dedupe action',
    '  --help, -h                       Show this help',
    '',
    'Examples:',
    '  # 北京 (高德 POI)',
    '  npm run ingest:city -- --city beijing',
    '',
    '  # 洛杉矶 (OpenStreetMap Overpass API, 免费无需 Key)',
    '  npm run ingest:city -- --city la --provider OSM',
  ];

  console.log(lines.join('\n'));
}

async function run(): Promise<void> {
  const logger = new Logger('IngestCityJob');
  const opts = parseArgs(process.argv);
  if (!opts.cityToken) {
    logger.error(CITY_PLACEHOLDER);
    printHelp();
    process.exit(2);
  }

  const logLevels: Array<'log' | 'warn' | 'error' | 'debug'> = opts.verbose
    ? ['log', 'warn', 'error', 'debug']
    : ['log', 'warn', 'error'];
  const ctx = await NestFactory.createApplicationContext(AppModule, {
    logger: logLevels,
  });
  try {
    const prisma = ctx.get(PrismaService);
    const amap = ctx.get(AmapPoiProvider);
    const osm = ctx.get(OsmOverpassProvider);
    const deduper = ctx.get(VenueDeduper);

    const city = await resolveCity(prisma, opts.cityToken);
    if (!city) {
      logger.error(
        `Cannot resolve city "${opts.cityToken}". Make sure cities table has a row with code="${opts.cityToken.toLowerCase()}" OR name matches.`,
      );
      process.exit(4);
    }

    const providerKind = IngestCities.providerFor(
      city.code,
      opts.provider === 'AUTO' ? undefined : opts.provider,
    );

    const stats: IngestCityStats = {
      cityId: city.id,
      cityName: city.name,
      keywords: opts.keywords,
      candidatesCollected: 0,
      poolsFiltered: 0,
      duplicatesSkippedByExtId: 0,
      externalIdsAttached: 0,
      created: 0,
      notAPool: 0,
      errors: 0,
      dryRun: opts.dryRun,
    };

    const handledExtIds = new Set<string>();

    if (providerKind === 'AMAP') {
      if (!amap.isConfigured()) {
        logger.error(
          'Missing AMAP_WEB_KEY. Add it to SwimService/.env (example: AMAP_WEB_KEY=xxxxxxxxxxxx) and re-run, or use --provider OSM for non-China cities.',
        );
        process.exit(3);
      }

      const adcode = IngestCities.adcodeFor(
        city.code,
        city.name,
        opts.cityToken,
      );
      logger.log(
        `Start ingest: city=${city.name} (code=${city.code}) provider=AMAP amapAdcode=${adcode} keywords=[${opts.keywords.join(', ')}] dryRun=${opts.dryRun} maxPages=${opts.maxPages}`,
      );

      for (const kw of opts.keywords) {
        let items;
        try {
          items = await amap.searchTextAll(kw, adcode, {
            maxPages: opts.maxPages,
            sleepMs: opts.sleepMs,
          });
        } catch (err) {
          stats.errors++;
          logger.error(
            `Amap search failed for keyword="${kw}": ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          continue;
        }

        for (const item of items) {
          const extKey = `AMAP_POI:${item.id}`;
          if (handledExtIds.has(extKey)) continue;
          handledExtIds.add(extKey);
          stats.candidatesCollected++;

          try {
            const result = await deduper.matchOrCreate(
              {
                source: 'AMAP_POI',
                externalId: item.id,
                rawName: item.name,
                rawAddress: item.address,
                latitude: item.latitude,
                longitude: item.longitude,
                cityId: city.id,
                district: item.district,
                typeHint: item.type,
              },
              { dryRun: opts.dryRun },
            );
            recordStats(stats, result);
            if (opts.verbose) printVerbose(result);
          } catch (err) {
            stats.errors++;
            if (opts.verbose) {
              logger.warn(
                `Dedupe/create failed for poiId=${item.id} name="${item.name}": ${
                  err instanceof Error ? err.message : String(err)
                }`,
              );
            }
          }
        }
      }
    } else {
      if (!osm.isConfigured()) {
        logger.error('[OSM_OVERPASS] Provider not configured.');
        process.exit(5);
      }

      const bounds = IngestCities.osmBoundsFor(city.code);
      if (!bounds) {
        logger.error(
          `[OSM_OVERPASS] No OSM bounding-box defined for city=${city.code}. Please add it to ingest-cities.catalog.ts -> OSM_CITY_BOUNDS.`,
        );
        process.exit(6);
      }

      logger.log(
        `Start ingest: city=${city.name} (code=${city.code}) provider=OSM_OVERPASS bounds=${JSON.stringify(bounds)} dryRun=${opts.dryRun}`,
      );

      let items;
      try {
        items = await osm.searchSwimmingPoolsInBounds(bounds, {
          sleepMs: Math.max(500, opts.sleepMs),
        });
      } catch (err) {
        stats.errors++;
        logger.error(
          `[OSM_OVERPASS] search failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        process.exit(7);
      }

      for (const item of items) {
        const extKey = `OSM_OVERPASS:${item.id}`;
        if (handledExtIds.has(extKey)) continue;
        handledExtIds.add(extKey);
        stats.candidatesCollected++;

        try {
          const result = await deduper.matchOrCreate(
            {
              source: 'OSM_OVERPASS',
              externalId: item.id,
              rawName: item.name,
              rawAddress: item.address,
              latitude: item.latitude,
              longitude: item.longitude,
              cityId: city.id,
              district: item.district,
              typeHint: item.type,
            },
            { dryRun: opts.dryRun },
          );
          recordStats(stats, result);
          if (opts.verbose) printVerbose(result);
        } catch (err) {
          stats.errors++;
          if (opts.verbose) {
            logger.warn(
              `Dedupe/create failed for osmId=${item.id} name="${item.name}": ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
        }
      }
    }

    stats.poolsFiltered =
      stats.created +
      stats.duplicatesSkippedByExtId +
      stats.externalIdsAttached;

    logger.log('--- Ingest Summary ---');
    logger.log(JSON.stringify(stats, null, 2));
  } finally {
    await ctx.close();
  }
}

function recordStats(stats: IngestCityStats, result: { action: string }): void {
  switch (result.action) {
    case 'created':
      stats.created++;
      break;
    case 'duplicate_skipped':
      stats.duplicatesSkippedByExtId++;
      break;
    case 'external_id_attached':
      stats.externalIdsAttached++;
      break;
    case 'not_a_pool_filtered':
      stats.notAPool++;
      break;
  }
}

function printVerbose(result: {
  action: string;
  matchedOn: string;
  normalizedName: string;
}): void {
  console.log(
    `  ${result.action.toUpperCase().padEnd(22)} on=${String(result.matchedOn).padEnd(16)} name="${result.normalizedName.slice(0, 28)}"`,
  );
}

async function resolveCity(
  prisma: PrismaService,
  token: string,
): Promise<{ id: string; code: string; name: string } | null> {
  const t = token.trim();
  if (!t) return null;

  const byCode = await prisma.city.findFirst({
    where: { code: { equals: t.toLowerCase() } },
    select: { id: true, code: true, name: true },
  });
  if (byCode) return byCode;

  const byName = await prisma.city.findFirst({
    where: {
      OR: [
        { name: { equals: t, mode: 'insensitive' } },
        { name: { contains: t, mode: 'insensitive' } },
      ],
    },
    select: { id: true, code: true, name: true },
  });
  if (byName) return byName;

  const byAdcode = IngestCities.codeFromAdcode(t);
  if (byAdcode) {
    const row = await prisma.city.findFirst({
      where: { code: { equals: byAdcode.toLowerCase() } },
      select: { id: true, code: true, name: true },
    });
    if (row) return row;
  }
  return null;
}

run().catch((err) => {
  console.error('IngestCityJob FATAL:', err);
  process.exit(1);
});
