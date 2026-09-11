import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';

export interface GooglePlaceReview {
  author_name: string;
  author_url?: string;
  language?: string;
  original_language?: string;
  profile_photo_url?: string;
  rating: number;
  relative_time_description: string;
  text?: string;
  time: number;
}

export interface GooglePlaceDetailsResult {
  place_id: string;
  rating?: number;
  user_ratings_total?: number;
  reviews?: GooglePlaceReview[];
}

export interface GooglePlaceDetailsResponse {
  html_attributions?: unknown[];
  result?: GooglePlaceDetailsResult;
  status: string;
  error_message?: string;
  info_messages?: string[];
}

@Injectable()
export class GooglePlacesClient {
  private readonly logger = new Logger(GooglePlacesClient.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'maps.googleapis.com';
  private readonly timeoutMs = 10000;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('GOOGLE_PLACES_API_KEY')?.trim() || '';
    if (!this.apiKey) {
      this.logger.warn(
        'GOOGLE_PLACES_API_KEY is not configured; Google reviews will be skipped.',
      );
    }
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async fetchPlaceDetails(
    placeId: string,
    fields: string[] = ['reviews', 'rating', 'user_ratings_total'],
  ): Promise<GooglePlaceDetailsResponse> {
    if (!this.isConfigured()) {
      return {
        status: 'NOT_CONFIGURED',
        error_message: 'GOOGLE_PLACES_API_KEY is missing',
      };
    }

    const qs = new URLSearchParams({
      place_id: placeId,
      fields: fields.join(','),
      reviews_no_translations: 'true',
      key: this.apiKey,
    });

    const path = `/maps/api/place/details/json?${qs.toString()}`;
    const url = `https://${this.baseUrl}${path}`;

    this.logger.debug(`Fetching Place Details for place_id=${placeId}`);
    return this.httpsGetJson<GooglePlaceDetailsResponse>(url, this.timeoutMs);
  }

  private httpsGetJson<T>(urlStr: string, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const req = https.get(
        urlStr,
        {
          headers: {
            'User-Agent': 'SwimService/1.0 (+https://swim.quality)',
          },
          timeout: timeoutMs,
        },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body) as T;
              resolve(parsed);
            } catch (e) {
              reject(
                new Error(
                  `Google Places JSON parse failed: ${
                    e instanceof Error ? e.message : String(e)
                  }; body=${body.slice(0, 400)}`,
                ),
              );
            }
          });
        },
      );

      req.on('timeout', () => {
        req.destroy(
          new Error(`Google Places request timeout (${timeoutMs}ms)`),
        );
      });

      req.on('error', (e) => {
        reject(
          new Error(
            `Google Places HTTP error: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
      });
    });
  }
}
