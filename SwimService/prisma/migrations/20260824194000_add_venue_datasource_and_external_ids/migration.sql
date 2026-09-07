-- CreateEnum
CREATE TYPE "VenueDataSource" AS ENUM ('MANUAL', 'AMAP_POI', 'GOOGLE_PLACES', 'GOV_LICENSE');

-- AlterTable
ALTER TABLE "venues" ADD COLUMN "snapped_latitude" DECIMAL(10,4);
ALTER TABLE "venues" ADD COLUMN "snapped_longitude" DECIMAL(10,4);
ALTER TABLE "venues" ADD COLUMN "data_source" "VenueDataSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "venues" ADD COLUMN "last_ingested_at" TIMESTAMPTZ(6);

-- Backfill snapped coordinates for existing venues
UPDATE "venues"
SET "snapped_latitude"  = ROUND("latitude"::numeric, 4),
    "snapped_longitude" = ROUND("longitude"::numeric, 4)
WHERE "snapped_latitude" IS NULL OR "snapped_longitude" IS NULL;

-- CreateTable
CREATE TABLE "venue_external_ids" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venue_id" UUID NOT NULL,
    "source" "VenueDataSource" NOT NULL,
    "external_id" VARCHAR(255) NOT NULL,
    "raw_name" VARCHAR(128),
    "raw_address" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venue_external_ids_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "venue_external_ids_source_external_id_key"
    ON "venue_external_ids"("source", "external_id");

-- CreateIndex
CREATE INDEX "venue_external_ids_venue_id_idx"
    ON "venue_external_ids"("venue_id");

-- CreateIndex
CREATE INDEX "venues_city_id_data_source_idx"
    ON "venues"("city_id", "data_source");

-- CreateIndex
CREATE INDEX "venues_snapped_latitude_snapped_longitude_idx"
    ON "venues"("snapped_latitude", "snapped_longitude");

-- AddForeignKey
ALTER TABLE "venue_external_ids"
    ADD CONSTRAINT "venue_external_ids_venue_id_fkey"
    FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
