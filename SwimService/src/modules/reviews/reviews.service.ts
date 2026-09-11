import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, VenueDataSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  GooglePlaceDetailsResponse,
  GooglePlaceReview,
} from '../ingest/providers/google-places.client';
import { GooglePlacesClient } from '../ingest/providers/google-places.client';
import { AdminListReviewsQueryDto } from './dto/admin-list-reviews-query.dto';
import { AppCreateReviewDto } from './dto/app-create-review.dto';
import { UpdateReviewStatusDto } from './dto/update-review-status.dto';

const DEFAULT_GOOGLE_REVIEWS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type ReviewSource = 'APP' | 'GOOGLE';

export interface MergedAppReview {
  id: string;
  source: ReviewSource;
  content: string;
  createdAt: Date;
  rating?: number;
  relativeTime?: string;
  user: {
    email?: string;
    profile?: { nickname?: string | null } | null;
    displayName: string;
    avatarUrl?: string | null;
  };
}

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googlePlacesClient: GooglePlacesClient,
  ) {}

  async listForAdmin(query: AdminListReviewsQueryDto) {
    const where: Prisma.ReviewWhereInput = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.content
        ? { content: { contains: query.content.trim(), mode: 'insensitive' } }
        : {}),
      ...(query.nickname
        ? {
            user: {
              profile: {
                nickname: {
                  contains: query.nickname.trim(),
                  mode: 'insensitive',
                },
              },
            },
          }
        : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    return this.prisma.review.findMany({
      where,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        venue: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForApp(venueId: string): Promise<MergedAppReview[]> {
    await this.ensureVenueExists(venueId);

    const appReviewsPromise = this.prisma.review.findMany({
      where: {
        venueId,
        status: 'normal',
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const googleReviewsPromise = this.loadGoogleReviewsIfAvailable(venueId);

    const [appReviews, googleReviews] = await Promise.all([
      appReviewsPromise,
      googleReviewsPromise,
    ]);

    const merged: MergedAppReview[] = [];

    for (const r of appReviews) {
      const displayName =
        r.user.profile?.nickname?.trim() || r.user.email?.trim() || '泳者';
      merged.push({
        id: r.id,
        source: 'APP',
        content: r.content,
        createdAt: r.createdAt,
        user: {
          email: r.user.email,
          profile: r.user.profile
            ? { nickname: r.user.profile.nickname }
            : null,
          displayName,
          avatarUrl: r.user.profile?.avatarUrl ?? null,
        },
      });
    }

    for (const g of googleReviews) {
      merged.push({
        id: g.id,
        source: 'GOOGLE',
        content: g.text ?? '',
        createdAt: g.reviewedAt ?? g.fetchedAt,
        rating: g.rating,
        relativeTime: g.relativeTime ?? undefined,
        user: {
          displayName: g.authorName?.trim() || 'Google 用户',
          avatarUrl: g.authorAvatarUrl ?? null,
        },
      });
    }

    return merged;
  }

  async createForApp(venueId: string, userId: string, dto: AppCreateReviewDto) {
    await this.ensureVenueExists(venueId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user || user.status !== 'active') {
      throw new NotFoundException('用户不存在或已被禁用');
    }

    return this.prisma.review.create({
      data: {
        venueId,
        userId,
        content: dto.content.trim(),
        status: 'normal',
      },
      include: {
        user: {
          include: { profile: true },
        },
      },
    });
  }

  async updateStatus(
    reviewId: string,
    adminId: string,
    dto: UpdateReviewStatusDto,
  ) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('评价不存在');
    }

    const updatedReview = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        status: dto.status,
        moderatedByAdminId: adminId,
        moderatedAt: new Date(),
      },
    });

    if (review.status !== dto.status) {
      await this.prisma.reviewStatusLog.create({
        data: {
          reviewId,
          fromStatus: review.status,
          toStatus: dto.status,
          reason: dto.reason?.trim(),
          adminId,
        },
      });
    }

    return updatedReview;
  }

  private async ensureVenueExists(venueId: string) {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true },
    });

    if (!venue) {
      throw new NotFoundException('泳馆不存在');
    }
  }

  private async loadGoogleReviewsIfAvailable(venueId: string): Promise<
    Array<{
      id: string;
      authorName: string;
      authorAvatarUrl: string | null;
      rating: number;
      text: string | null;
      relativeTime: string | null;
      reviewedAt: Date | null;
      fetchedAt: Date;
    }>
  > {
    if (!this.googlePlacesClient.isConfigured()) {
      this.logger.log('[GoogleReviews] GOOGLE_PLACES_API_KEY not configured, skip');
      return [];
    }

    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
      select: {
        id: true,
        dataSource: true,
        externalIds: {
          where: { source: VenueDataSource.GOOGLE_PLACES },
          take: 1,
        },
      },
    });

    if (!venue) return [];
    if (venue.dataSource !== VenueDataSource.GOOGLE_PLACES) return [];

    const googleExternal = venue.externalIds[0];
    if (!googleExternal || !googleExternal.externalId) return [];
    const placeId = googleExternal.externalId;
    this.logger.log(`[GoogleReviews] venue=${venueId} place_id=${placeId} eligible for google reviews path`);

    const now = new Date();
    const refreshRow = await this.prisma.venueReviewsRefresh.findUnique({
      where: { venueId },
    });
    this.logger.log(
      `[GoogleReviews] venue=${venueId} refreshRow status=${refreshRow?.status ?? 'null'} nextFetchAt=${refreshRow?.nextFetchAt?.toISOString() ?? 'null'} retry=${refreshRow?.retryCount ?? 0}`,
    );

    const needFetch =
      !refreshRow ||
      (refreshRow.status === 'error' && refreshRow.retryCount < 3) ||
      refreshRow.nextFetchAt.getTime() <= now.getTime();
    this.logger.log(`[GoogleReviews] venue=${venueId} needFetch=${String(needFetch)}`);

    if (needFetch) {
      try {
        this.logger.log(`[GoogleReviews] venue=${venueId} place_id=${placeId} → calling Place Details`);
        await this.refreshGoogleReviews(venueId, placeId);
        this.logger.log(`[GoogleReviews] venue=${venueId} place_id=${placeId} → Place Details OK (no exception)`);
      } catch (e) {
        this.logger.error(
          `Failed to refresh Google reviews for venue=${venueId} place_id=${placeId}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }

    const rows = await this.prisma.googleVenueReview.findMany({
      where: {
        venueId,
        expiresAt: { gte: now },
        status: 'fresh',
      },
      orderBy: [{ reviewedAt: 'desc' }, { fetchedAt: 'desc' }],
      take: 10,
    });

    return rows.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      authorAvatarUrl: r.authorAvatarUrl ?? null,
      rating: r.rating,
      text: r.text ?? null,
      relativeTime: r.relativeTime ?? null,
      reviewedAt: r.reviewedAt ?? null,
      fetchedAt: r.fetchedAt,
    }));
  }

  private async refreshGoogleReviews(venueId: string, placeId: string) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DEFAULT_GOOGLE_REVIEWS_TTL_MS);

    let response: GooglePlaceDetailsResponse;
    try {
      this.logger.log(`[GoogleReviews] refreshGoogleReviews start: venue=${venueId} place_id=${placeId}`);
      response = await this.googlePlacesClient.fetchPlaceDetails(placeId);
      this.logger.log(`[GoogleReviews] refreshGoogleReviews HTTP ok: status=${response.status} hasResult=${String(!!response.result)}`);
    } catch (e) {
      this.logger.error(
        `[GoogleReviews] refreshGoogleReviews NETWORK_ERROR venue=${venueId} place_id=${placeId}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      await this.upsertRefreshRow(venueId, placeId, {
        status: 'error',
        lastError:
          e instanceof Error
            ? e.message.slice(0, 1024)
            : String(e).slice(0, 1024),
      });
      throw e;
    }

    const status = response.status || 'UNKNOWN';
    if (status !== 'OK' || !response.result) {
      const msg = response.error_message || `Google Places status=${status}`;
      this.logger.log(
        `[GoogleReviews] refreshGoogleReviews NON_OK venue=${venueId} place_id=${placeId} status=${status} msg=${msg}`,
      );
      await this.upsertRefreshRow(venueId, placeId, {
        status:
          status === 'ZERO_RESULTS' || status === 'NOT_FOUND'
            ? 'empty'
            : 'error',
        lastError: msg.slice(0, 1024),
      });
      return;
    }

    const result = response.result;
    const reviews: GooglePlaceReview[] = result.reviews ?? [];
    this.logger.log(
      `[GoogleReviews] refreshGoogleReviews OK venue=${venueId} place_id=${placeId} rating=${result.rating ?? 'null'} user_ratings_total=${result.user_ratings_total ?? 'null'} reviews=${reviews.length}`,
    );

    if (reviews.length === 0) {
      await this.upsertRefreshRow(venueId, placeId, {
        status: 'empty',
        rating: result.rating ?? null,
        totalReviews: result.user_ratings_total ?? null,
      });
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.googleVenueReview.deleteMany({
        where: { venueId, googlePlaceId: placeId },
      });

      for (const r of reviews) {
        const googleReviewId = [
          placeId,
          String(r.time || 0),
          (r.author_name || 'anon').slice(0, 32),
          String(r.rating || 0),
        ].join('::');

        const reviewedAt = r.time ? new Date(r.time * 1000) : null;

        try {
          await tx.googleVenueReview.create({
            data: {
              venueId,
              googlePlaceId: placeId,
              googleReviewId,
              authorName: (r.author_name || 'Google 用户').slice(0, 128),
              authorAvatarUrl: r.profile_photo_url?.slice(0, 1024) ?? null,
              rating: clampInt(r.rating ?? 0, 0, 5),
              text: r.text?.slice(0, 4000) ?? null,
              language: r.language?.slice(0, 16) ?? null,
              originalLanguage: r.original_language?.slice(0, 16) ?? null,
              relativeTime: r.relative_time_description?.slice(0, 128) ?? null,
              reviewedAt,
              fetchedAt: now,
              expiresAt,
              status: 'fresh',
              rawPayload: r as unknown as Prisma.InputJsonValue,
            },
          });
        } catch (dupErr) {
          if (
            dupErr instanceof Error &&
            String(dupErr.message).includes('Unique constraint')
          ) {
            continue;
          }
          throw dupErr;
        }
      }

      await this.upsertRefreshRow(
        venueId,
        placeId,
        {
          status: 'fresh',
          rating: result.rating ?? null,
          totalReviews: result.user_ratings_total ?? null,
          lastError: null,
        },
        tx,
      );
    });
  }

  private async upsertRefreshRow(
    venueId: string,
    placeId: string,
    data: {
      status: 'fresh' | 'missed' | 'empty' | 'error';
      rating?: number | null;
      totalReviews?: number | null;
      lastError?: string | null;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const now = new Date();
    const client = tx ?? this.prisma;
    const baseBackoffMs =
      data.status === 'error'
        ? Math.min(60 * 60 * 1000, 5 * 60 * 1000 * Math.pow(2, 0))
        : DEFAULT_GOOGLE_REVIEWS_TTL_MS;
    const nextFetchAt = new Date(now.getTime() + baseBackoffMs);

    try {
      await client.venueReviewsRefresh.upsert({
        where: { venueId },
        create: {
          venue: { connect: { id: venueId } },
          placeId,
          status: data.status,
          rating:
            data.rating != null
              ? new Prisma.Decimal(Number(data.rating).toFixed(2))
              : null,
          totalReviews: data.totalReviews ?? null,
          lastFetchedAt: now,
          nextFetchAt,
          lastError: data.lastError ?? null,
          retryCount: data.status === 'error' ? 1 : 0,
        },
        update: {
          placeId,
          status: data.status,
          rating:
            data.rating != null
              ? new Prisma.Decimal(Number(data.rating).toFixed(2))
              : null,
          totalReviews: data.totalReviews ?? null,
          lastFetchedAt: now,
          nextFetchAt,
          lastError: data.lastError ?? null,
          retryCount: data.status === 'error' ? { increment: 1 } : 0,
        },
      });
    } catch (e) {
      this.logger.warn(
        `Failed to upsert VenueReviewsRefresh venue=${venueId}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }
}

function clampInt(v: number, lo: number, hi: number): number {
  if (Number.isNaN(v)) return lo;
  if (v < lo) return lo;
  if (v > hi) return hi;
  return Math.round(v);
}
