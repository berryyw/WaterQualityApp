-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "AdminStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('admin');

-- CreateEnum
CREATE TYPE "CityStatus" AS ENUM ('enabled', 'disabled');

-- CreateEnum
CREATE TYPE "VenueStatus" AS ENUM ('normal', 'disabled');

-- CreateEnum
CREATE TYPE "VenueImageType" AS ENUM ('cover');

-- CreateEnum
CREATE TYPE "PoolQualityGrade" AS ENUM ('excellent', 'good', 'attention');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('normal', 'disabled', 'deleted');

-- CreateEnum
CREATE TYPE "FollowStatus" AS ENUM ('active', 'canceled');

-- CreateEnum
CREATE TYPE "FollowEventType" AS ENUM ('follow', 'unfollow');

-- CreateEnum
CREATE TYPE "EmailCodePurpose" AS ENUM ('register', 'change_password', 'change_email');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(128) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "email_verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "user_id" UUID NOT NULL,
    "nickname" VARCHAR(64) NOT NULL,
    "avatar_key" VARCHAR(255),
    "avatar_url" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "device_info" JSONB,
    "ip" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_accounts" (
    "id" UUID NOT NULL,
    "account" VARCHAR(64) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'admin',
    "status" "AdminStatus" NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "token_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "ip" VARCHAR(64),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "status" "CityStatus" NOT NULL DEFAULT 'enabled',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "district" VARCHAR(64) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "summary" TEXT,
    "image_caption" VARCHAR(128),
    "status" "VenueStatus" NOT NULL DEFAULT 'normal',
    "followers_count" INTEGER NOT NULL DEFAULT 0,
    "ranking_momentum" INTEGER NOT NULL DEFAULT 0,
    "opened_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_images" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "file_key" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "type" "VenueImageType" NOT NULL DEFAULT 'cover',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venue_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "water_quality_reports" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "grade" "PoolQualityGrade" NOT NULL,
    "note" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "turbidity" DECIMAL(6,2) NOT NULL,
    "water_temperature" DECIMAL(6,2) NOT NULL,
    "ph_value" DECIMAL(4,2) NOT NULL,
    "free_chlorine" DECIMAL(6,2) NOT NULL,
    "combined_chlorine" DECIMAL(6,2) NOT NULL,
    "orp" INTEGER NOT NULL,
    "bacterial_count" VARCHAR(64) NOT NULL,
    "total_coliforms" VARCHAR(64) NOT NULL,
    "urea" DECIMAL(6,2) NOT NULL,
    "cyanuric_acid" DECIMAL(6,2) NOT NULL,
    "tds" INTEGER NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "created_by_admin_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "water_quality_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" VARCHAR(200) NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'normal',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "moderated_by_admin_id" UUID,
    "moderated_at" TIMESTAMPTZ(6),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_status_logs" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "from_status" "ReviewStatus" NOT NULL,
    "to_status" "ReviewStatus" NOT NULL,
    "reason" TEXT,
    "admin_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canceled_at" TIMESTAMPTZ(6),
    "status" "FollowStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_events" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_type" "FollowEventType" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_codes" (
    "id" UUID NOT NULL,
    "email" VARCHAR(128) NOT NULL,
    "purpose" "EmailCodePurpose" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "send_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "target_type" VARCHAR(64) NOT NULL,
    "target_id" UUID,
    "payload" JSONB,
    "ip" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_id_key" ON "user_sessions"("token_id");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_created_at_idx" ON "user_sessions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "admin_accounts_account_key" ON "admin_accounts"("account");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_token_id_key" ON "admin_sessions"("token_id");

-- CreateIndex
CREATE INDEX "admin_sessions_admin_id_created_at_idx" ON "admin_sessions"("admin_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "cities_code_key" ON "cities"("code");

-- CreateIndex
CREATE INDEX "venues_city_id_status_idx" ON "venues"("city_id", "status");

-- CreateIndex
CREATE INDEX "venue_images_venue_id_type_idx" ON "venue_images"("venue_id", "type");

-- CreateIndex
CREATE INDEX "water_quality_reports_venue_id_updated_at_idx" ON "water_quality_reports"("venue_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "water_quality_reports_venue_id_is_current_idx" ON "water_quality_reports"("venue_id", "is_current");

-- CreateIndex
CREATE INDEX "reviews_venue_id_status_created_at_idx" ON "reviews"("venue_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reviews_user_id_created_at_idx" ON "reviews"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "review_status_logs_review_id_created_at_idx" ON "review_status_logs"("review_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "follows_user_id_status_idx" ON "follows"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "follows_venue_id_user_id_key" ON "follows"("venue_id", "user_id");

-- CreateIndex
CREATE INDEX "follow_events_venue_id_created_at_idx" ON "follow_events"("venue_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "follow_events_user_id_created_at_idx" ON "follow_events"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "email_verification_codes_email_purpose_created_at_idx" ON "email_verification_codes"("email", "purpose", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_admin_id_created_at_idx" ON "audit_logs"("admin_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venues" ADD CONSTRAINT "venues_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_images" ADD CONSTRAINT "venue_images_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_quality_reports" ADD CONSTRAINT "water_quality_reports_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "water_quality_reports" ADD CONSTRAINT "water_quality_reports_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderated_by_admin_id_fkey" FOREIGN KEY ("moderated_by_admin_id") REFERENCES "admin_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_status_logs" ADD CONSTRAINT "review_status_logs_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_events" ADD CONSTRAINT "follow_events_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_events" ADD CONSTRAINT "follow_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

