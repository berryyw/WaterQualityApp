import { Injectable, Logger } from '@nestjs/common';

export interface AmapPoiItem {
  id: string;
  name: string;
  address: string;
  district: string;
  latitude: number;
  longitude: number;
  type: string;
  tel?: string | null;
}

export interface AmapSearchPage {
  page: number;
  pageSize: number;
  totalCount: number;
  items: AmapPoiItem[];
}

@Injectable()
export class AmapPoiProvider {
  private readonly logger = new Logger(AmapPoiProvider.name);
  private readonly baseUrl = 'https://restapi.amap.com/v3/place/text';
  private readonly apiKey: string;

  constructor() {
    const key = process.env.AMAP_WEB_KEY?.trim();
    this.apiKey = key ?? '';
    if (!this.apiKey) {
      this.logger.warn(
        '[AmapPoiProvider] AMAP_WEB_KEY is not set in environment. All requests will fail. Set SwimService/.env: AMAP_WEB_KEY=xxxxxxxxxxxx',
      );
    }
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async searchTextAll(
    keywords: string,
    cityAdcode: string,
    options: {
      pageSize?: number;
      maxPages?: number;
      sleepMs?: number;
      cityLimit?: boolean;
    } = {},
  ): Promise<AmapPoiItem[]> {
    const {
      pageSize = 25,
      maxPages = 40,
      sleepMs = 300,
      cityLimit = true,
    } = options;

    const all: AmapPoiItem[] = [];
    const seenIds = new Set<string>();
    let knownTotal = Number.POSITIVE_INFINITY;

    for (let page = 1; page <= maxPages; page++) {
      const result = await this.searchTextPage(keywords, cityAdcode, {
        page,
        pageSize,
        cityLimit,
      });
      if (result.items.length === 0) break;
      knownTotal = result.totalCount;
      for (const item of result.items) {
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        all.push(item);
      }
      if (all.length >= knownTotal) break;
      if (page < maxPages && result.items.length >= pageSize && sleepMs > 0) {
        await sleep(sleepMs);
      }
    }
    this.logger.log(
      `[Amap] keywords="${keywords}" cityAdcode=${cityAdcode} collected=${all.length} totalReported=${knownTotal} pagesScanned<=${maxPages}`,
    );
    return all;
  }

  async searchTextPage(
    keywords: string,
    cityAdcode: string,
    options: {
      page: number;
      pageSize?: number;
      cityLimit?: boolean;
    },
  ): Promise<AmapSearchPage> {
    if (!this.isConfigured()) {
      throw new Error(
        '[AmapPoiProvider] Missing AMAP_WEB_KEY env var. Add to SwimService/.env before running ingest.',
      );
    }
    const { page, pageSize = 25, cityLimit = true } = options;
    const params = new URLSearchParams({
      key: this.apiKey,
      keywords,
      city: cityAdcode,
      citylimit: cityLimit ? 'true' : 'false',
      offset: String(pageSize),
      page: String(page),
      extensions: 'base',
      output: 'JSON',
    });
    const url = `${this.baseUrl}?${params.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'SwimService-Ingest/1.0' },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `[AmapPoiProvider] HTTP ${res.status} for keywords="${keywords}" page=${page}: ${text.slice(0, 200)}`,
      );
    }
    const payload = (await res.json()) as AmapTextPoiResponse;
    if (payload.status !== '1') {
      throw new Error(
        `[AmapPoiProvider] status=${payload.status} info=${payload.info} infocode=${payload.infocode} keywords="${keywords}" page=${page}`,
      );
    }
    const items: AmapPoiItem[] = [];
    const pois = Array.isArray(payload.pois) ? payload.pois : [];
    for (const poi of pois) {
      if (!poi.id || !poi.name || !poi.location) continue;
      const [lonStr, latStr] = poi.location.split(',');
      const longitude = parseFloat(lonStr);
      const latitude = parseFloat(latStr);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      items.push({
        id: poi.id,
        name: poi.name,
        address: poi.address ?? '',
        district: poi.adname ?? '',
        latitude,
        longitude,
        type: poi.type ?? '',
        tel: poi.tel ?? null,
      });
    }
    const totalCount = parseInt(payload.count ?? '0', 10) || 0;
    return { page, pageSize, totalCount, items };
  }
}

interface AmapTextPoiResponse {
  status: string;
  info: string;
  infocode: string;
  count?: string;
  pois?: Array<{
    id?: string;
    name?: string;
    address?: string | null;
    adname?: string | null;
    location?: string;
    type?: string | null;
    tel?: string | null;
  }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
