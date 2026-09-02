-- ============================================================================
-- MIGRATION 1104: Events tickets, payment link, and Events capability grants
-- ============================================================================
-- Additive / idempotent. Safe on DEV (events exists) and PROD (events missing).
-- Does NOT add events.vendor_type (absent on DEV/PROD; 035 NOT NULL must not return).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- events (create if missing — PROD currently has no events table)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'other',
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    end_date DATE,
    venue JSONB DEFAULT '{}'::jsonb,
    registration_required BOOLEAN DEFAULT false,
    registration_deadline DATE,
    max_attendees INTEGER,
    current_attendees INTEGER DEFAULT 0,
    fees NUMERIC(10, 2),
    status TEXT DEFAULT 'draft',
    image_url TEXT,
    tags TEXT[] DEFAULT '{}',
    approval_status TEXT DEFAULT 'pending',
    created_by TEXT DEFAULT 'vendor',
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    max_bookings INTEGER,
    price_per_booking NUMERIC(10, 2),
    inclusions TEXT[] DEFAULT '{}',
    exclusions TEXT[] DEFAULT '{}',
    terms_and_conditions TEXT,
    registration_rules JSONB DEFAULT '{}'::jsonb,
    cancellation_policy TEXT,
    refund_policy TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_vendor_id ON events(vendor_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_approval_status ON events(approval_status);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);

-- ----------------------------------------------------------------------------
-- event_registrations (create if missing)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    attendee_name TEXT NOT NULL,
    attendee_email TEXT,
    attendee_phone TEXT NOT NULL,
    number_of_people INTEGER DEFAULT 1,
    pets JSONB DEFAULT '[]'::jsonb,
    special_requirements TEXT,
    payment_status TEXT DEFAULT 'pending',
    payment_amount NUMERIC(10, 2),
    transaction_id TEXT,
    check_in_status TEXT DEFAULT 'pending',
    check_in_time TIMESTAMPTZ,
    status TEXT DEFAULT 'confirmed',
    booking_reference TEXT UNIQUE,
    qr_code TEXT,
    checked_in_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_registrations_event_id ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_customer_id ON event_registrations(customer_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_vendor_id ON event_registrations(vendor_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_booking_reference
  ON event_registrations(booking_reference) WHERE booking_reference IS NOT NULL;

ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS payment_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_registrations_payment_id_fkey'
  ) THEN
    ALTER TABLE event_registrations
      ADD CONSTRAINT event_registrations_payment_id_fkey
      FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'payments table missing; skip event_registrations.payment_id FK';
END $$;

CREATE INDEX IF NOT EXISTS idx_event_registrations_payment_id
  ON event_registrations(payment_id) WHERE payment_id IS NOT NULL;

ALTER TABLE event_registrations
  ALTER COLUMN vendor_id DROP NOT NULL;

-- ----------------------------------------------------------------------------
-- event_registration_tickets — one pet / QR / check-in per ticket
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_registration_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES event_registrations(id) ON DELETE CASCADE,
    ticket_index INTEGER NOT NULL CHECK (ticket_index >= 1),
    pet_id UUID REFERENCES pets(id) ON DELETE SET NULL,
    pet_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    declarations JSONB NOT NULL DEFAULT '{}'::jsonb,
    qr_token TEXT UNIQUE,
    check_in_status TEXT NOT NULL DEFAULT 'pending'
      CHECK (check_in_status IN ('pending', 'checked_in', 'no_show')),
    check_in_time TIMESTAMPTZ,
    checked_in_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (registration_id, ticket_index)
);

CREATE INDEX IF NOT EXISTS idx_event_registration_tickets_registration
  ON event_registration_tickets(registration_id);
CREATE INDEX IF NOT EXISTS idx_event_registration_tickets_pet
  ON event_registration_tickets(pet_id) WHERE pet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_registration_tickets_qr
  ON event_registration_tickets(qr_token) WHERE qr_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_registration_tickets_check_in
  ON event_registration_tickets(check_in_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_tickets_unique_pet_per_registration
  ON event_registration_tickets (registration_id, pet_id)
  WHERE pet_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- payments — Event discriminator (do not use warmpawz_pay)
-- ----------------------------------------------------------------------------
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS event_registration_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_event_registration_id_fkey'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_event_registration_id_fkey
      FOREIGN KEY (event_registration_id) REFERENCES event_registrations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_event_registration_id
  ON payments(event_registration_id) WHERE event_registration_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_event_registration_active
  ON payments (event_registration_id)
  WHERE event_registration_id IS NOT NULL
    AND LOWER(COALESCE(payment_status, '')) IN ('pending', 'processing');

-- ----------------------------------------------------------------------------
-- RBAC: grant events capability to all active vendor roles (business + solo)
-- ----------------------------------------------------------------------------
INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT r.id, 'events', '*', '*'
FROM roles r
WHERE r.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_name = 'events'
      AND rp.resource = '*'
      AND rp.action = '*'
  );

COMMENT ON TABLE event_registration_tickets IS
  'One pet, declaration snapshot, opaque QR token, and check-in state per Event ticket';
COMMENT ON COLUMN payments.event_registration_id IS
  'Events payment link. payment_source must be event, never warmpawz_pay';
