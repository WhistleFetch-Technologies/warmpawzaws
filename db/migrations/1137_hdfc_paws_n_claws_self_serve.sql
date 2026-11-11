-- ============================================================================
-- Migration 1137: HDFC ERGO Paws N Claws self-serve enquiry support
-- ============================================================================
-- Additive: coverage_selection + health_declarations on applications,
-- enquiry_submitted status, seeded HDFC company/plan (demo), optional vendor link.
-- Does not overwrite production customer data. Seed IDs are fixed UUIDs for DEV.
-- ============================================================================

ALTER TABLE insurance_applications
  ADD COLUMN IF NOT EXISTS coverage_selection JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE insurance_applications
  ADD COLUMN IF NOT EXISTS health_declarations JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE insurance_applications
  ADD COLUMN IF NOT EXISTS application_source TEXT NOT NULL DEFAULT 'consultation';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'insurance_applications_source_chk'
  ) THEN
    ALTER TABLE insurance_applications
      ADD CONSTRAINT insurance_applications_source_chk
      CHECK (application_source IN ('consultation', 'self_serve'));
  END IF;
END $$;

ALTER TABLE insurance_applications
  ALTER COLUMN booking_id DROP NOT NULL;

ALTER TABLE insurance_applications DROP CONSTRAINT IF EXISTS insurance_applications_status_chk;
ALTER TABLE insurance_applications
  ADD CONSTRAINT insurance_applications_status_chk CHECK (status IN (
    'enquiry_submitted',
    'consultation_booked', 'consulted', 'quote_shared', 'form_sent', 'form_submitted',
    'changes_requested', 'form_confirmed', 'payment_link_sent', 'payment_link_expired',
    'payment_reported', 'policy_uploaded', 'policy_confirmed', 'free_look_cancelled',
    'dropped', 'cancelled'
  ));

-- Seed HDFC ERGO company (demo configuration — not a live API integration)
DO $$
DECLARE
  company_uuid UUID := 'b1111111-1111-4111-8111-111111111101'::uuid;
  plan_uuid UUID := 'b2222222-2222-4222-8222-222222222201'::uuid;
  existing_id UUID;
BEGIN
  SELECT id INTO existing_id
  FROM insurance_companies
  WHERE id = company_uuid OR lower(COALESCE(provider_code, '')) = 'hdfc_ergo'
  LIMIT 1;

  IF existing_id IS NULL THEN
    INSERT INTO insurance_companies (
      id, name, legal_name, provider_code, payment_link_domains,
      products, integration_mode, status, notes, description
    ) VALUES (
      company_uuid,
      'HDFC ERGO',
      'HDFC ERGO General Insurance Company Limited',
      'HDFC_ERGO',
      ARRAY['hdfcergo.com', 'www.hdfcergo.com']::text[],
      ARRAY['Paws N Claws Pet Insurance']::text[],
      'link',
      'active',
      'DEMO_SEED: seeded for Warmpawz × HDFC ERGO demo. Not an API integration.',
      'Paws N Claws Pet Insurance — Comprehensive, Make Your Own Plan, and Third-Party Liability. Waiting period and exclusions per leaflet.'
    );
    existing_id := company_uuid;
  ELSE
    UPDATE insurance_companies SET
      legal_name = 'HDFC ERGO General Insurance Company Limited',
      provider_code = 'HDFC_ERGO',
      payment_link_domains = ARRAY['hdfcergo.com', 'www.hdfcergo.com']::text[],
      products = ARRAY['Paws N Claws Pet Insurance']::text[],
      integration_mode = 'link',
      status = 'active',
      notes = COALESCE(notes, '') || CASE WHEN notes LIKE '%DEMO_SEED%' THEN '' ELSE ' DEMO_SEED' END,
      description = COALESCE(
        description,
        'Paws N Claws Pet Insurance — Comprehensive, Make Your Own Plan, and Third-Party Liability.'
      ),
      updated_at = NOW()
    WHERE id = existing_id;
    company_uuid := existing_id;
  END IF;

  INSERT INTO insurance_company_plans (
    id, company_id, name, product_type, highlights,
    premium_from, premium_unit, cover_options, sum_insured_options, copay_options,
    status, sort_order, created_by
  )
  VALUES (
    plan_uuid,
    company_uuid,
    'Paws N Claws Pet Insurance',
    'pet',
    '["All-round protection","Customisable plans","Expert assistance"]'::jsonb,
    0,
    'year',
    '[
      {"key":"comprehensive","label":"Comprehensive Cover","description":"Injury, illness, surgery, diagnostic & treatment"},
      {"key":"make_your_own","label":"Make Your Own Plan","description":"Choose Injury, Illness, and/or Surgery"},
      {"key":"third_party","label":"Third-Party Liability","description":"Bodily injury and property damage liability"}
    ]'::jsonb,
    '["10000","25000","50000","100000","200000","1000000","10000000"]'::jsonb,
    '["10","20","30"]'::jsonb,
    'published',
    0,
    'demo-seed'
  )
  ON CONFLICT (id) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    name = EXCLUDED.name,
    highlights = EXCLUDED.highlights,
    cover_options = EXCLUDED.cover_options,
    sum_insured_options = EXCLUDED.sum_insured_options,
    copay_options = EXCLUDED.copay_options,
    status = 'published',
    updated_at = NOW();
END $$;

-- Link first active insurance-role vendor if present (idempotent)
INSERT INTO insurance_vendor_companies (
  vendor_id, company_id, status, notes, created_by
)
SELECT v.id,
       'b1111111-1111-4111-8111-111111111101'::uuid,
       'active',
       'DEMO_SEED: auto-linked for Paws N Claws demo',
       'demo-seed'
FROM vendors v
JOIN roles r ON r.id = v.role_id
WHERE v.is_active = true
  AND lower(COALESCE(v.status, '')) IN ('approved', 'active', 'live')
  AND lower(r.name) IN ('insurance', 'pet_insurance')
ORDER BY v.created_at ASC NULLS LAST
LIMIT 1
ON CONFLICT (vendor_id, company_id) DO NOTHING;
