import { Injectable, Logger } from '@nestjs/common';

export interface OsmOverpassPoiItem {
  id: string;
  name: string;
  address: string;
  district: string;
  latitude: number;
  longitude: number;
  type: string;
  tel?: string | null;
}

export interface OsmOverpassCityBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export type OsmSearchMode = 'swimming_pool' | 'sport_swimming' | 'mixed';

@Injectable()
export class OsmOverpassProvider {
  private readonly logger = new Logger(OsmOverpassProvider.name);
  private readonly defaultEndpoint = 'https://overpass-api.de/api/interpreter';
  private readonly backupEndpoints = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter',
    'https://overpass.openstreetmap.ie/api/interpreter',
  ];

  isConfigured(): boolean {
    return true;
  }

  async searchSwimmingPoolsInBounds(
    bounds: OsmOverpassCityBounds,
    options: {
      timeoutSec?: number;
      elementLimit?: number;
      sleepMs?: number;
      endpointIndex?: number;
    } = {},
  ): Promise<OsmOverpassPoiItem[]> {
    const {
      timeoutSec = 180,
      elementLimit = 5000,
      sleepMs = 800,
      endpointIndex = 0,
    } = options;

    const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;

    const mixedQuery = `
[out:json][timeout:${timeoutSec}][maxsize:${elementLimit * 1024}];
(
  node["leisure"="swimming_pool"](${bbox});
  way["leisure"="swimming_pool"](${bbox});
  relation["leisure"="swimming_pool"](${bbox});
  node["sport"="swimming"](${bbox});
  way["sport"="swimming"](${bbox});
  node["amenity"="swimming_pool"](${bbox});
  way["amenity"="swimming_pool"](${bbox});
);
out body;
>;
out skel qt;
`.trim();

    let lastErr: unknown = null;
    const endpoints = [this.defaultEndpoint, ...this.backupEndpoints];
    for (let i = endpointIndex; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      try {
        this.logger.log(
          `[Overpass] Query endpoint=${endpoint} bbox=${bbox} querySize=${mixedQuery.length}`,
        );
        const payload = await this.request(endpoint, mixedQuery);
        if (sleepMs > 0) await sleep(sleepMs);
        const parsed = this.parseElements(payload, bounds);
        this.logger.log(
          `[Overpass] Collected ${parsed.length} swimming pools from ${endpoint}`,
        );
        return parsed;
      } catch (err) {
        lastErr = err;
        this.logger.warn(
          `[Overpass] endpoint=${endpoint} failed: ${
            err instanceof Error ? err.message : String(err)
          }, trying next endpoint...`,
        );
        if (sleepMs > 0) await sleep(sleepMs);
      }
    }
    throw new Error(
      `[Overpass] All endpoints failed. Last error: ${
        lastErr instanceof Error ? lastErr.message : String(lastErr)
      }`,
    );
  }

  private async request(
    endpoint: string,
    query: string,
  ): Promise<OsmOverpassResponse> {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent':
          'SwimService-Ingest/1.0 (https://example.com; hello@example.com)',
      },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `[Overpass] HTTP ${res.status} for endpoint=${endpoint}: ${text.slice(0, 300)}`,
      );
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (
      !contentType.includes('application/json') &&
      !contentType.includes('json')
    ) {
      const textPreview = (await res.text().catch(() => '')).slice(0, 300);
      throw new Error(
        `[Overpass] Unexpected content-type=${contentType}. Body preview: ${textPreview}`,
      );
    }
    return (await res.json()) as OsmOverpassResponse;
  }

  private parseElements(
    payload: OsmOverpassResponse,
    bounds: OsmOverpassCityBounds,
  ): OsmOverpassPoiItem[] {
    const elements = Array.isArray(payload.elements) ? payload.elements : [];

    const wayNodeIdToLatLon = new Map<string, { lat: number; lon: number }>();
    for (const el of elements) {
      if (el.type !== 'node') continue;
      if (typeof el.lat !== 'number' || typeof el.lon !== 'number') continue;
      wayNodeIdToLatLon.set(`${el.id}`, { lat: el.lat, lon: el.lon });
    }

    const results: OsmOverpassPoiItem[] = [];
    const seenExtIds = new Set<string>();

    for (const el of elements) {
      if (!el || !el.id) continue;
      const tags = el.tags ?? {};
      if (!this.tagsIndicateSwimPool(tags)) continue;

      let latitude: number | undefined;
      let longitude: number | undefined;

      if (
        el.type === 'node' &&
        typeof el.lat === 'number' &&
        typeof el.lon === 'number'
      ) {
        latitude = el.lat;
        longitude = el.lon;
      } else if (
        (el.type === 'way' || el.type === 'relation') &&
        Array.isArray(el.bounds)
      ) {
        latitude = (el.bounds[0].minlat + el.bounds[0].maxlat) / 2;
        longitude = (el.bounds[0].minlon + el.bounds[0].maxlon) / 2;
      } else if (
        (el.type === 'way' || el.type === 'relation') &&
        el.minlat != null &&
        el.minlon != null
      ) {
        const minlat = el.minlat;
        const minlon = el.minlon;
        const maxlat = el.maxlat ?? minlat;
        const maxlon = el.maxlon ?? minlon;
        latitude = (minlat + maxlat) / 2;
        longitude = (minlon + maxlon) / 2;
      }

      if (latitude == null || longitude == null) continue;
      if (
        latitude < bounds.south ||
        latitude > bounds.north ||
        longitude < bounds.west ||
        longitude > bounds.east
      ) {
        continue;
      }
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

      const extId = `osm_${el.type}_${el.id}`;
      if (seenExtIds.has(extId)) continue;
      seenExtIds.add(extId);

      const name =
        tags.name ??
        tags['name:en'] ??
        tags.alt_name ??
        this.deriveNameFromAddress(tags) ??
        'Swimming Pool';

      const address = this.assembleAddress(tags);
      const district =
        tags.suburb ??
        tags.neighbourhood ??
        tags.city_district ??
        'Los Angeles';
      const typeHint = this.typeLabel(tags);

      results.push({
        id: extId,
        name: name.slice(0, 128),
        address: address.slice(0, 255),
        district: district.slice(0, 64),
        latitude,
        longitude,
        type: typeHint,
        tel: tags.phone ?? tags['contact:phone'] ?? null,
      });
    }

    return results;
  }

  private tagsIndicateSwimPool(tags: Record<string, string>): boolean {
    if (!tags || Object.keys(tags).length === 0) return false;

    const positive = new Map<string, string[]>([
      ['leisure', ['swimming_pool']],
      ['sport', ['swimming']],
      ['amenity', ['swimming_pool']],
    ]);

    for (const [k, vs] of positive.entries()) {
      const v = tags[k];
      if (!v) continue;
      if (vs.includes(v)) return true;
    }

    return false;
  }

  private typeLabel(tags: Record<string, string>): string {
    const parts: string[] = [];
    if (tags.leisure) parts.push(`leisure=${tags.leisure}`);
    if (tags.sport) parts.push(`sport=${tags.sport}`);
    if (tags.amenity) parts.push(`amenity=${tags.amenity}`);
    if (tags.building) parts.push(`building=${tags.building}`);
    if (tags.operator) parts.push(`operator=${tags.operator}`);
    return parts.join('; ');
  }

  private assembleAddress(tags: Record<string, string>): string {
    const house = tags['addr:housenumber'] ?? '';
    const street = tags['addr:street'] ?? '';
    const city = tags['addr:city'] ?? tags.city ?? 'Los Angeles';
    const state = tags['addr:state'] ?? tags['addr:province'] ?? 'CA';
    const postcode = tags['addr:postcode'] ?? '';

    const line1 = [house, street].filter(Boolean).join(' ').trim();
    const line2 = [city, state, postcode].filter(Boolean).join(', ').trim();

    const full = [line1, line2].filter(Boolean).join(', ').trim();
    return full.length ? full : (tags.address ?? '');
  }

  private deriveNameFromAddress(tags: Record<string, string>): string | null {
    const operator = tags.operator?.trim();
    if (operator) return `${operator} Swimming Pool`;
    const line1 = this.assembleAddress(tags);
    if (line1 && line1.length > 0 && line1.length < 80) return line1;
    return null;
  }
}

interface OsmOverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  nodes?: number[];
  bounds?: Array<{
    minlat: number;
    minlon: number;
    maxlat: number;
    maxlon: number;
  }>;
  minlat?: number;
  minlon?: number;
  maxlat?: number;
  maxlon?: number;
  members?: Array<{
    type: 'node' | 'way' | 'relation';
    ref: number;
    role?: string;
  }>;
}

interface OsmOverpassResponse {
  version?: number;
  generator?: string;
  osm3s?: {
    timestamp_osm_base?: string;
    timestamp_areas_base?: string;
    copyright?: string;
  };
  elements: OsmOverpassElement[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
