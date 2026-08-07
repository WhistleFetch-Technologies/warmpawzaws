-- ============================================================================
-- Migration 1089: Warmpawz Appointments vendor catalogue (Phase A)
-- ============================================================================
-- Purpose: Admin-curated appointment vendors with flat appointment_fee per row.
-- Idempotent, additive only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS warmpawz_appointments_vendor_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL,
    appointment_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
    publish_status TEXT NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'warmpawz_appointments_vendor_catalog'::regclass
      AND conname = 'wappt_catalog_publish_status_chk'
  ) THEN
    ALTER TABLE warmpawz_appointments_vendor_catalog
      ADD CONSTRAINT wappt_catalog_publish_status_chk
      CHECK (publish_status IN ('draft', 'published'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'warmpawz_appointments_vendor_catalog'::regclass
      AND conname = 'wappt_catalog_fee_nonneg_chk'
  ) THEN
    ALTER TABLE warmpawz_appointments_vendor_catalog
      ADD CONSTRAINT wappt_catalog_fee_nonneg_chk
      CHECK (appointment_fee >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wappt_catalog_vendor_id_fkey'
  ) THEN
    ALTER TABLE warmpawz_appointments_vendor_catalog
      ADD CONSTRAINT wappt_catalog_vendor_id_fkey
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wappt_catalog_vendor_id
  ON warmpawz_appointments_vendor_catalog (vendor_id);

CREATE INDEX IF NOT EXISTS idx_wappt_catalog_published
  ON warmpawz_appointments_vendor_catalog (publish_status)
  WHERE publish_status = 'published';

COMMENT ON TABLE warmpawz_appointments_vendor_catalog IS
  'Warmpawz Appointments admin catalogue ΓÇö one row per vendor with flat appointment_fee. Customer visibility requires publish_status = published and vendor approved/active.';

COMMENT ON COLUMN warmpawz_appointments_vendor_catalog.appointment_fee IS
  'Flat appointment booking fee (INR). Server authority at checkout.';

COMMENT ON COLUMN warmpawz_appointments_vendor_catalog.publish_status IS
  'Publishing state: draft (hidden) or published (eligible for customer list when vendor is approved/active).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'warmpawz_appointments_vendor_catalog'
  ) THEN
    RAISE WARNING '1083 validation: warmpawz_appointments_vendor_catalog table missing';
  ELSE
    RAISE NOTICE '1083 validation: warmpawz_appointments_vendor_catalog present';
  END IF;
END $$;
