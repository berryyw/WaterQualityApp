/**
 * 就地修复 LA OSM_OVERPASS 行的 venues.name 列（不改变其他列 / 北京上海等其他城市 / COUNT）：
 *  - REAL 型：保留 name（如有 operator 且 name 很短则追加 "at <street>"）
 *  - ADDR 型：name = "Swimming Pool at <addr:street + housenumber>"（截断到 128），没有 street = "Swimming Pool at Los Angeles"
 *  - DEF  型：name = "Unnamed Swimming Pool"
 *
 * 用法：
 *   node patch-la-venue-names.js <dump-json>
 *   （dump-json 是从 ECS 拉的 SELECT id,name,address,district FROM venues WHERE city_id=(SELECT id FROM cities WHERE code='la') AND data_source='OSM_OVERPASS' 的 JSON 数组）
 * 或直接从 OSM 源 JSON 重算，不需要 DB dump（推荐，更快）：
 *   node patch-la-venue-names.js use-osm la-pools-osm.json
 *
 * 输出：SQL patch 文件 la-pools-fix-names.sql（一系列 UPDATE ... WHERE id='...'; ，可通过管道 psql 应用）
 */
const fs = require('fs');
const path = require('path');

const OUTPUT_SQL = process.env.OUT || path.join(__dirname, 'la-pools-fix-names.sql');
const CITY_CODE = 'la';
const CITY_ID_SQL  = "(SELECT id FROM cities WHERE code='la' LIMIT 1)";

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/'/g, "''");
}
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ================================================================
// 方案 A：直接从 la-pools-osm.json 重新算（和 generator v12 逻辑一样，但是 name 规则重写）
// ================================================================
function runFromOSM(inputJSON) {
  const raw = fs.readFileSync(inputJSON, 'utf8');
  const payload = JSON.parse(raw);
  const elements = Array.isArray(payload.elements) ? payload.elements : [];

  // 和 v12 完全一致：lat/lon 解析 → coordKeyFine(25m) + score 排序 + 细 25m 1 条最高分 保留逻辑
  function snap(v) { return Math.round(v * 400) / 400; }
  function snapCoarse(v) { return Math.round(v * 10) / 10; }
  function coordKeyFine(lat, lon) { return snap(lat) + '|' + snap(lon); }
  function coordKeyCoarse(lat, lon) { return snapCoarse(lat) + '|' + snapCoarse(lon); }

  const MAX_PER_COORD_REAL = 200, MAX_PER_COORD_ADDR = 5000, MAX_PER_COORD_DEF = 20;
  const UNNAMED_RATIO = 0.30;
  const REJECT_ACCESS = new Set(['no']);
  const EN_NEGATIVE = ['pool hall', 'billiard', 'billiards', 'wading pool', 'kiddie pool', 'toddler pool', 'baby pool', 'hot tub', 'jacuzzi', 'sauna', 'spa', 'hot spring', 'spray ground', 'splash pad', 'splash park', 'fishing', 'fish pond', 'fountain', 'wave pool', 'lazy river', 'plunge pool', 'reflecting pool', 'paddling pool'];
  function hardTagReject(tags) {
    if (!tags) return false;
    if (tags.leisure === 'water_park' || tags.leisure === 'marina') return true;
    const sp = String(tags['swimming_pool'] || '').toLowerCase();
    if (['wading', 'toddler', 'baby', 'plunge', 'reflecting', 'paddling'].includes(sp)) return true;
    const access = String(tags.access || '').toLowerCase();
    if (REJECT_ACCESS.has(access)) return true;
    return false;
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

  const candidates = [];
  const seenExtIds = new Set();
  for (const el of elements) {
    if (!el || !el.id) continue;
    const tags = el.tags || {};
    const tagGood =
      tags.leisure === 'swimming_pool' ||
      tags.amenity === 'swimming_pool' ||
      tags.sport === 'swimming' ||
      (tags.leisure === 'sports_centre' && tags.sport === 'swimming') ||
      (tags.leisure === 'fitness_centre' && tags.sport === 'swimming');
    if (!tagGood) continue;
    if (hardTagReject(tags)) continue;

    let lat, lon;
    if (el.type === 'node' && typeof el.lat === 'number' && typeof el.lon === 'number') { lat = el.lat; lon = el.lon; }
    else if (el.center && typeof el.center.lat === 'number' && typeof el.center.lon === 'number') { lat = el.center.lat; lon = el.center.lon; }
    else if (typeof el.minlat === 'number' && typeof el.minlon === 'number') {
      const maxlat = typeof el.maxlat === 'number' ? el.maxlat : el.minlat;
      const maxlon = typeof el.maxlon === 'number' ? el.maxlon : el.minlon;
      lat = (el.minlat + maxlat) / 2; lon = (el.minlon + maxlon) / 2;
    }
    if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < 33.69 || lat > 34.34 || lon < -118.67 || lon > -118.15) continue;

    const extId = 'osm_' + el.type + '_' + el.id;
    if (seenExtIds.has(extId)) continue;
    seenExtIds.add(extId);

    const nameRaw  = tags.name || tags['name:en'] || tags.alt_name || null;
    const operator = (tags.operator || '').trim() || null;
    const hasAddrStreet = !!((tags['addr:street'] || '').trim());
    const hasRealName = !!(nameRaw || operator);

    const nameRawOr = (nameRaw || (operator ? operator + ' Swimming Pool' : null));
    // =============== 【新规则 v12.1 —— name / address 分离！】 ===============
    // line1: <housenumber> <street>（不含 city/state/zip），这是用户关心的街道级别地址部分
    const house  = (tags['addr:housenumber'] || '').trim();
    const street = (tags['addr:street'] || '').trim();
    const cityT  = (tags['addr:city'] || tags.city || 'Los Angeles').trim();
    const state  = (tags['addr:state'] || 'CA').trim();
    const postcode = (tags['addr:postcode'] || '').trim();
    const line1  = [house, street].filter(Boolean).join(' ').trim();
    const line2  = [cityT, state, postcode].filter(Boolean).join(', ').trim();
    const address = [line1, line2].filter(Boolean).join(', ').trim() || (tags.address || '');
    const district = (tags.suburb || tags.neighbourhood || tags['city_district'] || 'Los Angeles').slice(0, 64);

    // 最终 name（显示给用户）：
    //  - REAL 型：保留 nameRawOr，如果 nameRawOr 很短且 line1 存在，追加 " at <line1>" 到 128 字符内
    //  - ADDR 型（没 name/operator，但有 line1）："Swimming Pool at <line1>"
    //  - ADDR 型（只有 city/state）  ："Swimming Pool at <city>"
    //  - DEF 型："Unnamed Swimming Pool"
    let cls, finalName;
    if (hasRealName) {
      cls = 'REAL';
      let base = nameRawOr;
      if (line1 && base.length + 4 + line1.length <= 128 && !base.toLowerCase().includes(line1.toLowerCase())) {
        base = base + ' at ' + line1;
      } else if (!line1 && cityT && base.length + 4 + cityT.length <= 128) {
        base = base + ' at ' + cityT;
      }
      finalName = base.slice(0, 128);
    } else if (line1) {
      cls = 'ADDR';
      finalName = ('Swimming Pool at ' + line1).slice(0, 128);
    } else if (cityT) {
      cls = 'ADDR';
      finalName = ('Swimming Pool at ' + cityT).slice(0, 128);
    } else {
      cls = 'DEF';
      finalName = 'Unnamed Swimming Pool';
    }

    const lower = (finalName || '').toLowerCase();
    let hitNeg = false;
    if (lower) for (const k of EN_NEGATIVE) if (lower.includes(k)) { hitNeg = true; break; }
    if (hitNeg) continue;

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

  // ===================== 应用 v12 的去重 =====================
  const fineBucket = new Map();
  const coarseBucket = new Map();
  const coarseNamedNN = new Map();
  const picked = [];
  for (const c of candidates) {
    const fineKey = coordKeyFine(c.lat, c.lon);
    const coarseKey = coordKeyCoarse(c.lat, c.lon);
    if (!coarseBucket.has(coarseKey)) coarseBucket.set(coarseKey, { REAL: 0, ADDR: 0, DEF: 0 });
    if (!fineBucket.has(fineKey)) fineBucket.set(fineKey, []);
    const coarse = coarseBucket.get(coarseKey);
    const clsLimit = c.cls === 'REAL' ? MAX_PER_COORD_REAL : (c.cls === 'ADDR' ? MAX_PER_COORD_ADDR : MAX_PER_COORD_DEF);
    if (coarse[c.cls] >= clsLimit) continue;
    let dup = false;
    const nArr = fineBucket.get(fineKey);
    for (const x of nArr) {
      const a = c.nameNorm, b = x.nameNorm;
      if (a && b && (a === b || a.includes(b) || b.includes(a))) { dup = true; break; }
    }
    if (dup) continue;
    if (c.cls !== 'DEF') {
      const s = coarseNamedNN.get(coarseKey) || new Set();
      if (c.nameNorm && s.has(c.nameNorm)) continue;
      s.add(c.nameNorm);
      coarseNamedNN.set(coarseKey, s);
    }
    fineBucket.get(fineKey).push(c);
    coarse[c.cls]++;
    coarseBucket.set(coarseKey, coarse);
    picked.push(c);
  }
  const haveNamed = picked.filter(r => r.cls !== 'DEF').length;
  const wantDef = Math.max(0, Math.floor(haveNamed * UNNAMED_RATIO / (1 - UNNAMED_RATIO)));
  const stats3 = { defAdded: 0, defSkip: 0 };
  for (const c of candidates) {
    if (stats3.defAdded >= wantDef) break;
    if (c.cls !== 'DEF') continue;
    const coarseKey = coordKeyCoarse(c.lat, c.lon);
    const coarse = coarseBucket.get(coarseKey) || { REAL: 0, ADDR: 0, DEF: 0 };
    if (coarse.DEF >= MAX_PER_COORD_DEF) { stats3.defSkip++; continue; }
    const fineKey = coordKeyFine(c.lat, c.lon);
    const fine = fineBucket.get(fineKey) || [];
    let dup = false;
    for (const x of fine) {
      const a = c.nameNorm, b = x.nameNorm;
      if (a && b && (a === b || a.includes(b) || b.includes(a))) { dup = true; break; }
    }
    if (dup) { stats3.defSkip++; continue; }
    fine.push(c);
    fineBucket.set(fineKey, fine);
    coarse.DEF++;
    coarseBucket.set(coarseKey, coarse);
    picked.push(c);
    stats3.defAdded++;
  }

  // post-process：25m 1 条
  const postBucket = new Map();
  for (const r of picked) {
    const k = coordKeyFine(r.lat, r.lon);
    const arr = postBucket.get(k) || [];
    arr.push(r);
    postBucket.set(k, arr);
  }
  const rowsInit = [];
  for (const [, arr] of postBucket.entries()) {
    arr.sort((a, b) => b.score - a.score);
    rowsInit.push(arr[0]);
  }
  rowsInit.sort((a, b) => b.score - a.score);

  console.log('✅ [patch] pick rows=' + rowsInit.length + '（REAL=' + rowsInit.filter(r=>r.cls==='REAL').length + ', ADDR=' + rowsInit.filter(r=>r.cls==='ADDR').length + ', DEF=' + rowsInit.filter(r=>r.cls==='DEF').length + '）');

  // ===================== 生成 UPDATE SQL =====================
  // 因为 OSM ext_id 不在 DB 里（我们之前没用 external_ids 列），所以只能用 (lat, lon) + name prefix 匹配？
  // 更稳妥的办法：不要 UPDATE！直接 DELETE + 重新 INSERT，保证 1:1 对应。用 DO $$ 原子块。
  const out = [];
  out.push('-- LA OSM venues name/address fix (atomic DELETE+REINSERT, v12.1)');
  out.push('-- generated: ' + new Date().toISOString());
  out.push('-- affected rows BEFORE DELETE will be = (SELECT COUNT(*) FROM venues WHERE city_id=' + CITY_ID_SQL + " AND data_source='OSM_OVERPASS')");
  out.push('');
  out.push('DO $$');
  out.push('DECLARE v_city_id UUID; v_before INT; v_after INT;');
  out.push('BEGIN');
  out.push('  SELECT id INTO v_city_id FROM cities WHERE code = \'' + CITY_CODE + '\' LIMIT 1;');
  out.push('  IF v_city_id IS NULL THEN RAISE EXCEPTION \'cities.la not found\'; END IF;');
  out.push('  SELECT COUNT(*) INTO v_before FROM venues WHERE city_id = v_city_id AND data_source = \'OSM_OVERPASS\';');
  out.push('  -- atomic: delete all old OSM_OVERPASS for la then re-insert with new name rules');
  out.push('  DELETE FROM venues WHERE city_id = v_city_id AND data_source = \'OSM_OVERPASS\';');
  out.push('');
  for (let i = 0; i < rowsInit.length; i++) {
    const r = rowsInit[i];
    const sLat = 'ROUND((' + r.lat + '*400)::numeric,0)/400';
    const sLon = 'ROUND((' + r.lon + '*400)::numeric,0)/400';
    const cols = [
      "'" + uuidv4() + "'",
      'v_city_id',
      "'" + esc(r.name) + "'",
      "'" + esc(r.district || 'Los Angeles') + "'",
      "'" + esc(r.address || '') + "'",
      String(r.lat),
      String(r.lon),
      sLat, sLon,
      "'normal'",
      '0', '0',
      '\'OSM_OVERPASS\'::"VenueDataSource"',
      'NOW()', 'NOW()', 'NOW()',
    ].join(',');
    out.push('  -- #' + (i+1) + ' [' + r.cls + '] ' + r.name);
    out.push('  INSERT INTO venues(id,city_id,name,district,address,latitude,longitude,snapped_latitude,snapped_longitude,status,followers_count,ranking_momentum,data_source,last_ingested_at,created_at,updated_at) VALUES (' + cols + ') ON CONFLICT DO NOTHING;');
  }
  out.push('');
  out.push('  SELECT COUNT(*) INTO v_after FROM venues WHERE city_id = v_city_id AND data_source = \'OSM_OVERPASS\';');
  out.push('  RAISE NOTICE \'[patch la OSM names] before=% after=%\', v_before, v_after;');
  out.push('END $$;');

  fs.writeFileSync(OUTPUT_SQL, out.join('\n'), 'utf8');
  console.log('✅ patch SQL written =', OUTPUT_SQL, 'size =', (fs.statSync(OUTPUT_SQL).size/1024).toFixed(1), 'KB');
  console.log('');
  console.log('下一步：将此 SQL 传到 ECS 并 psql 执行：');
  console.log('  scp ' + OUTPUT_SQL + ' root@47.253.51.32:/tmp/la-pools-fix-names.sql');
  console.log('  ssh root@47.253.51.32 "docker exec -i swimservice-postgres psql -U swim -d swim_service < /tmp/la-pools-fix-names.sql"');
}

// ===================== main =====================
if (process.argv[2] === 'use-osm') {
  const json = process.argv[3] || path.join(__dirname, 'la-pools-osm.json');
  if (!fs.existsSync(json)) {
    console.error('❌ OSM JSON not found:', json);
    process.exit(2);
  }
  runFromOSM(json);
} else {
  console.log('Usage: node patch-la-venue-names.js use-osm <la-pools-osm.json>');
  console.log('  (we only support use-osm mode; dump mode requires ext_ids which we don\'t store)');
  process.exit(1);
}
