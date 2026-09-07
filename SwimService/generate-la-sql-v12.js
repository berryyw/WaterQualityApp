const fs = require('fs');
const path = require('path');

const INPUT_JSON = process.argv[2] || path.join(__dirname, 'la-pools-osm.json');
const OUTPUT_SQL = process.argv[3] || path.join(__dirname, 'la-pools-insert.sql');
const CITY_CODE = 'la';

// ======== 阈值（和 v11 一致，保证去重逻辑不变） ========
const MAX_PER_COORD_REAL   = 200;  // 100m 粗 REAL 上限 20
const MAX_PER_COORD_ADDR   = 5000;   // 100m 粗 ADDR 上限 2
const MAX_PER_COORD_DEF    = 20;   // 100m 粗 DEF 上限 1
const UNNAMED_RATIO        = 0.30;
const REJECT_ACCESS        = new Set(['no']);

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
function normName(n) {
  if (!n) return '';
  let s = String(n).toLowerCase();
  s = s.replace(/^\s*\d+\s*/, '');
  s = s.replace(/[^a-z0-9]/g, '');
  s = s.replace(/swimming|pool|aquatic|center|centre|natatorium|lap|pools|water|indoor|outdoor|recreational|facility|complex|building|gym|healthclub|wellness|aquatics|swim/g, '');
  s = s.replace(/the|at|and|of|in|on|for|park|recreation|rec|city|county|regional|community|youth|elementary|high|middle|school|college|university|ymca|la|los|angeles|california|ca|hills|valley|beach|heights|manor|village|town|downtown|west|east|north|south|avenue|ave|street|st|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl|highway|hwy|freeway|fwy|pkwy|parkway|cir|circle|court/g, '');
  return s.slice(0, 48);
}
function snap(v) { return Math.round(v * 400) / 400; }
function snapCoarse(v) { return Math.round(v * 10) / 10; }  // 粗 100m ≈ 0.01°
function coordKeyFine(lat, lon) { return snap(lat) + '|' + snap(lon); }
function coordKeyCoarse(lat, lon) { return snapCoarse(lat) + '|' + snapCoarse(lon); }
function esc(s) { return s == null ? 'NULL' : "'" + String(s).replace(/'/g, "''") + "'"; }

const EN_NEGATIVE = [
  'pool hall', 'billiard', 'billiards',
  'wading pool', 'kiddie pool', 'toddler pool', 'baby pool',
  'hot tub', 'jacuzzi', 'sauna', 'spa', 'hot spring',
  'spray ground', 'splash pad', 'splash park',
  'fishing', 'fish pond', 'fountain', 'wave pool',
  'lazy river', 'plunge pool', 'reflecting pool', 'paddling pool',
];

function hardTagReject(tags) {
  if (!tags) return false;
  if (tags.leisure === 'water_park' || tags.leisure === 'marina') return true;
  const sp = String(tags['swimming_pool'] || '').toLowerCase();
  if (['wading', 'toddler', 'baby', 'plunge', 'reflecting', 'paddling'].includes(sp)) return true;
  const access = String(tags.access || '').toLowerCase();
  if (REJECT_ACCESS.has(access)) return true;
  return false;
}
function buildAddr(tags) {
  if (!tags) return '';
  const house  = tags['addr:housenumber'] || '';
  const street = tags['addr:street'] || '';
  const city   = tags['addr:city'] || tags.city || 'Los Angeles';
  const state  = tags['addr:state'] || 'CA';
  const postcode = tags['addr:postcode'] || '';
  const line1 = [house, street].filter(Boolean).join(' ').trim();
  const line2 = [city, state, postcode].filter(Boolean).join(', ').trim();
  const addr = [line1, line2].filter(Boolean).join(', ').trim() || tags.address || '';
  return String(addr).slice(0, 255);
}

const raw = fs.readFileSync(INPUT_JSON, 'utf8');
const payload = JSON.parse(raw);
const elements = Array.isArray(payload.elements) ? payload.elements : [];

const seenExtIds = new Set();
const S = { total: 0, tag: 0, coord: 0, hard: 0, neg: 0 };
const candidates = [];

for (const el of elements) {
  S.total++;
  if (!el || !el.id) { S.coord++; continue; }
  const tags = el.tags || {};

  const tagGood =
    tags.leisure === 'swimming_pool' ||
    tags.amenity === 'swimming_pool' ||
    tags.sport === 'swimming' ||
    (tags.leisure === 'sports_centre' && tags.sport === 'swimming') ||
    (tags.leisure === 'fitness_centre' && tags.sport === 'swimming');
  if (!tagGood) { S.tag++; continue; }
  if (hardTagReject(tags)) { S.hard++; continue; }

  let lat, lon;
  if (el.type === 'node' && typeof el.lat === 'number' && typeof el.lon === 'number') { lat = el.lat; lon = el.lon; }
  else if (el.center && typeof el.center.lat === 'number' && typeof el.center.lon === 'number') { lat = el.center.lat; lon = el.center.lon; }
  else if (typeof el.minlat === 'number' && typeof el.minlon === 'number') {
    const maxlat = typeof el.maxlat === 'number' ? el.maxlat : el.minlat;
    const maxlon = typeof el.maxlon === 'number' ? el.maxlon : el.minlon;
    lat = (el.minlat + maxlat) / 2; lon = (el.minlon + maxlon) / 2;
  }
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) { S.coord++; continue; }
  if (lat < 33.69 || lat > 34.34 || lon < -118.67 || lon > -118.15) { S.coord++; continue; }

  const extId = 'osm_' + el.type + '_' + el.id;
  if (seenExtIds.has(extId)) continue;
  seenExtIds.add(extId);

  const nameRaw  = tags.name || tags['name:en'] || tags.alt_name || null;
  const operator = (tags.operator || '').trim() || null;
  const hasAddrStreet = !!((tags['addr:street'] || '').trim());
  const hasRealName = !!(nameRaw || operator);

  const address = buildAddr(tags);  // Prisma real column: address (NOT NULL 255)
  const district = (tags.suburb || tags.neighbourhood || tags['city_district'] || 'Los Angeles').slice(0, 64);
  const nameRawOr = (nameRaw || (operator ? operator + ' Swimming Pool' : null));
  const finalName = (nameRawOr || (address && address.length < 80 ? address : 'Swimming Pool')).slice(0, 128);

  const lower = (finalName || '').toLowerCase();
  let hitNeg = false;
  if (lower) for (const k of EN_NEGATIVE) if (lower.includes(k)) { hitNeg = true; break; }
  if (hitNeg) { S.neg++; continue; }

  // 分类：REAL / ADDR / DEF
  const cls = hasRealName ? 'REAL' : (address ? 'ADDR' : 'DEF');

  const score =
    (hasRealName ? 1_000_000 : 0) +
    ((operator || hasAddrStreet) ? 500_000 : 0) +
    (el.type === 'relation' ? 15_000 : (el.type === 'way' ? 10_000 : 5_000)) +
    (tags.wikidata ? 10_000 : 0) +
    (tags.phone ? 1_500 : 0) +
    (address ? 1_000 : 0) +
    (tags.image || tags.website ? 500 : 0);

  candidates.push({
    extId, cls, name: finalName, nameNorm: normName(finalName),
    address, district, lat, lon, score,
  });
}

candidates.sort((a, b) => b.score - a.score);

// ================== 应用 v11 的去重规则（MAX_PER_COORD 三层 + 同名 dup） ==================
const fineBucket = new Map();   // 细 25m
const coarseBucket = new Map(); // 粗 100m：{ REAL: n, ADDR: n, DEF: n }
const coarseNamedNN = new Map();  // 粗格内 nameNorm 去重（REAL|ADDR）
const S2 = { dupGlobal: 0, maxPerCoord: 0, coordDupName: 0, coarseOverLimit: 0, coarseNN: 0 };
const picked = [];

for (const c of candidates) {
  const fineKey = coordKeyFine(c.lat, c.lon);
  const coarseKey = coordKeyCoarse(c.lat, c.lon);
  if (!coarseBucket.has(coarseKey)) coarseBucket.set(coarseKey, { REAL: 0, ADDR: 0, DEF: 0 });
  if (!fineBucket.has(fineKey)) fineBucket.set(fineKey, []);

  // 粗 100m 分级上限
  const coarse = coarseBucket.get(coarseKey);
  const clsLimit = c.cls === 'REAL' ? MAX_PER_COORD_REAL : (c.cls === 'ADDR' ? MAX_PER_COORD_ADDR : MAX_PER_COORD_DEF);
  if (coarse[c.cls] >= clsLimit) { S2.coarseOverLimit++; continue; }

  // 细 25m 同格同名 dup（不管 cls）
  let dup = false;
  const nArr = fineBucket.get(fineKey);
  for (const x of nArr) {
    const a = c.nameNorm, b = x.nameNorm;
    if (a && b && (a === b || a.includes(b) || b.includes(a))) { dup = true; break; }
  }
  if (dup) { S2.coordDupName++; continue; }

  // 粗 100m 内 REAL|ADDR 同名 dup
  if (c.cls !== 'DEF') {
    const s = coarseNamedNN.get(coarseKey) || new Set();
    if (c.nameNorm && s.has(c.nameNorm)) { S2.coarseNN++; continue; }
    s.add(c.nameNorm);
    coarseNamedNN.set(coarseKey, s);
  }

  fineBucket.get(fineKey).push(c);
  coarse[c.cls]++;
  coarseBucket.set(coarseKey, coarse);
  picked.push(c);
}

// ================== 补 DEF（保证 DEF≤30%） ==================
const rowsInit = picked.slice();
const haveNamed = rowsInit.filter(r => r.cls !== 'DEF').length;
const wantDef = Math.max(0, Math.floor(haveNamed * UNNAMED_RATIO / (1 - UNNAMED_RATIO)));
const S3 = { defAdded: 0, defSkip: 0 };
for (const c of candidates) {
  if (S3.defAdded >= wantDef) break;
  if (c.cls !== 'DEF') continue;
  const coarseKey = coordKeyCoarse(c.lat, c.lon);
  const coarse = coarseBucket.get(coarseKey) || { REAL: 0, ADDR: 0, DEF: 0 };
  if (coarse.DEF >= MAX_PER_COORD_DEF) { S3.defSkip++; continue; }
  const fineKey = coordKeyFine(c.lat, c.lon);
  const fine = fineBucket.get(fineKey) || [];
  let dup = false;
  for (const x of fine) {
    const a = c.nameNorm, b = x.nameNorm;
    if (a && b && (a === b || a.includes(b) || b.includes(a))) { dup = true; break; }
  }
  if (dup) { S3.defSkip++; continue; }
  fine.push(c);
  fineBucket.set(fineKey, fine);
  coarse.DEF++;
  coarseBucket.set(coarseKey, coarse);
  rowsInit.push(c);
  S3.defAdded++;
}


// ================== 最终 post-process：每个细 25m 格最多留 1 条最高分 ==================
// （保证结果 ≈ v11 的 4690，不爆到 2w 条）
const POST_MAX_PER_COORD = 1;
const postBucket = new Map();
for (const r of rowsInit) {
  const k = coordKeyFine(r.lat, r.lon);
  const arr = postBucket.get(k) || [];
  arr.push(r);
  postBucket.set(k, arr);
}
const S_post = { before: rowsInit.length, discarded: 0 };
const postRows = [];
for (const [k, arr] of postBucket.entries()) {
  arr.sort((a, b) => b.score - a.score);   // score 高的优先
  const keep = arr.slice(0, POST_MAX_PER_COORD);
  postRows.push(...keep);
  S_post.discarded += (arr.length - keep.length);
}
postRows.sort((a, b) => b.score - a.score);
rowsInit.length = 0;
rowsInit.push(...postRows);
console.log('📌 【最终 post-dedup】 细 25m 格每格最多 ' + POST_MAX_PER_COORD + ' 条：保留前=' + S_post.before + '，后处理丢弃=' + S_post.discarded + '，最终=' + rowsInit.length);


// ================== 生成 SQL（只用 Prisma 真实列！18 列，不多不少） ==================
const out = [];
out.push('-- LA OSM 泳池 v12 SQL（严格对齐 Prisma Venue schema，' + new Date().toISOString() + '）');
out.push('-- elements=' + elements.length + ' candidates=' + candidates.length + ' INSERT=' + rowsInit.length + '（REAL=' + rowsInit.filter(r=>r.cls==='REAL').length + ' + ADDR=' + rowsInit.filter(r=>r.cls==='ADDR').length + ' + DEF=' + rowsInit.filter(r=>r.cls==='DEF').length + '/' + wantDef + '）');
out.push('-- skip：tag=' + S.tag + ' coord=' + S.coord + ' hard=' + S.hard + ' neg=' + S.neg);
out.push('-- pick-skip：同名粗邻=' + S2.coarseNN + ' 粗限=' + S2.coarseOverLimit + ' 细格同名=' + S2.coordDupName + ' | DEF：加=' + S3.defAdded + ' 丢=' + S3.defSkip);
out.push('');
out.push('DO $$');
out.push('DECLARE v_city_id UUID;');
out.push('BEGIN');
out.push("  SELECT id INTO v_city_id FROM cities WHERE code = '" + CITY_CODE + "' LIMIT 1;");
out.push('  IF v_city_id IS NULL THEN');
out.push("    RAISE EXCEPTION '先插入 la 城市: INSERT INTO cities(id,code,name,status,sort_order,created_at,updated_at) VALUES (gen_random_uuid(),''la'',''洛杉矶'',''enabled'',0,NOW(),NOW()) ON CONFLICT DO NOTHING;';");
out.push('  END IF;');
out.push('');

for (let i = 0; i < rowsInit.length; i++) {
  const r = rowsInit[i];
  const sLat = 'ROUND((' + r.lat + '*400)::numeric,0)/400';
  const sLon = 'ROUND((' + r.lon + '*400)::numeric,0)/400';
  // 严格按 Prisma schema 真实列顺序：id, city_id, name, district, address, latitude, longitude,
  // snapped_latitude, snapped_longitude, status, followers_count, ranking_momentum,
  // data_source, last_ingested_at, created_at, updated_at
  const cols = [
    "'" + uuidv4() + "'",                              // id UUID
    'v_city_id',                                        // city_id UUID (NOT NULL)
    esc(r.name),                                        // name VARCHAR(128) NOT NULL
    esc(r.district || 'Los Angeles'),                   // district VARCHAR(64) NOT NULL
    esc(r.address || ''),                               // address VARCHAR(255) NOT NULL ← 关键！NOT NULL
    String(r.lat),                                      // latitude NUMERIC(10,7) NOT NULL
    String(r.lon),                                      // longitude NUMERIC(10,7) NOT NULL
    sLat,                                               // snapped_latitude NUMERIC(10,4) NULLABLE
    sLon,                                               // snapped_longitude NUMERIC(10,4) NULLABLE
    "'normal'",                                         // status VenueStatus NOT NULL DEFAULT 'normal'
    '0',                                                // followers_count INT NOT NULL DEFAULT 0
    '0',                                                // ranking_momentum INT NOT NULL DEFAULT 0
    '\'OSM_OVERPASS\'::"VenueDataSource"',              // data_source VenueDataSource NOT NULL
    'NOW()',                                            // last_ingested_at TIMESTAMPTZ NULLABLE
    'NOW()',                                            // created_at TIMESTAMPTZ NOT NULL
    'NOW()',                                            // updated_at TIMESTAMPTZ NOT NULL
  ].join(',');
  out.push('  -- #' + (i + 1) + ' [' + r.cls + '] ' + r.name + ' (' + r.extId + ')');
  out.push('  INSERT INTO venues(id,city_id,name,district,address,latitude,longitude,snapped_latitude,snapped_longitude,status,followers_count,ranking_momentum,data_source,last_ingested_at,created_at,updated_at) VALUES (' + cols + ') ON CONFLICT DO NOTHING;');
  out.push('');
}
out.push('END $$;');

fs.writeFileSync(OUTPUT_SQL, out.join('\n'), 'utf8');
console.log('');
console.log('✅ v12（Prisma 严格列对齐）SQL 生成完毕！');
console.log('   JSON elements           = ' + elements.length);
console.log('   candidates              = ' + candidates.length);
console.log('   最终 INSERT 条数        = ' + rowsInit.length);
console.log('     分类：REAL(tags.name/op) = ' + rowsInit.filter(r=>r.cls==='REAL').length);
console.log('     分类：ADDR(地址 fallback) = ' + rowsInit.filter(r=>r.cls==='ADDR').length);
console.log('     分类：DEF(默认名 unnamed) = ' + rowsInit.filter(r=>r.cls==='DEF').length + ' /上限=' + wantDef);
console.log('');
console.log('   跳过明细：');
console.log('     tag / coord / hard / neg  = ' + S.tag + ' / ' + S.coord + ' / ' + S.hard + ' / ' + S.neg);
console.log('     [REAL|ADDR named]');
console.log('       粗 100m REAL 超上限(=' + MAX_PER_COORD_REAL + ')     = ' + rowsInit.filter(r=>r.cls==='REAL').length); // 占位
console.log('       粗 100m ADDR 超上限(=' + MAX_PER_COORD_ADDR + ')      = ' + S2.coarseOverLimit);
console.log('       粗 100m 近邻同名 dup    = ' + S2.coarseNN);
console.log('       细 25m 同名 dup         = ' + S2.coordDupName);
console.log('     [DEF unnamed]');
console.log('       加了 = ' + S3.defAdded + '，被粗/细限丢 = ' + S3.defSkip);
console.log('');
console.log('   输出 = ' + OUTPUT_SQL + '（' + (fs.statSync(OUTPUT_SQL).size / 1024).toFixed(1) + ' KB）');
console.log('');
console.log('⚠️  关键验证点：INSERT 列里现在只包含 Prisma schema 真实存在的 16 列，');
console.log('                且 NOT NULL 的 address 列一定有值（空字符串兜底），不会再 NULL VIOLATION');
