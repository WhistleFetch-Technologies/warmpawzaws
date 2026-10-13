-- ============================================================================
-- Migration 1127: Warmpawz Insurance core tables
-- ============================================================================
-- Split from 1127_warmpawz_insurance_admin.sql. RBAC is 1128.
-- Status list matches packages/shared-types insurance-status.ts.
-- Legacy insurance_plans / insurance_policies / insurance_claims are untouched.
-- Additive and idempotent. Not applied before this revision.
-- ============================================================================

CREATE TABLE IF NOT EXISTS insurance_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  provider_code TEXT,
  logo_url TEXT,
  payment_link_domains TEXT[] NOT NULL DEFAULT '{}',
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  escalation_contact TEXT,
  products TEXT[] NOT NULL DEFAULT '{}',
  integration_mode TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT insurance_companies_integration_mode_chk
    CHECK (integration_mode IN ('manual', 'link', 'api')),
  CONSTRAINT insurance_companies_status_chk
    CHECK (status IN ('active', 'inactive'))
);

ALTER TABLE insurance_companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE insurance_companies ADD COLUMN IF NOT EXISTS payment_link_domains TEXT[] NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS uq_insurance_companies_name
  ON insurance_companies (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS uq_insurance_companies_provider_code
  ON insurance_companies (LOWER(provider_code)) WHERE provider_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS insurance_vendor_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  company_id UUID NOT NULL REFERENCES insurance_companies(id),
  authorisation_ref TEXT,
  agency_code TEXT,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT insurance_vendor_companies_status_chk
    CHECK (status IN ('active', 'suspended', 'ended')),
  CONSTRAINT insurance_vendor_companies_dates_chk
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_insurance_vendor_companies_pair
  ON insurance_vendor_companies (vendor_id, company_id);
CREATE INDEX IF NOT EXISTS idx_insurance_vendor_companies_company
  ON insurance_vendor_companies (company_id);

-- GST rate is required by the API. No default, so a missing rate cannot be stored as 0 by accident.
CREATE TABLE IF NOT EXISTS insurance_commission_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_company_id UUID NOT NULL REFERENCES insurance_vendor_companies(id),
  basis TEXT NOT NULL,
  rate NUMERIC(12, 4) NOT NULL,
  vendor_commission_rate NUMERIC(7, 4),
  gst_rate NUMERIC(7, 4) NOT NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT insurance_commission_terms_basis_chk
    CHECK (basis IN ('percent_of_premium', 'percent_of_vendor_commission', 'fixed_per_policy')),
  CONSTRAINT insurance_commission_terms_rate_chk CHECK (rate >= 0),
  CONSTRAINT insurance_commission_terms_pct_chk
    CHECK (basis = 'fixed_per_policy' OR rate <= 100),
  CONSTRAINT insurance_commission_terms_vendor_rate_chk
    CHECK (vendor_commission_rate IS NULL OR (vendor_commission_rate >= 0 AND vendor_commission_rate <= 100)),
  CONSTRAINT insurance_commission_terms_gst_chk CHECK (gst_rate >= 0 AND gst_rate <= 100)
);

ALTER TABLE insurance_commission_terms ALTER COLUMN gst_rate DROP DEFAULT;

CREATE INDEX IF NOT EXISTS idx_insurance_commission_terms_link
  ON insurance_commission_terms (vendor_company_id, effective_from DESC);

CREATE TABLE IF NOT EXISTS insurance_payout_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_company_id UUID REFERENCES insurance_vendor_companies(id),
  frequency TEXT NOT NULL DEFAULT 'monthly',
  anchor_date DATE NOT NULL DEFAULT DATE '2026-01-01',
  due_days_after_period_end INT NOT NULL DEFAULT 7,
  grace_days INT NOT NULL DEFAULT 3,
  reminder_days_before INT[] NOT NULL DEFAULT '{3,1}',
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT insurance_payout_schedules_frequency_chk
    CHECK (frequency IN ('weekly', 'fortnightly', 'twice_monthly', 'monthly', 'every_two_months')),
  CONSTRAINT insurance_payout_schedules_due_chk
    CHECK (due_days_after_period_end BETWEEN 0 AND 90),
  CONSTRAINT insurance_payout_schedules_grace_chk CHECK (grace_days BETWEEN 0 AND 60)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_insurance_payout_schedules_default
  ON insurance_payout_schedules ((vendor_company_id IS NULL)) WHERE vendor_company_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_insurance_payout_schedules_link
  ON insurance_payout_schedules (vendor_company_id) WHERE vendor_company_id IS NOT NULL;

INSERT INTO insurance_payout_schedules (vendor_company_id, frequency)
SELECT NULL, 'monthly'
WHERE NOT EXISTS (SELECT 1 FROM insurance_payout_schedules WHERE vendor_company_id IS NULL);

CREATE TABLE IF NOT EXISTS insurance_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  company_id UUID REFERENCES insurance_companies(id),
  plan_id UUID,
  pet_id UUID,
  status TEXT NOT NULL DEFAULT 'consultation_booked',
  policy_number TEXT,
  premium_amount NUMERIC(12, 2),
  quoted_premium NUMERIC(12, 2),
  issued_premium NUMERIC(12, 2),
  payment_link_expires_at TIMESTAMPTZ,
  vendor_commission_amount NUMERIC(12, 2),
  policy_issued_at TIMESTAMPTZ,
  policy_document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT insurance_applications_status_chk CHECK (status IN (
    'consultation_booked', 'consulted', 'quote_shared', 'form_sent', 'form_submitted',
    'changes_requested', 'form_confirmed', 'payment_link_sent', 'payment_link_expired',
    'payment_reported', 'policy_uploaded', 'policy_confirmed', 'free_look_cancelled',
    'dropped', 'cancelled'
  )),
  CONSTRAINT insurance_applications_amounts_chk CHECK (
    (premium_amount IS NULL OR premium_amount >= 0)
    AND (quoted_premium IS NULL OR quoted_premium >= 0)
    AND (issued_premium IS NULL OR issued_premium >= 0)
    AND (vendor_commission_amount IS NULL OR vendor_commission_amount >= 0)
  )
);

ALTER TABLE insurance_applications ADD COLUMN IF NOT EXISTS plan_id UUID;
ALTER TABLE insurance_applications ADD COLUMN IF NOT EXISTS quoted_premium NUMERIC(12, 2);
ALTER TABLE insurance_applications ADD COLUMN IF NOT EXISTS issued_premium NUMERIC(12, 2);
ALTER TABLE insurance_applications ADD COLUMN IF NOT EXISTS payment_link_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_insurance_applications_booking
  ON insurance_applications (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_insurance_applications_vendor_status
  ON insurance_applications (vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_insurance_applications_confirmed
  ON insurance_applications (vendor_id, company_id, policy_issued_at)
  WHERE status = 'policy_confirmed';

CREATE TABLE IF NOT EXISTS insurance_application_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES insurance_applications(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT insurance_application_events_actor_chk
    CHECK (actor_type IN ('system', 'vendor', 'admin', 'customer'))
);

CREATE INDEX IF NOT EXISTS idx_insurance_application_events_app
  ON insurance_application_events (application_id, created_at);

CREATE TABLE IF NOT EXISTS insurance_payout_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_company_id UUID NOT NULL REFERENCES insurance_vendor_companies(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  due_date DATE NOT NULL,
  received_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  received_at TIMESTAMPTZ,
  received_reference TEXT,
  last_reminded_at TIMESTAMPTZ,
  reminder_count INT NOT NULL DEFAULT 0,
  notes TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT insurance_payout_periods_dates_chk CHECK (period_end >= period_start),
  CONSTRAINT insurance_payout_periods_received_chk CHECK (received_amount >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_insurance_payout_periods_link_period
  ON insurance_payout_periods (vendor_company_id, period_start, period_end);

CREATE TABLE IF NOT EXISTS insurance_payout_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_period_id UUID NOT NULL REFERENCES insurance_payout_periods(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  expected_amount NUMERIC(12, 2) NOT NULL,
  trigger TEXT NOT NULL DEFAULT 'manual',
  sent_by TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT insurance_payout_reminders_trigger_chk CHECK (trigger IN ('manual', 'scheduled'))
);

CREATE INDEX IF NOT EXISTS idx_insurance_payout_reminders_period
  ON insurance_payout_reminders (payout_period_id, sent_at DESC);
