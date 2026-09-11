#!/usr/bin/env node
/* eslint-disable no-unused-vars */
/**
 * Google Places API: Irvine pool ingest (v1, modeled after LA)
 *
 * Usage:
 *   export GOOGLE_PLACES_API_KEY=your_key_here
 *   node google-ingest-irvine-v1.js
 *
 * Output:
 *   /tmp/irvine-google-pools-raw.json   — all Google Place raw results
 *   /tmp/irvine-google-pools-insert.sql — Prisma Venue INSERT SQL
 *
 * Irvine bbox: south=33.60 west=-117.86 north=33.76 east=-117.69
 */

const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
if (!API_KEY) {
  process.stderr.write('[FATAL] GOOGLE_PLACES_API_KEY env var missing\n');
  process.exit(1);
}

const EXPLICIT_PROXY_URL = process.env.HTTPS_PROXY_URL_EXPLICIT || '';
const HTTP_TIMEOUT_MS = 25000;

const BBOX = {
  south: 33.60,
  west: -117.86,
  north: 33.76,
  east: -117.69,
};

const GRID_LAT_STEP = 0.035;
const GRID_LON_STEP = 0.042;
const NEARBY_RADIUS_M = 3500;
const KEYWORDS = ['swimming pool'];
const MAX_PAGES_PER_QUERY = 3;
const NEXT_PAGE_DELAY_MS = 2300;
const DEDUP_GRID_M = 25;
const CITY_CODE = 'irvine';

const RAW_OUT = '/tmp/irvine-google-pools-raw.json';
const SQL_OUT = '/tmp/irvine-google-pools-insert.sql';

function sleep(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

function urlEncodeObj(obj) {
  const parts = [];
  for (const k in obj) {
    if (obj[k] === null || obj[k] === undefined) continue;
    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(obj[k])));
  }
  return parts.join('&');
}

function httpsGetJson(urlStr) {
  var curlBin = process.env.FORCE_CURL_BIN || null;
  if (!curlBin) {
    try {
      if (fs.existsSync('/opt/homebrew/bin/curl')) curlBin = '/opt/homebrew/bin/curl';
      else if (fs.existsSync('/usr/local/bin/curl')) curlBin = '/usr/local/bin/curl';
      else curlBin = 'curl';
    } catch (e) { curlBin = 'curl'; }
  }
  var args = ['-sS', '-G', '--max-time', String(Math.ceil(HTTP_TIMEOUT_MS / 1000)), '-o', '-'];
  if (EXPLICIT_PROXY_URL) args.push('-x', EXPLICIT_PROXY_URL);
  args.push(urlStr);
  var r = spawnSync(curlBin, args, { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 });
  if (r.error) {
    return Promise.reject(new Error('curl bin=' + curlBin + ' spawn err: ' + (r.error && r.error.message || String(r.error))));
  }
  if (r.status !== 0) {
    return Promise.reject(new Error('curl bin=' + curlBin + ' exit=' + r.status + ' stderr=' + String(r.stderr || '').slice(0, 500)));
  }
  var body = String(r.stdout || '');
  try {
    return Promise.resolve({ statusCode: 200, body: JSON.parse(body) });
  } catch (e) {
    return Promise.reject(new Error('curl bin=' + curlBin + ' JSON parse err prefix=' + body.slice(0, 280)));
  }
}

function nearbySearch(location, radius, keyword, pageToken) {
  const qs = { location: location, radius: radius, keyword: keyword, key: API_KEY };
  if (pageToken) qs.pagetoken = pageToken;
  const url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json?' + urlEncodeObj(qs);
  return httpsGetJson(url);
}

function generateGridCenters() {
  const out = [];
  for (var lat = BBOX.south; lat <= BBOX.north; lat += GRID_LAT_STEP) {
    for (var lon = BBOX.west; lon <= BBOX.east; lon += GRID_LON_STEP) {
      out.push({
        lat: +((lat + GRID_LAT_STEP / 2).toFixed(6)),
        lon: +((lon + GRID_LON_STEP / 2).toFixed(6)),
      });
    }
  }
  return out;
}

function sqlEscape(s) {
  var v = String(s == null ? '' : s);
  return v.replace(/\\/g, '\\\\').replace(/'/g, "''");
}

function extractDistrict(formatted) {
  var parts = String(formatted || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var knownCities = ['Irvine','Tustin','Orange','Santa Ana','Costa Mesa','Newport Beach','Lake Forest','Mission Viejo','Aliso Viejo','Laguna Beach','Laguna Hills','Laguna Niguel','Foothill Ranch','Portola Springs','Woodbridge','Northwood','Turtle Rock','University Park','Quail Hill','Shady Canyon','Great Park','Rancho Santa Margarita','Cypress','Anaheim','Buena Park','Fullerton','Yorba Linda','Placentia','Brea','La Habra','Garden Grove','Stanton','Westminster','Fountain Valley','Huntington Beach','Seal Beach','Los Alamitos','Carson','Cerritos','Norwalk','Downey','La Mirada','Whittier','Hacienda Heights','Rowland Heights','Diamond Bar','Walnut','Pomona','Chino Hills','Eastvale','Corona','Riverside','San Juan Capistrano','San Clemente','Dana Point','Ladera Ranch','Coto de Caza','Las Flores','Rancho Mission Viejo'];
  var i;
  for (i = 0; i < parts.length; i++) {
    var p = parts[i];
    var j;
    for (j = 0; j < knownCities.length; j++) {
      if (p.indexOf(knownCities[j]) === 0) {
        if (i > 0) {
          var d = parts[i - 1];
          if (/^\d/.test(d)) {
          } else {
            return d.length > 64 ? d.slice(0, 64) : d;
          }
        }
        return knownCities[j];
      }
    }
  }
  return 'Irvine';
}

function dedupGridKey(lat, lon) {
  var latSteps = Math.round(((+lat) - 33.5) / 0.000225);
  var lonSteps = Math.round(((+lon) + 117.9) / 0.000275);
  return latSteps + ':' + lonSteps;
}

(async function main() {
  console.log('[google-irvine-v1] START');
  var grid = generateGridCenters();
  console.log('[google-irvine-v1] grid cells =', grid.length, ' keywords =', JSON.stringify(KEYWORDS));

  var allByPlaceId = Object.create(null);
  var placeIdCount = 0;
  var reqCount = 0;
  var quotaAbort = false;

  var ci, kw, page, cell, loc, r, st, results, place_id, i, pageToken;
  for (ci = 0; ci < grid.length; ci++) {
    cell = grid[ci];
    if (quotaAbort) break;
    for (kw = 0; kw < KEYWORDS.length; kw++) {
      pageToken = null;
      for (page = 0; page < MAX_PAGES_PER_QUERY; page++) {
        try {
          loc = cell.lat + ',' + cell.lon;
          r = await nearbySearch(loc, NEARBY_RADIUS_M, KEYWORDS[kw], pageToken);
          reqCount++;
          if (r.statusCode !== 200) {
            console.log('  ! HTTP', r.statusCode, 'cell', ci, 'kw', KEYWORDS[kw]);
            break;
          }
          st = r.body.status || 'NO_STATUS';
          if (st === 'OVER_QUERY_LIMIT' || st === 'REQUEST_DENIED') {
            console.log('  !! QUOTA / KEY FAIL status=', st, 'msg=', r.body.error_message || '(none)');
            quotaAbort = true;
            break;
          }
          if (st === 'INVALID_REQUEST') {
            console.log('  ! INVALID_REQUEST. Stop paginating this cell.');
            break;
          }
          results = r.body.results || [];
          if (results.length) {
            for (i = 0; i < results.length; i++) {
              place_id = results[i].place_id;
              if (place_id && !allByPlaceId[place_id]) {
                allByPlaceId[place_id] = results[i];
                placeIdCount++;
              }
            }
          }
          console.log('cell', (ci + 1) + '/' + grid.length, 'kw=' + KEYWORDS[kw], 'page=' + page, 'Google results=' + results.length, 'unique_placeid=' + placeIdCount);
          pageToken = r.body.next_page_token || null;
          if (!pageToken) break;
          await sleep(NEXT_PAGE_DELAY_MS);
        } catch (e) {
          console.log('  ! network err cell=' + ci + ' kw=' + KEYWORDS[kw] + ' page=' + page + ' msg=' + e.message);
          break;
        }
      }
      if (quotaAbort) break;
    }
  }

  console.log('');
  console.log('[google-irvine-v1] HTTP requests =', reqCount);
  console.log('[google-irvine-v1] unique place_id count =', placeIdCount);

  var rawArr = Object.keys(allByPlaceId).map(function (k) { return allByPlaceId[k]; });
  fs.writeFileSync(RAW_OUT, JSON.stringify(rawArr, null, 2));
  console.log('[google-irvine-v1] raw JSON saved ->', RAW_OUT, 'size=' + (fs.statSync(RAW_OUT).size / 1024).toFixed(1) + 'KB');

  rawArr.sort(function (a, b) {
    var opA = (a.business_status === 'OPERATIONAL') ? 1 : 0;
    var opB = (b.business_status === 'OPERATIONAL') ? 1 : 0;
    if (opA !== opB) return opB - opA;
    var rA = +a.rating || 0;
    var rB = +b.rating || 0;
    if (rB !== rA) return rB - rA;
    var uA = +a.user_ratings_total || 0;
    var uB = +b.user_ratings_total || 0;
    return uB - uA;
  });

  var seenGrid = Object.create(null);
  var deduped = [];
  for (i = 0; i < rawArr.length; i++) {
    var v = rawArr[i];
    var geo = v.geometry || {};
    var lo = geo.location || geo;
    if (!lo || typeof lo.lat !== 'number' || typeof lo.lng !== 'number') continue;
    var lat = +lo.lat;
    var lng = +lo.lng;
    if (lat < BBOX.south - 0.05 || lat > BBOX.north + 0.05 || lng < BBOX.west - 0.05 || lng > BBOX.east + 0.05) continue;
    var gk = dedupGridKey(lat, lng);
    if (seenGrid[gk]) continue;
    seenGrid[gk] = true;
    deduped.push(v);
  }
  console.log('[google-irvine-v1] after 25m dedup =', deduped.length);

  var rows = [];
  var stats = { withRating: 0, withVicinity: 0, withFormatted: 0, withTypes: 0 };
  for (i = 0; i < deduped.length; i++) {
    v = deduped[i];
    lo = (v.geometry || {}).location || {};
    if (typeof lo.lat !== 'number' || typeof lo.lng !== 'number') continue;
    var latV = +lo.lat;
    var lngV = +lo.lng;
    var nameRaw = String(v.name || 'Swimming Pool').trim();
    if (!nameRaw) nameRaw = 'Swimming Pool';
    var name128 = nameRaw.length > 128 ? nameRaw.slice(0, 125) + '...' : nameRaw;
    var vicinity = String(v.vicinity || '').trim();
    var fmtAddr = String(v.formatted_address || '').trim();
    var addrFull = fmtAddr.length > vicinity.length ? fmtAddr : (vicinity || fmtAddr || nameRaw);
    if (addrFull.length > 255) addrFull = addrFull.slice(0, 254);
    var district64 = extractDistrict(addrFull || fmtAddr || vicinity || nameRaw);
    if (!district64) district64 = 'Irvine';
    if (district64.length > 64) district64 = district64.slice(0, 64);
    var rating = +v.rating || 0;
    var reviews = +v.user_ratings_total || 0;
    var typesArr = Array.isArray(v.types) ? v.types.slice(0, 4) : [];
    var summary = null;
    if (rating || reviews || typesArr.length) {
      var parts2 = [];
      if (rating > 0) parts2.push('Rating ' + rating.toFixed(1) + '/5');
      if (reviews > 0) parts2.push(reviews + ' reviews');
      if (typesArr.length) parts2.push(typesArr.join(', '));
      summary = parts2.join(' · ');
      if (summary.length > 255) summary = summary.slice(0, 255);
    }
    if (rating > 0) stats.withRating++;
    if (vicinity) stats.withVicinity++;
    if (fmtAddr) stats.withFormatted++;
    if (typesArr.length) stats.withTypes++;
    var nameSQL = "'" + sqlEscape(name128) + "'";
    var distSQL = "'" + sqlEscape(district64) + "'";
    var addrSQL = "'" + sqlEscape(addrFull) + "'";
    var summSQL = summary == null ? 'NULL' : ("'" + sqlEscape(String(summary).slice(0, 255)) + "'");
    var imgCapSQL = 'NULL';
    var line =
      '(gen_random_uuid(), (SELECT id FROM cities WHERE code=\'' + CITY_CODE + '\' LIMIT 1), ' +
      nameSQL + ', ' +
      distSQL + ', ' +
      addrSQL + ', ' +
      (+latV).toFixed(7) + ', ' +
      (+lngV).toFixed(7) + ', NULL, NULL, ' +
      summSQL + ', ' +
      imgCapSQL + ", 'normal', 0, 0, NULL, 'GOOGLE_PLACES'::\"VenueDataSource\", NOW(), NOW(), NOW())";
    rows.push(line);
  }

  console.log('');
  console.log('[google-irvine-v1] SQL rows =', rows.length);
  console.log('[google-irvine-v1] stats =', JSON.stringify(stats));

  var header = '-- Irvine Google Places API ingest v1\n' +
    '-- rows = ' + rows.length + '\n' +
    '-- generated = ' + new Date().toISOString() + '\n' +
    '-- grid cells = ' + grid.length + ' keywords = ' + JSON.stringify(KEYWORDS) + '\n' +
    '-- HTTP requests = ' + reqCount + '\n' +
    '-- dedup 25m grid: true' + '\n' +
    '-- source = GOOGLE_PLACES\n\n' +
    'INSERT INTO venues (\n' +
    '  id, city_id, name, district, address, latitude, longitude,\n' +
    '  snapped_latitude, snapped_longitude, summary, image_caption,\n' +
    '  status, followers_count, ranking_momentum, opened_at,\n' +
    '  data_source, last_ingested_at, created_at, updated_at\n' +
    ') VALUES\n' +
    rows.join(',\n  ') + '\n' +
    'ON CONFLICT DO NOTHING;\n';

  fs.writeFileSync(SQL_OUT, header);
  var szKb = (fs.statSync(SQL_OUT).size / 1024).toFixed(1);
  console.log('[google-irvine-v1] SQL written -> ' + SQL_OUT + '  size=' + szKb + 'KB');
  console.log('');
  console.log('[google-irvine-v1] DONE. Next:');
  console.log('  1. Ensure cities table has irvine row. ECS SQL:');
  console.log("     INSERT INTO cities (id, code, name, status, sort_order, created_at, updated_at) VALUES (gen_random_uuid(), 'irvine', '尔湾', 'enabled', 1, NOW(), NOW()) ON CONFLICT (code) DO NOTHING;");
  console.log('  2. Transfer SQL to ECS');
  console.log('  3. ECS: docker exec -i swimservice-postgres psql -U swim -d swim_service < /tmp/irvine-google-pools-insert.sql');
  console.log('  4. ECS: cd /root/SwimService && docker compose -f docker-compose.cloud.yml up -d --force-recreate swimservice');
  console.log('  5. iOS: verify city picker shows 尔湾 and markers render.');
})().catch(function (e) {
  console.error('[FATAL top-level]', e && e.stack ? e.stack : e);
  process.exit(3);
});
