-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "WaterQualityReportSource" AS ENUM ('MANUAL', 'SWIMMABLE_PUBLIC_DEMO', 'SWIMMABLE_AUTHENTICATED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "water_quality_reports" ADD COLUMN IF NOT EXISTS "source" "WaterQualityReportSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "water_quality_reports" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ(6);
ALTER TABLE "water_quality_reports" ADD COLUMN IF NOT EXISTS "raw_response" JSONB;
ALTER TABLE "water_quality_reports" ALTER COLUMN "created_by_admin_id" DROP NOT NULL;

-- CreateIndex (idempotent via DO block)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'water_quality_reports_venue_id_source_idx'
      AND n.nspname = 'public'
  ) THEN
    CREATE INDEX "water_quality_reports_venue_id_source_idx" ON "water_quality_reports"("venue_id", "source");
  END IF;
END $$;
