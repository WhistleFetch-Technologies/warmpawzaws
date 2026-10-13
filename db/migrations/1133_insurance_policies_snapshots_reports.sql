-- ============================================================================
-- Migration 1133: Issued policies, commission snapshots, completion reports
-- ============================================================================

CREATE TABLE IF NOT EXISTS insurance_policies_issued (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES insurance_applications(id),
  policy_number TEXT NOT NULL,
  issued_premium NUMERIC(12, 2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  confirmed_by TEXT,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  CONSTRAINT insurance_policies_issued_premium_chk CHECK (issued_premium >= 0),
  CONSTRAINT insurance_policies_issued_dates_chk CHECK (end_date >= start_date),
  CONSTRAINT insurance_policies_issued_confirmed_by_chk
    CHECK (confirmed_by IS NULL OR confirmed_by IN ('customer', 'auto'))
);

CREATE TABLE IF NOT EXISTS insurance_commission_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES insurance_applications(id),
  link_id UUID,
  terms_id UUID,
  kind TEXT NOT NULL,
  basis TEXT NOT NULL,
  rate NUMERIC(12, 4) NOT NULL,
  vendor_commission_rate NUMERIC(8, 4),
  base_amount NUMERIC(12, 2) NOT NULL,
  commission_amount NUMERIC(12, 2) NOT NULL,
  gst_rate NUMERIC(8, 4) NOT NULL,
  gst_amount NUMERIC(12, 2) NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT insurance_commission_snapshots_kind_chk CHECK (kind IN ('confirm', 'clawback')),
  CONSTRAINT insurance_commission_snapshots_unique UNIQUE (application_id, kind)
);

CREATE TABLE IF NOT EXISTS insurance_completion_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_company_id UUID NOT NULL REFERENCES insurance_vendor_companies(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  reported_policy_count INT NOT NULL DEFAULT 0,
  reported_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  expected_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  variance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMPTZ,
  reviewed_by TEXT,
  review_note TEXT,
  CONSTRAINT insurance_completion_reports_status_chk
    CHECK (status IN ('draft', 'submitted', 'accepted', 'disputed')),
  CONSTRAINT insurance_completion_reports_unique UNIQUE (vendor_company_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS insurance_payout_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_company_id UUID NOT NULL REFERENCES insurance_vendor_companies(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  tds_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  utr TEXT,
  received_on DATE NOT NULL,
  recorded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT insurance_payout_receipts_amount_chk CHECK (amount >= 0 AND tds_amount >= 0)
);

ALTER TABLE insurance_payout_periods ADD COLUMN IF NOT EXISTS completion_report_id UUID;
ALTER TABLE insurance_payout_periods ADD COLUMN IF NOT EXISTS tds_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE insurance_applications ADD COLUMN IF NOT EXISTS payment_link_url TEXT;
