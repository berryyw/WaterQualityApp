/**
 * Patch v13 — 解决 Q1(名字全是 LA) + Q3(Marker 太多)
 * 策略：
 *  1. 保留 REAL 型（有 tags.name/operator，之前 DB 统计 78 条）完整保留
 *  2. ADDR/DEF 型没有 addr:street 的 way：按 COARSE GRID (snap 3 decimal places ≈ 100m) 只保留 score 最高的 1 条
 *     → 4439 条 LA-only fallback → 约 800~900 条
 *  3. 留下来的「无 addr 无 name」way，name 不再写 "Swimming Pool at Los Angeles"（重复）
 *     → 改成 "Swimming Pool #<4位 网格坐标 hash>" 或者如果有 suburb/district 尽量用 district
 *  4. 最终总量约 78 + 850 = 928 条（比原来 4544 少 80%）
 *
 * 输入：la-pools-osm.json（本地 Mac OSM 源）
 * 输出：la-pools-patch-v13.sql（atomic DO $$ DELETE+REINSERT）
 */
const fs = require('fs');
const path = require('path');

const INPUT_JSON = process.argv[2] || path.join(__dirname, 'la-pools-osm.json');
const OUTPUT_SQL = process.env.OUT || path.join(__dirname, 'la-pools-patch-v13.sql');
const CITY_CODE = 'la';
if (!fs.existsSync(INPUT_JSON)) { console.error('❌ input not found:', INPUT_JSON); process.exit(2); }

const payload = JSON.parse(fs.readFileSync(INPUT_JSON, 'utf8'));
const elements = Array.isArray(payload.elements) ? payload.elements : [];

function esc(s) { return s == null ? '' : String(s).replace(/'/g, "''"); }
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
function snap(v, decimals=3) {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}
function coord3(lat, lon) { return snap(lat,3)+'|'+snap(lon,3); } // ≈100m grid
function normName(n) {
  if (!n) return '';
  let s = String(n).toLowerCase();
  s = s.replace(/^\s*\d+\s*/, '');
  s = s.replace(/[^a-z0-9]/g, '');
  s = s.replace(/swimming|pool|aquatic|center|centre|natatorium|lap|pools|water|indoor|outdoor|recreational|facility|complex|building|gym|healthclub|wellness|aquatics|swim|the|at|and|of|in|on|for|park|recreation|rec|city|county|regional|community|youth|elementary|high|middle|school|college|university|ymca|la|los|angeles|california|ca|hills|valley|beach|heights|manor|village|town|downtown|west|east|north|south|avenue|ave|street|st|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl|highway|hwy|freeway|fwy|pkwy|parkway|cir|circle/g, '');
  return s.slice(0, 48);
}
const EN_NEGATIVE = ['pool hall', 'billiard', 'wading pool', 'kiddie pool', 'toddler pool', 'baby pool', 'hot tub', 'jacuzzi', 'sauna', 'spa', 'spray ground', 'splash pad', 'splash park', 'fishing', 'fish pond', 'fountain', 'wave pool', 'lazy river', 'plunge pool', 'reflecting pool', 'paddling pool'];
function hardTagReject(tags) {
  if (!tags) return false;
  const sp = String(tags['swimming_pool'] || '').toLowerCase();
  if (['wading','toddler','baby','plunge','reflecting','paddling'].includes(sp)) return true;
  const access = String(tags.access || '').toLowerCase();
  if (access === 'no') return true;
  return false;
}

// ================================================================
// step1: build candidates (≈ 22k ways/nodes)
// ================================================================
const candidates = [];
const seenExt = new Set();
for (const el of elements) {
  if (!el?.id) continue;
  const tags = el.tags || {};
  const tagGood = tags.leisure === 'swimming_pool' || tags.amenity === 'swimming_pool' ||
    tags.sport === 'swimming' ||
    (tags.leisure === 'sports_centre' && tags.sport === 'swimming') ||
    (tags.leisure === 'fitness_centre' && tags.sport === 'swimming');
  if (!tagGood || hardTagReject(tags)) continue;
  let lat, lon;
  if (el.type === 'node' && typeof el.lat==='number' && typeof el.lon==='number') { lat=el.lat; lon=el.lon; }
  else if (el.center && typeof el.center.lat==='number') { lat=el.center.lat; lon=el.center.lon; }
  else if (typeof el.minlat==='number') {
    lat = (el.minlat + (el.maxlat ?? el.minlat)) / 2;
    lon = (el.minlon + (el.maxlon ?? el.minlon)) / 2;
  }
  if (lat==null || !Number.isFinite(lat) || lon==null || !Number.isFinite(lon)) continue;
  if (lat < 33.69 || lat > 34.34 || lon < -118.67 || lon > -118.15) continue;
  const extId = 'osm_'+el.type+'_'+el.id;
  if (seenExt.has(extId)) continue;
  seenExt.add(extId);

  const nameRaw = tags.name || tags['name:en'] || tags.alt_name || null;
  const operator = (tags.operator||'').trim() || null;
  const house = (tags['addr:housenumber']||'').trim();
  const street = (tags['addr:street']||'').trim();
  const cityT = (tags['addr:city'] || tags.city || 'Los Angeles').trim();
  const state = (tags['addr:state'] || 'CA').trim();
  const postcode = (tags['addr:postcode'] || '').trim();
  const line1 = [house, street].filter(Boolean).join(' ').trim();
  const line2 = [cityT, state, postcode].filter(Boolean).join(', ').trim();
  const address = [line1, line2].filter(Boolean).join(', ').trim() || (tags.address || '');
  const district = (tags.suburb || tags.neighbourhood || tags['city_district'] || cityT || 'Los Angeles').slice(0, 64);

  const hasRealName = !!(nameRaw || operator);
  let cls, finalName;
  const nameRawOr = nameRaw || (operator ? operator + ' Swimming Pool' : null);
  if (hasRealName) {
    cls = 'REAL';
    let base = nameRawOr;
    if (line1 && base.length + 4 + line1.length <= 128 &&
        !base.toLowerCase().includes(line1.toLowerCase())) {
      base = base + ' at ' + line1;
    } else if (!line1 && cityT && base.length + 4 + cityT.length <= 128) {
      base = base + ' at ' + cityT;
    }
    finalName = base.slice(0, 128);
  } else if (line1) {
    cls = 'ADDR';
    finalName = ('Swimming Pool at ' + line1).slice(0, 128);
  } else {
    cls = 'NOINFO'; // 没有 name 也没有 line1，用网格 hash 命名（下面 v13 fix）
    // 先用占位符，最终去重后再替换
    finalName = '__NOINFO_PLACEHOLDER__';
  }
  const lower = (finalName || '').toLowerCase();
  let hitNeg = false;
  if (lower) for (const k of EN_NEGATIVE) if (lower.includes(k)) { hitNeg = true; break; }
  if (hitNeg) continue;

  const score =
    (hasRealName ? 1_000_000 : 0) +
    ((operator || line1) ? 500_000 : 0) +
    (el.type === 'relation' ? 15_000 : el.type === 'way' ? 10_000 : 5_000) +
    (tags.wikidata ? 10_000 : 0) +
    (tags.phone ? 1_500 : 0) +
    (address && address.length > 14 ? 1_000 : 0) +
    (tags.image || tags.website ? 500 : 0);

  candidates.push({
    extId, cls, name: finalName, nameNorm: normName(finalName),
    address, district, lat, lon, score,
    cityT, state, postcode,
  });
}
candidates.sort((a,b) => b.score - a.score);
console.log('candidates after tag filter =', candidates.length,
  'REAL=', candidates.filter(r=>r.cls==='REAL').length,
  'ADDR=', candidates.filter(r=>r.cls==='ADDR').length,
  'NOINFO=', candidates.filter(r=>r.cls==='NOINFO').length);

// ================================================================
// step2: name dedup (fine grid 25m + coarse grid 100m nameNorm dedup)
// ================================================================
const fine25 = new Map();
const coarseHashed = new Map();
const picked = [];
for (const c of candidates) {
  const fineK = snap(c.lat,4)+'|'+snap(c.lon,4); // 25m
  const coarseK = coord3(c.lat, c.lon);
  const arrF = fine25.get(fineK) || [];
  let dup = false;
  for (const x of arrF) {
    if (c.nameNorm && x.nameNorm && (c.nameNorm===x.nameNorm || c.nameNorm.includes(x.nameNorm) || x.nameNorm.includes(c.nameNorm))) { dup=true; break; }
  }
  if (dup) continue;
  // coarse 100m nameNorm dedup if not REAL
  if (c.cls !== 'REAL') {
    const setN = coarseHashed.get(coarseK) || new Set();
    if (c.nameNorm && setN.has(c.nameNorm)) continue;
    setN.add(c.nameNorm);
    coarseHashed.set(coarseK, setN);
  }
  arrF.push(c);
  fine25.set(fineK, arrF);
  picked.push(c);
}
console.log('after name/grid dedup =', picked.length);

// ================================================================
// step3: V13 核心减少策略 —— 目标总数 ≈ 900~1000（比 4544 少 80%）
//  A) REAL + ADDR（有 line1） 100% 保留！（用户 Q1 需要真名字 / 真地址）
//  B) NOINFO（没有 name 也没有 line1 的 way）只保留 「值得显示」的：
//     B1. 去除掉 距离任何 REAL/ADDR < 300m 的 NOINFO（已经有高价值池覆盖了，别凑数）
//     B2. 余下按 300m 网格（snap 2 decimal places ≈ 111m lat × 92m lon，3 decimal 是约 100m → 2 decimal 约 1km 太粗；
//         折中：2.5 位 decimal = snap to 0.0025 ≈ 278m lat × 230m lon → 约 300m × 250m 矩形）
//         每个 300m 网格 top score 1 条
//     B3. 全局 NOINFO 最多 850 条（按 score 从高到低）
// ================================================================
const realAddr = [];
const noinfoAll = [];
// snap 300m grid helper
function snap300(v) { return Math.round(v / 0.0025) * 0.0025; }
function grid300(lat, lon) { return snap300(lat)+'|'+snap300(lon); }
for (const r of picked) {
  if (r.cls === 'REAL' || r.cls === 'ADDR') realAddr.push(r);
  else noinfoAll.push(r);
}
console.log('A) REAL+ADDR to keep =', realAddr.length);

// B1: 距离 <300m 过滤
const RA_COORD = realAddr.map(r => new (class{lat=r.lat; lon=r.lon;})());
function hasRANearby(lat, lon, maxMeters=300) {
  const R = 6371000;
  const p1 = lat*Math.PI/180, l1 = lon*Math.PI/180;
  for (const c of RA_COORD) {
    const dlat = (c.lat-lat) * Math.PI/180;
    const dlon = (c.lon-lon) * Math.PI/180;
    const a = Math.sin(dlat/2)**2 + Math.cos(p1) * Math.cos(c.lat*Math.PI/180) * Math.sin(dlon/2)**2;
    const d = 2*R*Math.asin(Math.sqrt(a));
    if (d < maxMeters) return true;
  }
  return false;
}
const b1 = noinfoAll.filter(r => !hasRANearby(r.lat, r.lon, 300));
console.log('B1) NOINFO after RA<300m filter =', noinfoAll.length, '→', b1.length);

// B2: 300m grid top-1
const gridBucket = new Map();
for (const r of b1) {
  const g = grid300(r.lat, r.lon);
  const arr = gridBucket.get(g) || [];
  arr.push(r);
  gridBucket.set(g, arr);
}
const b2 = [];
for (const [, arr] of gridBucket.entries()) {
  arr.sort((a,b) => b.score - a.score);
  b2.push(arr[0]);
}
b2.sort((a,b) => b.score - a.score);
console.log('B2) NOINFO after 300m grid top-1 =', b2.length);

// B3: 全局 NOINFO cap 850 条
const NOINFO_CAP = 850;
const b3 = b2.slice(0, NOINFO_CAP);
console.log('B3) NOINFO after global cap('+NOINFO_CAP+') =', b3.length);

// ================================================================
// step4: 给 NOINFO 最终命名（不再是 "Swimming Pool at Los Angeles" 重复！）
// 命名策略：按 district（OSM tags.suburb 如果有）+ 网格短哈希，例如
//   "Swimming Pool #Hollywood-A1B2" / "Swimming Pool #SantaMonica-C3" / "Swimming Pool #LosAngeles-F9"
// ================================================================
function slug(s) {
  return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0, 10) || 'la';
}
function gridHash(lat, lon, len=3) {
  // 短 hash：abs(lat+lon) * 1000 取整 mod (36^len) → base36
  const n = Math.floor((Math.abs(snap(lat,3)) + Math.abs(snap(lon,3))) * 10000) % Math.pow(36, len);
  return n.toString(36).toUpperCase().padStart(len,'0');
}
const finalRows = [];
for (const r of realAddr) finalRows.push(r);
for (const r of b3) {
  const s = slug(r.district || r.cityT);
  const h = gridHash(r.lat, r.lon, 3);
  r.name = ('Swimming Pool #' + s.charAt(0).toUpperCase() + s.slice(1) + '-' + h).slice(0, 64);
  // address: district + city,state  （不再写裸 "Los Angeles, CA"，加 district 让用户能区分）
  r.address = [r.district, [r.cityT||'Los Angeles', r.state||'CA', r.postcode].filter(Boolean).join(', ')].filter(Boolean).join(', ').trim();
  finalRows.push(r);
}
finalRows.sort((a,b) => b.score - a.score);
console.log('✅ FINAL ROWS =', finalRows.length,
  'REAL=', finalRows.filter(r=>r.cls==='REAL').length,
  'ADDR=', finalRows.filter(r=>r.cls==='ADDR').length,
  'NOINFO(renamed)=', finalRows.filter(r=>r.cls==='NOINFO').length);

// ================================================================
// step5: SQL atomic DELETE+REINSERT
// ================================================================
const out = [];
out.push('-- LA OSM venues patch v13: REAL保留 + NOINFO 100m网格top-1 + 重命名（避免全部Los Angeles）');
out.push('-- rows = '+finalRows.length+' (REAL='+finalRows.filter(r=>r.cls==='REAL').length+
  ', ADDR='+finalRows.filter(r=>r.cls==='ADDR').length+
  ', NOINFO renamed='+finalRows.filter(r=>r.cls==='NOINFO').length+')');
out.push('-- generated = '+new Date().toISOString());
out.push('');
out.push('DO $$');
out.push('DECLARE v_city_id UUID; v_before INT; v_after INT;');
out.push('BEGIN');
out.push('  SELECT id INTO v_city_id FROM cities WHERE code = \'' + CITY_CODE + '\' LIMIT 1;');
out.push('  IF v_city_id IS NULL THEN RAISE EXCEPTION \'cities.la not found\'; END IF;');
out.push('  SELECT COUNT(*) INTO v_before FROM venues WHERE city_id = v_city_id AND data_source = \'OSM_OVERPASS\';');
out.push('  DELETE FROM venues WHERE city_id = v_city_id AND data_source = \'OSM_OVERPASS\';');
out.push('');
for (let i = 0; i < finalRows.length; i++) {
  const r = finalRows[i];
  const sLat = 'ROUND((' + r.lat + '*400)::numeric,0)/400';
  const sLon = 'ROUND((' + r.lon + '*400)::numeric,0)/400';
  const cols = [
    "'"+uuidv4()+"'",
    'v_city_id',
    "'"+esc(r.name)+"'",
    "'"+esc(r.district || 'Los Angeles')+"'",
    "'"+esc(r.address || 'Los Angeles, CA')+"'",
    String(r.lat), String(r.lon),
    sLat, sLon,
    "'normal'",
    '0','0',
    '\'OSM_OVERPASS\'::"VenueDataSource"',
    'NOW()','NOW()','NOW()',
  ].join(',');
  out.push('  -- #'+(i+1)+' ['+r.cls+'] '+r.name);
  out.push('  INSERT INTO venues(id,city_id,name,district,address,latitude,longitude,snapped_latitude,snapped_longitude,status,followers_count,ranking_momentum,data_source,last_ingested_at,created_at,updated_at) VALUES (' + cols + ') ON CONFLICT DO NOTHING;');
}
out.push('');
out.push('  SELECT COUNT(*) INTO v_after FROM venues WHERE city_id = v_city_id AND data_source = \'OSM_OVERPASS\';');
out.push('  RAISE NOTICE \'[v13] before=% after=% (REAL=% ADDR=% NOINFO=%)\', v_before, v_after, '+
  finalRows.filter(r=>r.cls==='REAL').length+', '+
  finalRows.filter(r=>r.cls==='ADDR').length+', '+
  finalRows.filter(r=>r.cls==='NOINFO').length+';');
out.push('END $$;');
fs.writeFileSync(OUTPUT_SQL, out.join('\n'), 'utf8');
console.log('✅ SQL written =', OUTPUT_SQL, 'size='+(fs.statSync(OUTPUT_SQL).size/1024).toFixed(1)+'KB');
