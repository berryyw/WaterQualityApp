-- Add Google Reviews Cache tables + refresh queue
-- Generated = 2026-09-07T23:50:00Z

CREATE TYPE "GoogleReviewFetchStatus" AS ENUM ('fresh', 'missed', 'empty', 'error');

CREATE TABLE IF NOT EXISTS "google_venue_reviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "venue_id" UUID NOT NULL,
  "google_place_id" VARCHAR(255) NOT NULL,
  "google_review_id" VARCHAR(255) NOT NULL,
  "author_name" VARCHAR(128) NOT NULL,
  "author_avatar_url" VARCHAR(1024),
  "rating" INTEGER NOT NULL,
  "text" VARCHAR(4000),
  "language" VARCHAR(16),
  "original_language" VARCHAR(16),
  "relative_time" VARCHAR(128),
  "reviewed_at" TIMESTAMPTZ(6),
  "fetched_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "status" "GoogleReviewFetchStatus" NOT NULL DEFAULT 'fresh',
  "raw_payload" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "google_venue_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "google_venue_reviews_venue_id_google_review_id_key"
  ON "google_venue_reviews"("venue_id", "google_review_id");

CREATE INDEX IF NOT EXISTS "google_venue_reviews_venue_id_expires_at_idx"
  ON "google_venue_reviews"("venue_id", "expires_at");

CREATE INDEX IF NOT EXISTS "google_venue_reviews_google_place_id_idx"
  ON "google_venue_reviews"("google_place_id");

ALTER TABLE "google_venue_reviews" DROP CONSTRAINT IF EXISTS "google_venue_reviews_venue_id_fkey";
ALTER TABLE "google_venue_reviews"
  ADD CONSTRAINT "google_venue_reviews_venue_id_fkey"
  FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "venue_reviews_refreshes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "venue_id" UUID NOT NULL,
  "place_id" VARCHAR(255) NOT NULL,
  "status" "GoogleReviewFetchStatus" NOT NULL DEFAULT 'missed',
  "rating" DECIMAL(3,2),
  "total_reviews" INTEGER,
  "last_fetched_at" TIMESTAMPTZ(6),
  "next_fetch_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "last_error" VARCHAR(1024),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "venue_reviews_refreshes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "venue_reviews_refreshes_venue_id_key"
  ON "venue_reviews_refreshes"("venue_id");

CREATE INDEX IF NOT EXISTS "venue_reviews_refreshes_next_fetch_at_status_idx"
  ON "venue_reviews_refreshes"("next_fetch_at", "status");

ALTER TABLE "venue_reviews_refreshes" DROP CONSTRAINT IF EXISTS "venue_reviews_refreshes_venue_id_fkey";
ALTER TABLE "venue_reviews_refreshes"
  ADD CONSTRAINT "venue_reviews_refreshes_venue_id_fkey"
  FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
