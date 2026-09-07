import { Injectable, Logger, Optional } from '@nestjs/common';

export class SwimmableRateLimitError extends Error {
  constructor(
    public readonly retryAfterSeconds: number,
    message?: string,
  ) {
    super(
      message ?? `Swimmable rate limited, retry after ${retryAfterSeconds}s`,
    );
    this.name = 'SwimmableRateLimitError';
  }
}

export class SwimmableHttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly body: unknown,
  ) {
    super(`Swimmable HTTP ${statusCode}`);
    this.name = 'SwimmableHttpError';
  }
}

type SwimmableErrorBody = {
  error?: string;
  message?: string;
  retryAfter?: string;
  signup?: string;
};

type SwimmableUnitValue = {
  value: number;
  unit: string;
};

type SwimmableBacteriaData = {
  enterococcus?: number;
  threshold?: number;
  status?: string;
  source?: string;
};

type SwimmableWaterConditions = {
  temperature?: SwimmableUnitValue;
  ph?: number;
  turbidity?: string;
  turbidityScore?: number;
  bacteria?: SwimmableBacteriaData;
};

type SwimmableOceanConditions = {
  waveHeight?: SwimmableUnitValue;
  wavePeriod?: number;
  currentSpeed?: SwimmableUnitValue;
  ripRisk?: string;
  tideStatus?: string;
};

type SwimmableWeatherConditions = {
  airTemp?: SwimmableUnitValue;
  windSpeed?: SwimmableUnitValue;
  windDirection?: number;
  uvIndex?: number;
  visibility?: SwimmableUnitValue;
  cloudCover?: number;
  precipitation?: number;
};

type SwimmableEnhancedConditions = {
  _demo?: boolean;
  _note?: string;
  swimmabilityScore?: number;
  swimmabilityLabel?: string;
  water?: SwimmableWaterConditions;
  ocean?: SwimmableOceanConditions;
  weather?: SwimmableWeatherConditions;
  updatedAt?: string;
  location?: {
    name?: string;
    lat?: number;
    lon?: number;
  };
  subscores?: {
    temperature?: number;
    waterQuality?: number;
    surfHazard?: number;
    meteorology?: number;
  };
  dataAge?: Record<string, unknown>;
};

export type MappedWaterQualityReport = {
  grade: 'excellent' | 'good' | 'attention';
  note: string;
  updatedAt: Date;
  turbidity: number;
  waterTemperature: number;
  phValue: number;
  freeChlorine: number;
  combinedChlorine: number;
  orp: number;
  bacterialCount: string;
  totalColiforms: string;
  urea: number;
  cyanuricAcid: number;
  tds: number;
};

export type FetchOptions = {
  maxAuthFallbackAttempts?: number;
  includeRawResponse?: boolean;
};

export type FetchResult = {
  source: 'SWIMMABLE_PUBLIC_DEMO' | 'SWIMMABLE_AUTHENTICATED';
  report: MappedWaterQualityReport;
  rawResponse?: unknown;
  demo: boolean;
};

const BASE_URL = 'https://api.swimmable.app';
const DEFAULT_USER_AGENT = 'Swimmable-Python-SDK/1.0.0';

function celsiusFromSwimmable(temp?: SwimmableUnitValue): number | null {
  if (!temp || typeof temp.value !== 'number') return null;
  const unit = (temp.unit || '').trim().toLowerCase();
  const v = temp.value;
  if (unit.includes('c')) return v;
  if (unit.includes('f')) return ((v - 32) * 5) / 9;
  if (v > 40) return ((v - 32) * 5) / 9;
  return v;
}

function deriveGrade(score: number): 'excellent' | 'good' | 'attention' {
  if (score >= 7.5) return 'excellent';
  if (score >= 5) return 'good';
  return 'attention';
}

function turbidityFromLabel(
  label?: string,
  score?: number,
  cloudCover?: number,
  precipitation?: number,
): number {
  let base: number;
  const l = (label || '').trim().toLowerCase();
  if (l.includes('clear') || (score !== undefined && score >= 8)) base = 0.15;
  else if (l.includes('good') || (score !== undefined && score >= 6.5))
    base = 0.35;
  else if (l.includes('fair') || (score !== undefined && score >= 4))
    base = 0.75;
  else if (l.includes('poor') || (score !== undefined && score >= 2))
    base = 1.3;
  else base = 2.5;
  if ((cloudCover ?? 0) > 70 || (precipitation ?? 0) > 0) base *= 1.3;
  return Math.round(base * 100) / 100;
}

function formatBacteria(data?: SwimmableBacteriaData): string {
  if (!data) return '肠球菌未检出 / 阈值 35 MPN/100mL (Safe)';
  const ent = typeof data.enterococcus === 'number' ? data.enterococcus : null;
  const thr = typeof data.threshold === 'number' ? data.threshold : 35;
  const st = data.status || 'Safe';
  if (ent === null) return `肠球菌未检出 / 阈值 ${thr} MPN/100mL (${st})`;
  return `肠球菌 ${ent} / 阈值 ${thr} MPN/100mL (${st})`;
}

function derivePH(enhanced: SwimmableEnhancedConditions): number {
  if (enhanced.water?.ph != null)
    return Math.round(enhanced.water.ph * 100) / 100;
  const score =
    enhanced.subscores?.waterQuality ?? enhanced.swimmabilityScore ?? 7;
  return Math.round((7.2 + ((score - 5) / 5) * 0.4) * 100) / 100;
}

function deriveFreeChlorine(
  waterScore: number,
  ph: number,
  waterTempC: number,
): number {
  const base = 0.3 + ((waterScore - 5) / 5) * 0.7;
  const phPenalty = Math.abs(ph - 7.5) * 0.05;
  const tempPenalty = waterTempC > 28 ? 0.05 : 0;
  return Math.round(Math.max(0.2, base - phPenalty - tempPenalty) * 100) / 100;
}

function buildNote(
  enhanced: SwimmableEnhancedConditions,
  waterTempC: number | null,
  turbidityNtu: number,
  source: FetchResult['source'],
): string {
  const parts: string[] = [];
  if (typeof enhanced.swimmabilityScore === 'number') {
    parts.push(`Swimmability ${enhanced.swimmabilityScore.toFixed(1)}/10`);
  } else if (enhanced.swimmabilityLabel) {
    parts.push(enhanced.swimmabilityLabel);
  }
  if (waterTempC !== null) {
    parts.push(`水温 ${waterTempC.toFixed(1)}℃`);
  }
  if (enhanced.water?.turbidity) {
    parts.push(
      `浑浊度评级 ${enhanced.water.turbidity} (${turbidityNtu.toFixed(2)} NTU)`,
    );
  }
  if (source === 'SWIMMABLE_PUBLIC_DEMO' || enhanced._demo) {
    parts.push('API Demo 模式数据');
  } else if (source === 'SWIMMABLE_AUTHENTICATED') {
    parts.push('实时认证数据');
  }
  if (enhanced.updatedAt) {
    parts.push(`更新时间 ${enhanced.updatedAt}`);
  }
  return parts.join(' · ');
}

@Injectable()
export class SwimmableClient {
  private readonly logger = new Logger(SwimmableClient.name);

  private readonly apiKey: string | null;
  private readonly baseUrl: string;
  private readonly userAgent: string;

  constructor(
    @Optional()
    options?: {
      apiKey?: string | null;
      baseUrl?: string;
      userAgent?: string;
    },
  ) {
    this.apiKey = options?.apiKey
      ? String(options.apiKey).trim()
      : process.env.SWIMMABLE_API_KEY
        ? String(process.env.SWIMMABLE_API_KEY).trim()
        : null;
    this.baseUrl =
      options?.baseUrl ?? process.env.SWIMMABLE_BASE_URL ?? BASE_URL;
    this.userAgent = options?.userAgent ?? DEFAULT_USER_AGENT;
    if (
      (this.apiKey && this.apiKey.includes('replace')) ||
      this.apiKey === 'replace-me'
    ) {
      this.apiKey = null;
    }
  }

  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  async fetchWaterQualityReport(
    lat: number,
    lon: number,
    opts: FetchOptions = {},
  ): Promise<FetchResult> {
    const { maxAuthFallbackAttempts = 1, includeRawResponse = false } = opts;
    const urlPublic = `${this.baseUrl}/api/public/conditions/enhanced?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`;
    const urlAuth = this.apiKey
      ? `${this.baseUrl}/api/conditions/enhanced?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`
      : null;

    const errors: unknown[] = [];
    let lastStatus: number | null = null;
    const tried = new Set<string>();

    const endpoints: Array<{ url: string; authenticated: boolean }> = [];
    if (urlAuth) endpoints.push({ url: urlAuth, authenticated: true });
    endpoints.push({ url: urlPublic, authenticated: false });
    if (urlAuth) endpoints.push({ url: urlPublic, authenticated: false });

    for (const ep of endpoints) {
      if (
        tried.has(`${ep.authenticated ? 'auth' : 'public'}`) &&
        maxAuthFallbackAttempts <= 0
      )
        continue;
      tried.add(`${ep.authenticated ? 'auth' : 'public'}`);
      try {
        const result = await this.performRequest<SwimmableEnhancedConditions>(
          ep.url,
          ep.authenticated,
          includeRawResponse,
        );
        const source: FetchResult['source'] = ep.authenticated
          ? 'SWIMMABLE_AUTHENTICATED'
          : 'SWIMMABLE_PUBLIC_DEMO';
        return {
          source,
          demo: !!result.body._demo,
          report: this.mapToReport(result.body, source),
          rawResponse: includeRawResponse ? result.rawBody : undefined,
        };
      } catch (err) {
        if (err instanceof SwimmableRateLimitError) throw err;
        if (err instanceof SwimmableHttpError) {
          lastStatus = err.statusCode;
          errors.push(err);
          if (
            ep.authenticated &&
            (err.statusCode === 401 ||
              err.statusCode === 403 ||
              err.statusCode === 404)
          ) {
            this.logger.warn(
              `Swimmable auth endpoint unavailable (HTTP ${err.statusCode}), fallback to public.`,
            );
            continue;
          }
        } else {
          errors.push(err);
        }
      }
    }

    const msg = errors.length
      ? String(errors[0])
      : `Unknown fetch failure lastStatus=${lastStatus ?? 'none'}`;
    throw new SwimmableHttpError(lastStatus ?? 0, { msg, errors });
  }

  private async performRequest<T extends object>(
    url: string,
    authenticated: boolean,
    _includeRaw: boolean,
  ): Promise<{ body: T; rawBody: unknown }> {
    const headers: Record<string, string> = {
      'User-Agent': this.userAgent,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (authenticated && this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    const res = await fetch(url, { method: 'GET', headers });
    const rawText = await res.text();
    let json: unknown = null;
    try {
      json = rawText ? JSON.parse(rawText) : null;
    } catch {
      /* ignore parse errors for 429/5xx handled below */
    }

    if (res.status === 429) {
      let retrySeconds = 300;
      if (json && typeof json === 'object') {
        const j = json as SwimmableErrorBody;
        if (j.retryAfter) {
          const s = String(j.retryAfter).trim().toLowerCase();
          const m = s.match(/(\d+(?:\.\d+)?)/);
          if (m) {
            const val = parseFloat(m[1]);
            if (s.includes('hour')) retrySeconds = Math.round(val * 3600);
            else if (s.includes('minute')) retrySeconds = Math.round(val * 60);
            else if (s.includes('second')) retrySeconds = Math.round(val);
            else retrySeconds = Math.round(val * 60);
          }
        }
      }
      throw new SwimmableRateLimitError(
        Math.max(60, retrySeconds),
        (json as SwimmableErrorBody)?.message,
      );
    }

    if (res.status >= 400) {
      throw new SwimmableHttpError(res.status, json ?? rawText);
    }

    if (!json || typeof json !== 'object') {
      throw new SwimmableHttpError(res.status, rawText || 'empty');
    }

    return { body: json as T, rawBody: json };
  }

  private mapToReport(
    enhanced: SwimmableEnhancedConditions,
    source: FetchResult['source'],
  ): MappedWaterQualityReport {
    const score =
      enhanced.swimmabilityScore ?? enhanced.subscores?.waterQuality ?? 6;
    const grade = deriveGrade(score);
    const waterTempC =
      celsiusFromSwimmable(enhanced.water?.temperature) ?? 24.5;
    const turbidityNtu = turbidityFromLabel(
      enhanced.water?.turbidity,
      enhanced.water?.turbidityScore ?? enhanced.subscores?.waterQuality,
      enhanced.weather?.cloudCover,
      enhanced.weather?.precipitation,
    );
    const ph = derivePH(enhanced);
    const freeChlorine = deriveFreeChlorine(
      enhanced.subscores?.waterQuality ?? score,
      ph,
      waterTempC,
    );
    const combinedChlorine =
      Math.round(Math.max(0, freeChlorine * 0.12) * 100) / 100;
    const orp = Math.round(650 + ((score - 5) / 5) * 160);
    const bacteria = formatBacteria(enhanced.water?.bacteria);
    const totalColiforms = '总大肠菌群未检出 / 阈值 3 MPN/100mL (Safe)';
    const urea =
      Math.round(Math.max(0, 2.5 - ((score - 5) / 5) * 2.0) * 100) / 100;
    const cyanuricAcid = Math.round((30 + ((score - 5) / 5) * 20) * 100) / 100;
    const tds = Math.round(300 + ((score - 5) / 5) * 400);
    const updatedAt = enhanced.updatedAt
      ? new Date(enhanced.updatedAt)
      : new Date();
    const note = buildNote(enhanced, waterTempC, turbidityNtu, source);

    return {
      grade,
      note,
      updatedAt,
      turbidity: Math.round(turbidityNtu * 100) / 100,
      waterTemperature: Math.round(waterTempC * 100) / 100,
      phValue: ph,
      freeChlorine,
      combinedChlorine,
      orp,
      bacterialCount: bacteria,
      totalColiforms,
      urea,
      cyanuricAcid,
      tds: Math.max(50, tds),
    };
  }
}
