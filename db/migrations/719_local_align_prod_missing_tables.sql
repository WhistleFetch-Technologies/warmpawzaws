-- ============================================================================
-- 719: Create tables present on prod RDS but missing on local (schema only)
-- ============================================================================
-- Idempotent: CREATE IF NOT EXISTS + DO blocks where shape may vary.
-- Does not copy prod row data. Seeds only booking_state_transitions policy
-- rows (platform config), same as historical migrations.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- boarding_facilities (021_vendor_specialized_config_tables)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS boarding_facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    has_daycare BOOLEAN DEFAULT false,
    has_boarding BOOLEAN DEFAULT false,
    amenities JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vendor_id)
);
CREATE INDEX IF NOT EXISTS idx_boarding_facilities_vendor_id ON boarding_facilities(vendor_id);

CREATE OR REPLACE FUNCTION update_vendor_specialized_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_boarding_facilities_updated_at ON boarding_facilities;
CREATE TRIGGER trigger_update_boarding_facilities_updated_at
    BEFORE UPDATE ON boarding_facilities
    FOR EACH ROW
    EXECUTE FUNCTION update_vendor_specialized_config_updated_at();

-- ---------------------------------------------------------------------------
-- booking_policies (540)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    service_type TEXT,
    policy_type TEXT NOT NULL CHECK (policy_type IN (
        'cancellation', 'refund', 'rescheduling', 'no_show', 'payment', 'general'
    )),
    policy_name TEXT NOT NULL,
    rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_booking_policies_vendor_service ON booking_policies(vendor_id, service_type) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_policies_service_type ON booking_policies(service_type) WHERE service_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_policies_policy_type ON booking_policies(policy_type);
CREATE INDEX IF NOT EXISTS idx_booking_policies_active ON booking_policies(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_booking_policies_priority ON booking_policies(priority DESC);

-- ---------------------------------------------------------------------------
-- booking_state_transitions (011 + later transition inserts)
-- Prod uses composite PK (from_status, to_status) and column "allowed".
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS booking_state_transitions (
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    allowed BOOLEAN DEFAULT true,
    requires_otp BOOLEAN DEFAULT false,
    requires_payment BOOLEAN DEFAULT false,
    requires_refund_check BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (from_status, to_status)
);

INSERT INTO booking_state_transitions (from_status, to_status, allowed, requires_otp, requires_payment, requires_refund_check) VALUES
    ('pending', 'confirmed', true, false, true, false),
    ('pending', 'cancelled', true, false, false, true),
    ('confirmed', 'in_progress', true, false, false, false),
    ('confirmed', 'cancelled', true, false, false, true),
    ('in_progress', 'completed', true, true, false, false),
    ('in_progress', 'cancelled', true, false, false, true),
    ('completed', 'settlement', true, false, false, false),
    ('*', 'cancelled', true, false, false, true),
    ('*', 'rescheduled', true, false, false, false),
    ('*', 'no_show', true, false, false, true)
ON CONFLICT (from_status, to_status) DO NOTHING;

INSERT INTO booking_state_transitions (from_status, to_status, allowed) VALUES
    ('confirmed', 'arrived', true),
    ('arrived', 'in_progress', true),
    ('arrived', 'cancelled', true),
    ('arrived', 'completed', true)
ON CONFLICT (from_status, to_status) DO NOTHING;

INSERT INTO booking_state_transitions (from_status, to_status, allowed, requires_otp, requires_payment)
VALUES ('confirmed', 'completed', true, false, false)
ON CONFLICT (from_status, to_status)
DO UPDATE SET allowed = true, requires_otp = false, requires_payment = false;

-- ---------------------------------------------------------------------------
-- customer_payment_methods (1003)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  payment_type TEXT NOT NULL,
  razorpay_token TEXT,
  card_last4 TEXT,
  card_brand TEXT,
  card_holder_name TEXT,
  card_expiry_month TEXT,
  card_expiry_year TEXT,
  upi_id TEXT,
  bank_name TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_customer_id
  ON customer_payment_methods (customer_id);

-- ---------------------------------------------------------------------------
-- customer_tiers (used by loyalty-points-service; no standalone migration)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_tiers (
  customer_id UUID PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'standard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_tiers_tier ON customer_tiers(tier);

-- ---------------------------------------------------------------------------
-- disputes (010)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  order_id UUID REFERENCES orders(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  dispute_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'closed')),
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- holiday_bookings (018; FK aligned to local holiday_packages PK = id UUID)
-- Prod 018 uses TEXT package_id → holiday_packages(package_id); many locals
-- only have holiday_packages.id — reference id so the migration applies.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS holiday_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT NOT NULL UNIQUE,
    package_id UUID NOT NULL REFERENCES holiday_packages(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    selected_start_date DATE NOT NULL,
    selected_end_date DATE NOT NULL,
    travelers JSONB NOT NULL DEFAULT '{}'::jsonb,
    pricing JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
    is_group_tour BOOLEAN DEFAULT false,
    group_members JSONB DEFAULT '[]'::jsonb,
    special_requests TEXT,
    dietary_requirements TEXT,
    cancellation_reason TEXT,
    refund_amount NUMERIC(10, 2),
    payment_id TEXT,
    payment_method TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_holiday_bookings_package_id ON holiday_bookings(package_id);
CREATE INDEX IF NOT EXISTS idx_holiday_bookings_customer_id ON holiday_bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_holiday_bookings_vendor_id ON holiday_bookings(vendor_id);
CREATE INDEX IF NOT EXISTS idx_holiday_bookings_status ON holiday_bookings(status);
CREATE INDEX IF NOT EXISTS idx_holiday_bookings_dates ON holiday_bookings(selected_start_date, selected_end_date);

-- ---------------------------------------------------------------------------
-- mating_requests (runtime DDL from specialized-service-flows + FKs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mating_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    to_pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    from_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    to_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    message TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    accepted_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- package_services (010)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS package_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(package_id, service_id)
);

-- ---------------------------------------------------------------------------
-- payout_policies: prefer 028 shape (policy_key) if table does not exist
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payout_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT UNIQUE NOT NULL DEFAULT 'default',
  hold_period_days INTEGER NOT NULL DEFAULT 7,
  auto_payout BOOLEAN NOT NULL DEFAULT false,
  min_payout_amount NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
  payout_period TEXT NOT NULL DEFAULT 'weekly' CHECK (payout_period IN ('daily', 'weekly', 'biweekly', 'monthly')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO payout_policies (policy_key, hold_period_days, auto_payout, min_payout_amount, payout_period)
VALUES ('default', 7, false, 1000.00, 'weekly')
ON CONFLICT (policy_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- referral_redemptions (704) — DDL only
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS referral_redemptions_referred_id_uidx
  ON referral_redemptions (referred_id);
CREATE UNIQUE INDEX IF NOT EXISTS referral_redemptions_referral_referred_uidx
  ON referral_redemptions (referral_id, referred_id);
CREATE INDEX IF NOT EXISTS referral_redemptions_referral_id_idx
  ON referral_redemptions (referral_id);

-- ---------------------------------------------------------------------------
-- service_publishing (010)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_publishing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  publish_status TEXT NOT NULL DEFAULT 'draft' CHECK (publish_status IN ('draft', 'pending', 'published', 'rejected')),
  service_style TEXT NOT NULL CHECK (service_style IN ('at_center', 'at_home', 'tele', 'at_clinic', 'video_consultation', 'home_visit')),
  published_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_id, vendor_id, service_style)
);
CREATE INDEX IF NOT EXISTS idx_service_publishing_vendor_status ON service_publishing(vendor_id, publish_status);
CREATE INDEX IF NOT EXISTS idx_service_publishing_style_status ON service_publishing(service_style, publish_status);

-- ---------------------------------------------------------------------------
-- settlement_rules (550)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settlement_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name TEXT NOT NULL,
    description TEXT,
    rule_type TEXT NOT NULL DEFAULT 'settlement',
    conditions JSONB DEFAULT '{}'::jsonb,
    actions JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_settlement_rules_priority ON settlement_rules(priority);
CREATE INDEX IF NOT EXISTS idx_settlement_rules_active ON settlement_rules(is_active) WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- tax_category_roles (701) — FK requires PK or UNIQUE on service_categories.id
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'service_categories'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = current_schema()
      AND t.relname = 'service_categories'
      AND c.contype = 'p'
  ) THEN
    ALTER TABLE service_categories
      ADD CONSTRAINT service_categories_pkey PRIMARY KEY (id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tax_category_roles (
  tax_category_id UUID NOT NULL REFERENCES tax_categories(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  catalog_category_id UUID NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (tax_category_id, role_id),
  CONSTRAINT uq_tax_category_roles_catalog_role UNIQUE (catalog_category_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_tax_category_roles_catalog ON tax_category_roles(catalog_category_id);

-- ---------------------------------------------------------------------------
-- tele_sessions, tele_queues (010_gps_tele_tables)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tele_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    staff_id UUID NOT NULL REFERENCES staff(id),
    call_status TEXT NOT NULL DEFAULT 'ringing' CHECK (call_status IN ('ringing', 'active', 'ended', 'rejected', 'cancelled')),
    initiated_by TEXT NOT NULL CHECK (initiated_by IN ('customer', 'staff')),
    initiated_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    ended_by TEXT CHECK (ended_by IN ('customer', 'staff')),
    duration_seconds INTEGER DEFAULT 0,
    session_link TEXT,
    meeting_id TEXT,
    attendee_tokens JSONB,
    chat_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tele_sessions_booking ON tele_sessions(booking_id);
CREATE INDEX IF NOT EXISTS idx_tele_sessions_customer ON tele_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_tele_sessions_staff ON tele_sessions(staff_id);
CREATE INDEX IF NOT EXISTS idx_tele_sessions_status ON tele_sessions(call_status);

CREATE TABLE IF NOT EXISTS tele_queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id TEXT NOT NULL,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    queue_position INTEGER NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_at TIMESTAMPTZ,
    estimated_wait_minutes INTEGER,
    waiting_time_seconds INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'assigned', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tele_queues_role ON tele_queues(role_id);
CREATE INDEX IF NOT EXISTS idx_tele_queues_booking ON tele_queues(booking_id);
CREATE INDEX IF NOT EXISTS idx_tele_queues_status ON tele_queues(status);
CREATE INDEX IF NOT EXISTS idx_tele_queues_role_status ON tele_queues(role_id, status);

-- ---------------------------------------------------------------------------
-- vendor_subscription_plans (033)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendor_subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id TEXT NOT NULL UNIQUE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    interval TEXT NOT NULL CHECK (interval IN ('monthly', 'yearly')),
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vendor_subscription_plans_vendor ON vendor_subscription_plans(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_subscription_plans_plan_id ON vendor_subscription_plans(plan_id);
CREATE INDEX IF NOT EXISTS idx_vendor_subscription_plans_active ON vendor_subscription_plans(is_active) WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- schema_migrations — generic ledger if tooling expects a table name only
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
