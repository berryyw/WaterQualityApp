const fs = require('fs');
const path = require('path');

const INPUT_JSON = process.argv[2] || path.join(__dirname, 'la-pools-osm.json');
const OUTPUT_SQL = process.argv[3] || path.join(__dirname, 'la-pools-insert.sql');
const CITY_CODE = 'la';

// ====================== v11 阈值（最终） ======================
// 1. 细 coord（25m snapped）：任何类型最多 1 条 per
const MAX_PER_SNAP25     = 1;
// 2. 粗网格（100m × 100m snapped）：限制非真实 tags.name/op 的地址 fallback 默认名
//    - TRUE tags.name/op （优先级最高的真实名称）：每个网格最多 REAL_NAME_PER_GRID 条（=10，别太严）
//    - 地址 fallback 名（有地址但没 tags.name/op）：每个网格最多 ADDR_FALLBACK_PER_GRID 条（=2）
//    - 默认名 "Swimming Pool"：每个网格最多 DEFAULT_PER_GRID 条（=1）
const REAL_NAME_PER_GRID       = 20;   // tags.name/op 基本不会密集到 20 个/100m 格
const ADDR_FALLBACK_PER_GRID   = 2;    // 同一栋公寓/运动中心/高中 2 个泳池合理
const DEFAULT_PER_GRID         = 1;    // 啥名字都没有的默认名 1 条足矣
// unnamed 比例（兜底，最多 30%）
const UNNAMED_RATIO = 0.30;
// =============================================================

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 精细 25m snapped coord key
function snap25(v) { return Math.round(v * 400) / 400; }
function key25(lat, lon) { return snap25(lat) + '|' + snap25(lon); }

// 粗网格 100m snapped key（100m ≈ 0.0009° lat, 0.0011° lon LA 附近）
//   用 ×1000 做整数网格
function grid100(v) { return Math.round(v * 1000); }
function key100(lat, lon) { return grid100(lat) + '|' + grid100(lon); }

function normName(n) {
  if (!n) return '';
  let s = String(n).toLowerCase();
  s = s.replace(/^\s*\d+\s*/, '');                          // 去门牌号前缀
  s = s.replace(/[^a-z0-9,]/g, '');                         // 只保留字母数字逗号
  s = s.split(',').map(p => p.trim()).filter(Boolean).join(',');
  s = s.replace(/swimming|pool|aquatic|center|centre|natatorium|lap|pools|water|indoor|outdoor|recreational|facility|complex|building|gym|healthclub|wellness|aquatics|swim|olympic|competition|warmup|diving|lesson|members|member|club/g, '');
  s = s.replace(/the|at|and|of|in|on|for|park|recreation|rec|city|county|regional|community|youth|elementary|high|middle|school|college|university|ymca|la|los|angeles|california|ca|hills|valley|beach|heights|manor|village|town|downtown|west|east|north|south/g, '');
  s = s.replace(/avenue|ave|street|st|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl|highway|hwy|freeway|fwy|pkwy|parkway|cir|circle|terrace|ter|court|suite|ste|apt|unit|floor|fl/g, '');
  s = s.replace(/[,\s]+/g, '');
  return s.slice(0, 64);
}

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
  if (access === 'no') return true;
  return false;
}

function buildAddr(tags) {
  if (!tags) return null;
  const house  = tags['addr:housenumber'] || '';
  const street = tags['addr:street'] || '';
  const city   = tags['addr:city'] || tags.city || 'Los Angeles';
  const state  = tags['addr:state'] || 'CA';
  const postcode = tags['addr:postcode'] || '';
  const line1 = [house, street].filter(Boolean).join(' ').trim();
  const line2 = [city, state, postcode].filter(Boolean).join(', ').trim();
  return [line1, line2].filter(Boolean).join(', ').trim() || tags.address || null;
}

// --- 读 JSON ---
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
  if (el.type === 'node' && typeof el.lat === 'number' && typeof el.lon === 'number') {
    lat = el.lat; lon = el.lon;
  } else if (el.center && typeof el.center.lat === 'number' && typeof el.center.lon === 'number') {
    lat = el.center.lat; lon = el.center.lon;
  } else if (typeof el.minlat === 'number' && typeof el.minlon === 'number') {
    const maxlat = typeof el.maxlat === 'number' ? el.maxlat : el.minlat;
    const maxlon = typeof el.maxlon === 'number' ? el.maxlon : el.minlon;
    lat = (el.minlat + maxlat) / 2; lon = (el.minlon + maxlon) / 2;
  }
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) { S.coord++; continue; }
  if (lat < 33.69 || lat > 34.34 || lon < -118.67 || lon > -118.15) { S.coord++; continue; }

  const extId = 'osm_' + el.type + '_' + el.id;
  if (seenExtIds.has(extId)) continue;
  seenExtIds.add(extId);

  const nameRaw   = tags.name || tags['name:en'] || tags.alt_name || null;
  const operator  = (tags.operator || '').trim() || null;
  const addressRaw = buildAddr(tags);

  let finalName;
  if (nameRaw) finalName = nameRaw;
  else if (operator) finalName = operator + ' Swimming Pool';
  else if (addressRaw && addressRaw.length < 80) finalName = addressRaw;
  else finalName = 'Swimming Pool';

  // 三档分类（决定粗网格上限）
  //   kind='REAL'  = tags.name || tags.operator （真实来源名称，最可信）
  //   kind='ADDR'  = 地址 fallback（无 tags.name/op，但有地址）
  //   kind='DEF'   = 默认名 "Swimming Pool"
  const kind =
    (nameRaw || operator) ? 'REAL' :
    (finalName !== 'Swimming Pool') ? 'ADDR' : 'DEF';

  const lower = (finalName || '').toLowerCase();
  let hitNeg = false;
  if (lower) for (const k of EN_NEGATIVE) if (lower.includes(k)) { hitNeg = true; break; }
  if (hitNeg) { S.neg++; continue; }

  const district = tags.suburb || tags.neighbourhood || tags['city_district'] || 'Los Angeles';
  const tp = [];
  if (tags.leisure) tp.push('leisure=' + tags.leisure);
  if (tags.sport) tp.push('sport=' + tags.sport);
  if (tags.amenity) tp.push('amenity=' + tags.amenity);
  if (tags['swimming_pool']) tp.push('pool_type=' + tags['swimming_pool']);
  if (tags.access) tp.push('access=' + tags.access);
  const typeHint = tp.length ? tp.join('; ') : null;

  const tel    = tags.phone || tags['contact:phone'] || null;
  const nameEn = (nameRaw || finalName || 'Swimming Pool').slice(0, 128);
  finalName && (finalName = finalName.slice(0, 128));

  // 评分（冲突时高的留下）：REAL > ADDR > DEF × tags 丰富度 × way/rel > node
  const score =
    (kind === 'REAL' ? 1_000_000 : (kind === 'ADDR' ? 100_000 : 10_000)) +
    (nameRaw ? 500_000 : 0) +
    (el.type === 'relation' ? 15_000 : (el.type === 'way' ? 10_000 : 5_000)) +
    (tags.wikidata ? 10_000 : 0) +
    (tags.phone ? 1_500 : 0) +
    (operator ? 1_000 : 0) +
    (tags.image || tags.website ? 500 : 0);

  candidates.push({
    extId, kind, name: finalName, nameNorm: normName(finalName),
    addressRaw: addressRaw ? addressRaw.slice(0, 255) : null,
    district: (district || 'Los Angeles').slice(0, 64),
    lat, lon, typeHint, tel, nameEn, score,
    osmShortId: extId.replace(/^osm_(node|way|relation)_/, '$1/'),
  });
}

candidates.sort((a, b) => b.score - a.score);

// ============== 去重 Pass 1：named（REAL + ADDR，即不是默认名） ==============
const snap25Map = new Map();          // key25 -> [row]
const grid100Count = new Map();       // key100 -> { real: n, addr: n, def: n }
const globalNameNN = new Map();       // normName -> true
const rowsNamed = [];
const DS = {
  maxSnap25: 0, dupNameSnap: 0, dupGlobalName: 0,
  gridRealFull: 0, gridAddrFull: 0, dupName100Near: 0,
};

function gridInc(k, kind) {
  const g = grid100Count.get(k) || { real: 0, addr: 0, def: 0 };
  if (kind === 'REAL') g.real++;
  else if (kind === 'ADDR') g.addr++;
  else g.def++;
  grid100Count.set(k, g);
  return g;
}
function gridCount(k) { return grid100Count.get(k) || { real: 0, addr: 0, def: 0 }; }

for (const c of candidates) {
  if (c.kind === 'DEF') continue;   // 默认名放到 Pass3 unnamed

  // L0: 全局 normName 重复（同一个场馆被标到两个很远的坐标也只留一个）
  if (c.nameNorm && globalNameNN.has(c.nameNorm)) { DS.dupGlobalName++; continue; }

  const k25 = key25(c.lat, c.lon);
  const k100 = key100(c.lat, c.lon);
  const arr25 = snap25Map.get(k25) || [];
  const g = gridCount(k100);

  // L1: 细网格 (25m) 最多 N 条 (MAX_PER_SNAP25)
  if (arr25.length >= MAX_PER_SNAP25) { DS.maxSnap25++; continue; }

  // L2: 细网格内 normName 相似/包含 = dup
  let dup = false;
  for (const x of arr25) {
    const a = c.nameNorm, b = x.nameNorm;
    if (a && b && (a === b || a.includes(b) || b.includes(a))) { dup = true; break; }
  }
  if (dup) { DS.dupNameSnap++; continue; }

  // L3: 粗网格 (100m) 按 kind 分上限
  if (c.kind === 'REAL') {
    if (g.real >= REAL_NAME_PER_GRID) { DS.gridRealFull++; continue; }
  } else { // ADDR
    if (g.addr >= ADDR_FALLBACK_PER_GRID) { DS.gridAddrFull++; continue; }
    // L3b. 粗网格内 normName 相似/包含也去重（针对 123/125/127 Main St 这种细微差异）
    const allRowsIn100 = [];
    for (const [kk25, rows25] of snap25Map.entries()) {
      const [latStr, lonStr] = kk25.split('|');
      const lat25 = parseFloat(latStr), lon25 = parseFloat(lonStr);
      if (Math.abs(lat25 - snap25(c.lat)) > 0.0009 || Math.abs(lon25 - snap25(c.lon)) > 0.0011) continue;
      allRowsIn100.push(...rows25);
    }
    for (const x of allRowsIn100) {
      const a = c.nameNorm, b = x.nameNorm;
      if (a && b && (a === b || a.includes(b) || b.includes(a))) { dup = true; break; }
    }
    if (dup) { DS.dupName100Near++; continue; }
  }

  const row = {
    id: uuidv4(), extId: c.extId, name: c.name, nameEn: c.nameEn,
    addressRaw: c.addressRaw, district: c.district,
    lat: c.lat, lon: c.lon, typeHint: c.typeHint, tel: c.tel,
    osmShortId: c.osmShortId, externalIds: JSON.stringify({ osm: c.extId }),
    nameNorm: c.nameNorm, kind: c.kind,
  };
  rowsNamed.push(row); arr25.push(row); snap25Map.set(k25, arr25);
  gridInc(k100, c.kind);
  if (c.nameNorm) globalNameNN.set(c.nameNorm, true);
}

// ============== Pass 2：unnamed (DEF 默认名) ==============
const rows = rowsNamed.slice();
const wantUnnamedMax = Math.max(0, Math.floor(rowsNamed.length * UNNAMED_RATIO / (1 - UNNAMED_RATIO)));
let insertedUnnamed = 0;
const US = { maxSnap25: 0, gridDefFull: 0 };

for (const c of candidates) {
  if (insertedUnnamed >= wantUnnamedMax) break;
  if (c.kind !== 'DEF') continue;
  if (c.nameNorm && globalNameNN.has(c.nameNorm)) continue;

  const k25  = key25(c.lat, c.lon);
  const k100 = key100(c.lat, c.lon);
  const arr25 = snap25Map.get(k25) || [];
  if (arr25.length >= MAX_PER_SNAP25 + 1) { US.maxSnap25++; continue; }
  const g = gridCount(k100);
  if (g.def >= DEFAULT_PER_GRID) { US.gridDefFull++; continue; }

  const row = {
    id: uuidv4(), extId: c.extId, name: c.name, nameEn: c.nameEn,
    addressRaw: c.addressRaw, district: c.district,
    lat: c.lat, lon: c.lon, typeHint: c.typeHint, tel: c.tel,
    osmShortId: c.osmShortId, externalIds: JSON.stringify({ osm: c.extId }),
    nameNorm: c.nameNorm, kind: c.kind,
  };
  rows.push(row); arr25.push(row); snap25Map.set(k25, arr25);
  gridInc(k100, 'DEF');
  if (c.nameNorm) globalNameNN.set(c.nameNorm, true);
  insertedUnnamed++;
}

// ============== 输出 SQL ==============
const out = [];
out.push('-- LA 泳池 OSM SQL v11（' + new Date().toISOString() + '）');
out.push('-- elements=' + elements.length + ' candidates=' + candidates.length +
         ' INSERT=' + rows.length +
         '（REAL=' + rowsNamed.filter(r => r.kind === 'REAL').length +
         ' + ADDR=' + rowsNamed.filter(r => r.kind === 'ADDR').length +
         ' + DEF(unnamed)=' + insertedUnnamed + '/' + wantUnnamedMax + '）');
out.push('-- v11 dedupe 新规则：每 100m 粗网格 → REAL 上限 ' + REAL_NAME_PER_GRID + ' / ADDR 上限 ' + ADDR_FALLBACK_PER_GRID + ' / DEF 上限 ' + DEFAULT_PER_GRID);
out.push('-- skip：tag=' + S.tag + ' coord=' + S.coord + ' hard=' + S.hard + ' neg=' + S.neg +
         ' | [named] global-name=' + DS.dupGlobalName +
         ' maxSnap25=' + DS.maxSnap25 + ' snap-nameDup=' + DS.dupNameSnap +
         ' gridRealFull=' + DS.gridRealFull + ' gridAddrFull=' + DS.gridAddrFull +
         ' near100-nameDup=' + DS.dupName100Near +
         ' | [unnamed] maxSnap25=' + US.maxSnap25 + ' gridDefFull=' + US.gridDefFull);
out.push('');
out.push('DO $$');
out.push('DECLARE v_city_id UUID;');
out.push('BEGIN');
out.push("  SELECT id INTO v_city_id FROM cities WHERE code = '" + CITY_CODE + "' LIMIT 1;");
out.push('  IF v_city_id IS NULL THEN');
out.push("    RAISE EXCEPTION '先插入 la 城市: INSERT INTO cities(id,code,name,status,sort_order,created_at,updated_at) VALUES (gen_random_uuid(),''la'',''洛杉矶'',''enabled'',0,NOW(),NOW()) ON CONFLICT DO NOTHING;';");
out.push('  END IF;');
out.push('');

for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const sLat = 'ROUND((' + r.lat + '*400)::numeric,0)/400';
  const sLon = 'ROUND((' + r.lon + '*400)::numeric,0)/400';
  const vals = [
    "'" + r.id + "'", 'v_city_id',
    esc(r.name), esc(r.nameEn), esc(r.addressRaw), esc(r.district),
    String(r.lat), String(r.lon), sLat, sLon, esc(r.typeHint),
    "'normal'", '\'OSM_OVERPASS\'::"VenueDataSource"',
    esc('https://www.openstreetmap.org/' + r.osmShortId),
    'NOW()', esc(r.externalIds) + '::jsonb', esc(r.tel), 'NOW()', 'NOW()',
  ].join(',');
  out.push('  -- #' + (i + 1) + ' [' + r.kind + '] ' + r.name + ' (' + r.extId + ')');
  out.push('  INSERT INTO venues(id,city_id,name,name_en,address_raw,district,latitude,longitude,snapped_latitude,snapped_longitude,type_hint,status,data_source,source_url,last_ingested_at,external_ids,contact_phone,created_at,updated_at) VALUES (' + vals + ') ON CONFLICT DO NOTHING;');
  out.push('');
}
out.push('END $$;');

fs.writeFileSync(OUTPUT_SQL, out.join('\n'), 'utf8');
console.log('');
console.log('✅ v11 版 SQL 生成完毕！');
console.log('   JSON elements              = ' + elements.length);
console.log('   candidates                 = ' + candidates.length);
console.log('   最终 INSERT 条数           = ' + rows.length + '（目标 500 ~ 800）');
const realN = rowsNamed.filter(r => r.kind === 'REAL').length;
const addrN = rowsNamed.filter(r => r.kind === 'ADDR').length;
console.log('     分类：REAL(tags.name/op)  = ' + realN);
console.log('     分类：ADDR(地址 fallback) = ' + addrN);
console.log('     分类：DEF(默认名 unnamed) = ' + insertedUnnamed + ' /上限=' + wantUnnamedMax);
console.log('');
console.log('   跳过明细：');
console.log('     tag 不命中 / coord / hard / neg  = ' + S.tag + ' / ' + S.coord + ' / ' + S.hard + ' / ' + S.neg);
console.log('     [REAL|ADDR named]');
console.log('       全局 normName dup       = ' + DS.dupGlobalName);
console.log('       细 25m 超 MAX(=' + MAX_PER_SNAP25 + ')  = ' + DS.maxSnap25);
console.log('       细 25m 同名 dup         = ' + DS.dupNameSnap);
console.log('       粗 100m REAL 超上限(=' + REAL_NAME_PER_GRID + ')     = ' + DS.gridRealFull);
console.log('       粗 100m ADDR 超上限(=' + ADDR_FALLBACK_PER_GRID + ')      = ' + DS.gridAddrFull);
console.log('       粗 100m 近邻同名 dup    = ' + DS.dupName100Near);
console.log('     [DEF unnamed]');
console.log('       细 25m 超 / 粗 100m DEF 超上限(=' + DEFAULT_PER_GRID + ')   = ' + US.maxSnap25 + ' / ' + US.gridDefFull);
console.log('');
console.log('   输出 = ' + OUTPUT_SQL + '（' + (fs.statSync(OUTPUT_SQL).size / 1024).toFixed(1) + ' KB）');
