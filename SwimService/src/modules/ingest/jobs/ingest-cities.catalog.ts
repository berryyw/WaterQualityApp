import { OsmOverpassCityBounds } from '../providers';

const CITY_ADCODE_MAP: Record<string, string> = {
  beijing: '110000',
  shanghai: '310000',
  guangzhou: '440100',
  shenzhen: '440300',
  hangzhou: '330100',
  chengdu: '510100',
  nanjing: '320100',
  wuhan: '420100',
  xian: '610100',
  suzhou: '320500',
  tianjin: '120000',
  chongqing: '500000',
  zhengzhou: '410100',
  changsha: '430100',
  shenyang: '210100',
  qingdao: '370200',
  ningbo: '330200',
  dongguan: '441900',
  foshan: '440600',
  wuxi: '320200',
  hefei: '340100',
  fuzhou: '350100',
  xiamen: '350200',
  jinan: '370100',
  kunming: '530100',
  harbin: '230100',
  changchun: '220100',
  shijiazhuang: '130100',
  taiyuan: '140100',
  nanning: '450100',
  guiyang: '520100',
  lanzhou: '620100',
  urumqi: '650100',
  huhehaote: '150100',
  yinchuan: '640100',
  xining: '630100',
  haikou: '460100',
  sanya: '460200',
};

const ADCODE_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(CITY_ADCODE_MAP).map(([code, adcode]) => [adcode, code]),
);

const CITY_NAME_HINTS: Array<{
  nameMatch: RegExp;
  adcode: string;
  code: string;
}> = [
  { nameMatch: /北京/, adcode: '110000', code: 'beijing' },
  { nameMatch: /上海/, adcode: '310000', code: 'shanghai' },
  { nameMatch: /广州/, adcode: '440100', code: 'guangzhou' },
  { nameMatch: /深圳/, adcode: '440300', code: 'shenzhen' },
  { nameMatch: /杭州/, adcode: '330100', code: 'hangzhou' },
  { nameMatch: /成都/, adcode: '510100', code: 'chengdu' },
  { nameMatch: /南京/, adcode: '320100', code: 'nanjing' },
  { nameMatch: /武汉/, adcode: '420100', code: 'wuhan' },
  { nameMatch: /西安|^Xi'an|Xian/i, adcode: '610100', code: 'xian' },
  { nameMatch: /苏州/, adcode: '320500', code: 'suzhou' },
  { nameMatch: /天津/, adcode: '120000', code: 'tianjin' },
  { nameMatch: /重庆/, adcode: '500000', code: 'chongqing' },
  { nameMatch: /洛杉矶|Los Angeles|LA/i, adcode: 'US-LA', code: 'la' },
];

const OSM_CITY_BOUNDS: Record<string, OsmOverpassCityBounds> = {
  la: {
    south: 33.69,
    west: -118.67,
    north: 34.34,
    east: -118.15,
  },
};

export type IngestProviderKind = 'AMAP' | 'OSM_OVERPASS';

const OSM_CITIES = new Set<string>(['la']);

export const IngestCities = {
  all(): Record<string, string> {
    return { ...CITY_ADCODE_MAP };
  },
  adcodeFor(cityCode: string, cityName?: string, cliToken?: string): string {
    const code = cityCode?.toLowerCase().trim();
    if (code && CITY_ADCODE_MAP[code]) return CITY_ADCODE_MAP[code];
    if (cliToken) {
      const token = cliToken.trim();
      if (/^\d{6}$/.test(token)) return token;
    }
    if (cityName) {
      const match = CITY_NAME_HINTS.find((h) => h.nameMatch.test(cityName));
      if (match) return match.adcode;
    }
    return cliToken?.trim() ?? cityCode ?? '';
  },
  codeFromAdcode(adcode: string): string | null {
    if (!adcode) return null;
    return ADCODE_TO_CODE[adcode.trim()] ?? null;
  },
  providerFor(
    cityCode: string,
    explicit?: IngestProviderKind,
  ): IngestProviderKind {
    if (explicit) return explicit;
    const code = cityCode?.toLowerCase().trim();
    if (OSM_CITIES.has(code)) return 'OSM_OVERPASS';
    return 'AMAP';
  },
  osmBoundsFor(cityCode: string): OsmOverpassCityBounds | null {
    const code = cityCode?.toLowerCase().trim();
    return OSM_CITY_BOUNDS[code] ?? null;
  },
};
