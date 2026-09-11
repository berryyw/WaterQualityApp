#!/usr/bin/env node
/**
 * Patch Irvine venue_external_ids with Google Places place_id.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node patch-irvine-placeids.js
 *   node patch-irvine-placeids.js --venues-json /tmp/irvine-venues.json
 *
 * ECS export:
 *   docker exec swimservice-postgres psql -U swim -d swim_service \
 *     -c "COPY (
 *       SELECT json_agg(json_build_object('id',v.id,'name',v.name,'district',v.district,'address',v.address))
 *       FROM venues v JOIN cities c ON c.id=v.city_id
 *       WHERE c.code='irvine' AND v.data_source='GOOGLE_PLACES'::\"VenueDataSource\"
 *     ) TO STDOUT;" > /tmp/irvine-venues.json
 *
 * Output SQL file: /tmp/irvine-venue-externalids-insert.sql
 */

const fs = require('fs');
const path = require('path');

const RAW_IN = process.env.RAW_JSON_PATH || '/tmp/irvine-google-pools-raw.json';
const SQL_OUT = '/tmp/irvine-venue-externalids-insert.sql';
const VENUES_JSON_FLAG = process.argv.indexOf('--venues-json');
const VENUES_JSON =
  VENUES_JSON_FLAG >= 0 && process.argv[VENUES_JSON_FLAG + 1]
    ? process.argv[VENUES_JSON_FLAG + 1]
    : '';

const NAME_MAX = 128;

function sqlEscape(s) {
  const v = String(s == null ? '' : s);
  return v.replace(/\\/g, '\\\\').replace(/'/g, "''");
}

function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[’'"`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stripAtSuffix(name) {
  const n = String(name || '').trim();
  const idx = n.toLowerCase().indexOf(' at ');
  if (idx > 0) return n.slice(0, idx).trim();
  return n;
}

function tokenize(s) {
  return normalizeName(s).split(/\s+/).filter((t) => t.length >= 3);
}

function overlapScore(aTokens, bTokens) {
  if (!aTokens.length || !bTokens.length) return 0;
  const setA = new Set(aTokens);
  let hit = 0;
  for (const t of bTokens) if (setA.has(t)) hit++;
  return (2 * hit) / (aTokens.length + bTokens.length);
}

function stripCommonSuffix(s) {
  return String(s || '')
    .replace(/,?\s*(irvine|ca)?[\s,]*\d{5}?$/i, '')
    .trim();
}

(async function main() {
  if (!fs.existsSync(RAW_IN)) {
    process.stderr.write(
      `[FATAL] Raw Google JSON not found at ${RAW_IN}. Re-run: GOOGLE_PLACES_API_KEY=... node google-ingest-irvine-v1.js\n`,
    );
    process.exit(2);
  }
  const rawArr = JSON.parse(fs.readFileSync(RAW_IN, 'utf8'));
  console.log(`[placeid-patch] Google raw entries = ${rawArr.length}`);

  let venues = [];
  const databaseUrl = process.env.DATABASE_URL || '';

  if (VENUES_JSON && fs.existsSync(VENUES_JSON)) {
    venues = JSON.parse(fs.readFileSync(VENUES_JSON, 'utf8'));
    console.log(`[placeid-patch] venues loaded from file: ${VENUES_JSON} -> ${venues.length}`);
  } else if (databaseUrl) {
    const { Pool } = requirePg();
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const q = `
        SELECT v.id, v.name, v.district, v.address
        FROM venues v
        JOIN cities c ON c.id = v.city_id
        WHERE LOWER(c.code) = 'irvine'
          AND v.data_source = 'GOOGLE_PLACES'::"VenueDataSource"
      `;
      const res = await pool.query(q);
      venues = res.rows;
      console.log(`[placeid-patch] venues loaded from DB -> ${venues.length}`);
    } finally {
      await pool.end();
    }
  } else {
    console.error('');
    console.error('[placeid-patch] !! No venues source provided.');
    console.error('   Option A: set DATABASE_URL and re-run.');
    console.error('   Option B: on ECS dump:');
    console.error(`
docker exec swimservice-postgres psql -U swim -d swim_service -c "
COPY (
  SELECT json_agg(json_build_object('id',v.id,'name',v.name,'district',v.district,'address',v.address))
  FROM venues v JOIN cities c ON c.id=v.city_id
  WHERE c.code='irvine' AND v.data_source='GOOGLE_PLACES'::\"VenueDataSource\"
) TO STDOUT;" > /tmp/irvine-venues.json

# then local:
node patch-irvine-placeids.js --venues-json /tmp/irvine-venues.json
`);
    process.exit(1);
  }

  if (!Array.isArray(venues) || venues.length === 0) {
    process.stderr.write('[FATAL] venues array is empty. Is GOOGLE_PLACES data imported?\n');
    process.exit(3);
  }

  const candidates = rawArr
    .filter((r) => r && r.place_id && r.name)
    .map((r) => ({
      placeId: String(r.place_id),
      rawName: String(r.name || '').trim(),
      vicinity: String(r.vicinity || '').trim(),
      formattedAddress: String(r.formatted_address || '').trim(),
      nameTokens: tokenize(stripAtSuffix(r.name)),
      addrTokens: tokenize(
        [r.vicinity, r.formatted_address].filter(Boolean).join(' '),
      ),
    }));
  console.log(`[placeid-patch] Google candidates with place_id = ${candidates.length}`);

  const rows = [];
  const byNameKey = new Map();
  for (const c of candidates) {
    const key = stripAtSuffix(c.rawName).toLowerCase().slice(0, 64);
    if (!byNameKey.has(key)) byNameKey.set(key, []);
    byNameKey.get(key).push(c);
  }

  let matched = 0;
  let skipped = 0;
  const debug = [];

  for (const v of venues) {
    const vName = String(v.name || '').trim();
    const vBase = stripAtSuffix(vName);
    const vNameTokens = tokenize(vBase);
    const vAddrTokens = tokenize(v.address || '');
    const key = vBase.toLowerCase().slice(0, 64);

    let pool = [];
    if (byNameKey.has(key)) {
      pool = byNameKey.get(key).slice();
    } else {
      pool = candidates;
    }

    let best = null;
    let bestScore = -1;
    for (const c of pool) {
      const nScore = overlapScore(vNameTokens, c.nameTokens);
      const aScore = overlapScore(vAddrTokens, c.addrTokens);
      const score = 0.75 * nScore + 0.25 * aScore;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }

    const NAME_ACCEPT = 0.65;
    const OVERALL_ACCEPT = 0.55;

    const isAcceptable =
      best &&
      bestScore >= OVERALL_ACCEPT &&
      overlapScore(vNameTokens, best.nameTokens) >= NAME_ACCEPT;

    if (!isAcceptable) {
      skipped++;
      debug.push({
        id: v.id,
        name: vName,
        address: v.address,
        bestMatch: best ? best.rawName : null,
        bestScore: Number(bestScore.toFixed(3)),
      });
      continue;
    }

    matched++;
    const externalId = String(best.placeId).slice(0, 255);
    const rawName = String(best.rawName || vName).slice(0, 128);
    const rawAddress = String(
      best.formattedAddress || best.vicinity || v.address || '',
    ).slice(0, 255);

    rows.push(
      `(gen_random_uuid(), '${sqlEscape(v.id)}', 'GOOGLE_PLACES'::"VenueDataSource", '${sqlEscape(
        externalId,
      )}', '${sqlEscape(rawName)}', '${sqlEscape(rawAddress)}', NOW(), NOW())`,
    );
  }

  console.log(`[placeid-patch] Matched = ${matched} / ${venues.length}  (skipped low-confidence = ${skipped})`);

  if (skipped > 0) {
    const debugOut = '/tmp/irvine-placeids-match-debug.json';
    fs.writeFileSync(debugOut, JSON.stringify(debug, null, 2));
    console.log(`[placeid-patch] Low-confidence matches dumped -> ${debugOut}`);
  }

  const header = `-- Irvine venue_external_ids patch: GOOGLE_PLACES place_id
-- matched rows = ${rows.length} / ${venues.length}
-- skipped (low confidence) = ${skipped}
-- generated = ${new Date().toISOString()}
-- source raw = ${RAW_IN}

INSERT INTO venue_external_ids (
  id, venue_id, source, external_id, raw_name, raw_address, created_at, updated_at
) VALUES
  ${rows.join(',\n  ')}
ON CONFLICT (source, external_id) DO NOTHING;
`;

  fs.writeFileSync(SQL_OUT, header);
  const szKb = (fs.statSync(SQL_OUT).size / 1024).toFixed(1);
  console.log(`[placeid-patch] SQL written -> ${SQL_OUT}  size=${szKb}KB`);
  console.log('');
  console.log('[placeid-patch] Next steps on ECS:');
  console.log(`  1) Transfer ${SQL_OUT} to ECS /tmp/irvine-externalids.sql`);
  console.log(`  2) docker exec -i swimservice-postgres psql -U swim -d swim_service < /tmp/irvine-externalids.sql`);
})().catch(function (e) {
  console.error('[FATAL top-level]', e && e.stack ? e.stack : e);
  process.exit(4);
});

function requirePg() {
  try {
    return require('pg');
  } catch (_) {
    try {
      return require(path.join(
        __dirname,
        'node_modules',
        'pg',
      ));
    } catch (__) {
      process.stderr.write(
        '[setup] Installing pg driver into /tmp/node_modules (project package.json untouched)...\n',
      );
      const { spawnSync } = require('child_process');
      const r = spawnSync(
        'npm',
        ['install', '--prefix', '/tmp', '--no-save', '--silent', 'pg@8'],
        { stdio: 'inherit' },
      );
      if (r.status !== 0) {
        process.stderr.write('[FATAL] Failed to npm install pg into /tmp. Install manually then re-run.\n');
        process.exit(5);
      }
      return require('/tmp/node_modules/pg');
    }
  }
}
