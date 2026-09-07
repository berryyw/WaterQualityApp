import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import { AppModule } from '../../../app.module';
import { WaterQualityPrefetchService } from '../water-quality-prefetch.service';

type ParsedArgs = {
  cityCode: string | null;
  limit: number | null;
  dryRun: boolean;
  maxPerVenueRetries: number;
  maxTotalErrors: number;
  expiresHours: number;
  includeRaw: boolean;
  progressEvery: number;
  verbose: boolean;
  requestIntervalMs: number;
};

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const parsed: ParsedArgs = {
    cityCode: null,
    limit: null,
    dryRun: false,
    maxPerVenueRetries: 3,
    maxTotalErrors: Infinity,
    expiresHours: 25,
    includeRaw: false,
    progressEvery: 100,
    verbose: false,
    requestIntervalMs: 0,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a) continue;
    if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    }
    if (a === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }
    if (a === '--verbose' || a === '-v') {
      parsed.verbose = true;
      continue;
    }
    if (a === '--include-raw') {
      parsed.includeRaw = true;
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
        parsed.cityCode = value?.trim() ?? null;
        break;
      case '--limit':
        parsed.limit = Math.max(1, parseInt(value ?? '0', 10) || 0);
        if (!parsed.limit) parsed.limit = null;
        break;
      case '--max-venue-retries':
      case '--max-retries':
        parsed.maxPerVenueRetries = Math.max(
          0,
          parseInt(value ?? '3', 10) || 3,
        );
        break;
      case '--max-errors':
        parsed.maxTotalErrors = Math.max(1, parseInt(value ?? '0', 10) || 0);
        if (!parsed.maxTotalErrors) parsed.maxTotalErrors = Infinity;
        break;
      case '--expires-hours':
        parsed.expiresHours = Math.max(1, parseInt(value ?? '25', 10) || 25);
        break;
      case '--progress-every':
        parsed.progressEvery = Math.max(0, parseInt(value ?? '100', 10) || 100);
        break;
      case '--interval':
      case '--interval-ms':
      case '--request-interval':
        parsed.requestIntervalMs = Math.max(0, parseInt(value ?? '0', 10) || 0);
        break;
      case '--interval-sec':
      case '--request-interval-sec':
        parsed.requestIntervalMs = Math.max(
          0,
          (parseFloat(value ?? '0') || 0) * 1000,
        );
        break;
    }
  }

  return parsed;
}

function printHelp(): void {
  const lines = [
    'Usage: npm run prefetch:water -- [options]',
    '',
    'Prefetch Swimmable water quality reports into the local DB for all eligible venues.',
    'After this job runs, the App /api/app/venues list endpoint will return cached',
    'waterQuality with note fingerprint "Swimmability X.X/10" without live Swimmable calls.',
    '',
    'Options:',
    '  --city, --city-code CODE     Only process venues whose city.code matches (e.g. beijing, shanghai, la). Default: ALL enabled cities',
    '  --limit N                    Only scan the first N venues (ordered by id). Default: no limit',
    '  --max-venue-retries N        Rate-limit (429) retries per venue before skip. Default: 3',
    '  --max-errors N               Hard stop after N cumulative fetch+write errors. Default: no limit',
    '  --expires-hours N            Expire the new report after N hours. Default: 25 (~daily + 1h overlap)',
    '  --progress-every N           Log progress every N venues. Default: 100 (0 = disable)',
    '  --interval, --interval-ms N  Sleep N milliseconds between each venue request (anti-throttle). Default: 0 (no delay)',
    '  --interval-sec N             Sleep N seconds between each venue request (shorthand). Default: 0',
    '  --include-raw                Persist raw Swimmable JSON payload into raw_response column.',
    '  --dry-run                    Call Swimmable API and print summary, but do NOT write DB rows.',
    '  --verbose, -v                Enable debug-level Nest logging.',
    '  --help, -h                   Show this help',
    '',
    'Examples:',
    '  npm run prefetch:water -- --city beijing --limit 10 --dry-run',
    '  npm run prefetch:water -- --city shanghai --max-venue-retries 5 --progress-every 50',
    '  npm run prefetch:water -- --city la --interval-sec 300          # LA batch: 5min interval between each pool',
    '  npm run prefetch:water -- --city la --limit 5 --dry-run -v      # LA smoke test: first 5 pools dry-run',
    '  npm run prefetch:water -- --dry-run                             # dry-run ALL venues globally',
    '  npm run prefetch:water                                          # full production run (all cities)',
  ];

  console.log(lines.join('\n'));
}

async function run(): Promise<void> {
  const logger = new Logger('PrefetchWaterJob');
  const opts = parseArgs(process.argv);

  const logLevels: Array<'log' | 'warn' | 'error' | 'debug'> = opts.verbose
    ? ['log', 'warn', 'error', 'debug']
    : ['log', 'warn', 'error'];

  const ctx = await NestFactory.createApplicationContext(AppModule, {
    logger: logLevels,
  });
  try {
    const svc = ctx.get(WaterQualityPrefetchService);

    logger.log(
      `Launching WaterQualityPrefetchService.runManual(city=${opts.cityCode ?? 'ALL'}, limit=${opts.limit ?? 'none'}, dryRun=${opts.dryRun}, maxRetries/venue=${opts.maxPerVenueRetries}, maxTotalErrors=${opts.maxTotalErrors === Infinity ? '∞' : opts.maxTotalErrors}, requestIntervalMs=${opts.requestIntervalMs})`,
    );

    const summary = await svc.runManual({
      cityCode: opts.cityCode ?? undefined,
      limit: opts.limit ?? undefined,
      dryRun: opts.dryRun,
      maxPerVenueRateLimitRetries: opts.maxPerVenueRetries,
      maxTotalErrors: opts.maxTotalErrors,
      expiresHours: opts.expiresHours,
      includeRawResponse: opts.includeRaw,
      progressEvery: opts.progressEvery,
      requestIntervalMs: opts.requestIntervalMs,
    });

    console.log('\n=== PrefetchWaterJob Final Summary ===');

    console.log(JSON.stringify(summary, null, 2));

    const anyFatal =
      summary.successWrites === 0 &&
      summary.scannedVenues > 0 &&
      summary.skippedNoCoords < summary.scannedVenues;
    if (anyFatal) {
      logger.error(
        'Zero successful writes despite scanning venues. Check summary above — likely Swimmable API errors or 429 throttling.',
      );
      process.exit(5);
    }
    process.exit(0);
  } finally {
    await ctx.close();
  }
}

run().catch((err) => {
  console.error('PrefetchWaterJob FATAL:', err);
  process.exit(1);
});
