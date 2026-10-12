-- ============================================================================
-- Migration 1127: Warmpawz Insurance admin foundation
-- ============================================================================
-- Insurance company registry, vendor <-> company links with versioned commission
-- terms, payout/reporting schedules, insurance applications (one per customer
-- outreach) with status history, and payout period tracking + reminders.
--
-- The customer pays the insurer directly. Warmpawz's commission is owed by the
-- vendor and is estimated from policies the vendor marks issued with evidence.
--
-- Legacy insurance_plans / insurance_policies / insurance_claims are untouched.
-- Additive and idempotent only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS insurance_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  legal_name TEXT,
  provider_code TEXT,
  logo_url TEXT,
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_insurance_companies_name
  ON insurance_companies (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS uq_insurance_companies_provider_code
  ON insurance_companies (LOWER(provider_code)) WHERE provider_code IS NOT NULL;

-- Vendor authorised to sell a company's products through Warmpawz.
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

-- Versioned Warmpawz <-> vendor commercial terms per link. The version in force on a
-- policy's issue date prices that policy.
--   percent_of_premium            rate = % of the policy premium
--   percent_of_vendor_commission  rate = % of the vendor's insurer commission
--                                 (actual when recorded, else premium x vendor_commission_rate)
--   fixed_per_policy              rate = rupees per issued policy
CREATE TABLE IF NOT EXISTS insurance_commission_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_company_id UUID NOT NULL REFERENCES insurance_vendor_companies(id),
  basis TEXT NOT NULL,
  rate NUMERIC(12, 4) NOT NULL,
  vendor_commission_rate NUMERIC(7, 4),
  gst_rate NUMERIC(7, 4) NOT NULL DEFAULT 0,
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

CREATE INDEX IF NOT EXISTS idx_insurance_commission_terms_link
  ON insurance_commission_terms (vendor_company_id, effective_from DESC);

-- Reporting / payout cadence. vendor_company_id NULL = platform default; a row with a
-- link id overrides the default for that link.
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

-- One customer insurance journey. booking_id links the consultation that started it.
-- A policy only counts as issued with its number, premium, issue time and document.
CREATE TABLE IF NOT EXISTS insurance_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  company_id UUID REFERENCES insurance_companies(id),
  pet_id UUID,
  status TEXT NOT NULL DEFAULT 'consultation_booked',
  policy_number TEXT,
  premium_amount NUMERIC(12, 2),
  vendor_commission_amount NUMERIC(12, 2),
  policy_issued_at TIMESTAMPTZ,
  policy_document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT insurance_applications_status_chk CHECK (status IN (
    'consultation_booked', 'form_required', 'form_submitted', 'vendor_processing',
    'vendor_review', 'payment_link_shared', 'awaiting_payment', 'payment_reported',
    'documents_uploaded', 'policy_issued', 'cancelled'
  )),
  CONSTRAINT insurance_applications_issued_evidence_chk CHECK (
    status <> 'policy_issued' OR (
      policy_number IS NOT NULL AND premium_amount IS NOT NULL
      AND policy_issued_at IS NOT NULL AND policy_document_url IS NOT NULL
      AND company_id IS NOT NULL
    )
  ),
  CONSTRAINT insurance_applications_amounts_chk CHECK (
    (premium_amount IS NULL OR premium_amount >= 0)
    AND (vendor_commission_amount IS NULL OR vendor_commission_amount >= 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_insurance_applications_booking
  ON insurance_applications (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_insurance_applications_vendor_status
  ON insurance_applications (vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_insurance_applications_issued
  ON insurance_applications (vendor_id, company_id, policy_issued_at)
  WHERE status = 'policy_issued';

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

-- Payout period state per link. Rows are created when admin acts on a period
-- (reminder or receipt); expected amounts are computed live from issued policies.
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

-- Admin RBAC: same grant pattern as 1090 (Warmpawz Appointments).
DO $$
DECLARE
  rid UUID;
  perm TEXT;
  perms TEXT[] := ARRAY[
    'admin.warmpawz_insurance',
    'admin.warmpawz_insurance.view',
    'admin.warmpawz_insurance.companies.write',
    'admin.warmpawz_insurance.payouts.write'
  ];
BEGIN
  FOR rid IN
    SELECT DISTINCT rp.role_id
    FROM role_permissions rp
    WHERE rp.permission_name IN ('admin.full_access', 'admin.warmpawz_insurance')
    UNION
    SELECT r.id FROM roles r WHERE r.name = 'admin_master' AND r.is_active = true
  LOOP
    FOREACH perm IN ARRAY perms LOOP
      INSERT INTO role_permissions (role_id, permission_name, resource, action, created_at)
      VALUES (rid, perm, '*', '*', NOW())
      ON CONFLICT (role_id, permission_name, resource, action) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
