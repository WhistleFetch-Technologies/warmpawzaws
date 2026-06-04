-- ============================================================================
-- MIGRATION 1024: Notification Campaign Engine (domain model)
-- ============================================================================
-- Campaign platform entities. Inbox rows remain in `notifications` (1020).
-- Campaigns use `notification_campaigns` to avoid schema collision.
-- ============================================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE notification_campaign_channel AS ENUM ('PUSH', 'SMS', 'EMAIL', 'WHATSAPP', 'IN_APP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_target_app AS ENUM ('CUSTOMER', 'VENDOR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_campaign_status AS ENUM (
    'DRAFT', 'SCHEDULED', 'QUEUED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_campaign_delivery_status AS ENUM (
    'PENDING', 'SENT', 'DELIVERED', 'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_targeting_type AS ENUM (
    'BROADCAST', 'SPECIFIC_USERS', 'REGIONS', 'CITIES', 'SEGMENTS'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_campaign_event_type AS ENUM (
    'CREATED', 'UPDATED', 'VALIDATED', 'SCHEDULED', 'QUEUED',
    'SENDING', 'SENT', 'FAILED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Channel settings (one row per app)
CREATE TABLE IF NOT EXISTS notification_channel_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_type notification_target_app NOT NULL UNIQUE,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO notification_channel_settings (app_type, push_enabled)
VALUES ('CUSTOMER', true), ('VENDOR', true)
ON CONFLICT (app_type) DO NOTHING;

-- Campaigns
CREATE TABLE IF NOT EXISTS notification_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channel notification_campaign_channel NOT NULL DEFAULT 'PUSH',
  target_app notification_target_app NOT NULL DEFAULT 'CUSTOMER',
  status notification_campaign_status NOT NULL DEFAULT 'DRAFT',
  image_url TEXT,
  cta_text TEXT,
  deep_link TEXT,
  targeting_type notification_targeting_type NOT NULL DEFAULT 'BROADCAST',
  audience_filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  timezone TEXT,
  estimated_recipients INT NOT NULL DEFAULT 0,
  sent_recipients INT NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_at_utc TIMESTAMPTZ,
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notification_campaigns_status
  ON notification_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_notification_campaigns_created_at
  ON notification_campaigns (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_campaigns_scheduled_at
  ON notification_campaigns (scheduled_at_utc)
  WHERE scheduled_at_utc IS NOT NULL;

-- Targeting junction tables
CREATE TABLE IF NOT EXISTS notification_campaign_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES notification_campaigns(id) ON DELETE CASCADE,
  region_id UUID NOT NULL,
  UNIQUE (campaign_id, region_id)
);

CREATE TABLE IF NOT EXISTS notification_campaign_cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES notification_campaigns(id) ON DELETE CASCADE,
  city_name TEXT NOT NULL,
  UNIQUE (campaign_id, city_name)
);

CREATE TABLE IF NOT EXISTS notification_campaign_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES notification_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  UNIQUE (campaign_id, user_id)
);

-- Segments
CREATE TABLE IF NOT EXISTS notification_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  target_app notification_target_app NOT NULL DEFAULT 'CUSTOMER',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_segment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES notification_segments(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  operator TEXT NOT NULL DEFAULT '=',
  comparison_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_segment_rules_segment
  ON notification_segment_rules (segment_id);

CREATE TABLE IF NOT EXISTS notification_segment_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES notification_campaigns(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES notification_segments(id) ON DELETE CASCADE,
  UNIQUE (campaign_id, segment_id)
);

-- Campaign templates (distinct from legacy notification_templates inbox templates)
CREATE TABLE IF NOT EXISTS notification_campaign_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  target_app notification_target_app NOT NULL DEFAULT 'CUSTOMER',
  channel notification_campaign_channel NOT NULL DEFAULT 'PUSH',
  title_template TEXT NOT NULL,
  message_template TEXT NOT NULL,
  cta_template TEXT,
  deep_link_template TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-recipient delivery records (campaign pipeline output)
CREATE TABLE IF NOT EXISTS notification_campaign_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES notification_campaigns(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('customer', 'vendor', 'admin', 'staff')),
  device_token_id UUID,
  status notification_campaign_delivery_status NOT NULL DEFAULT 'PENDING',
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notification_campaign_deliveries_campaign
  ON notification_campaign_deliveries (campaign_id);
CREATE INDEX IF NOT EXISTS idx_notification_campaign_deliveries_status
  ON notification_campaign_deliveries (status);
CREATE INDEX IF NOT EXISTS idx_notification_campaign_deliveries_cursor
  ON notification_campaign_deliveries (campaign_id, created_at, id);

-- Audit trail
CREATE TABLE IF NOT EXISTS notification_campaign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES notification_campaigns(id) ON DELETE CASCADE,
  event_type notification_campaign_event_type NOT NULL,
  performed_by UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_campaign_events_campaign
  ON notification_campaign_events (campaign_id, created_at DESC);

-- Seed example segments (idempotent by name)
INSERT INTO notification_segments (name, description, target_app)
SELECT v.name, v.description, v.target_app::notification_target_app
FROM (VALUES
  ('Dog Owners', 'Customers with at least one dog', 'CUSTOMER'),
  ('Cat Owners', 'Customers with at least one cat', 'CUSTOMER'),
  ('Inactive 30 Days', 'No booking in 30 days', 'CUSTOMER'),
  ('Premium Members', 'Gold loyalty tier', 'CUSTOMER'),
  ('Wallet Users', 'Wallet balance greater than zero', 'CUSTOMER')
) AS v(name, description, target_app)
WHERE NOT EXISTS (
  SELECT 1 FROM notification_segments s WHERE s.name = v.name
);

-- Seed campaign templates
INSERT INTO notification_campaign_templates (name, target_app, channel, title_template, message_template, cta_template)
SELECT v.name, v.target_app::notification_target_app, v.channel::notification_campaign_channel,
       v.title_template, v.message_template, v.cta_template
FROM (VALUES
  ('Appointment Reminder', 'CUSTOMER', 'PUSH', 'Upcoming appointment', 'Your {service} appointment is tomorrow at {time}.', 'View booking'),
  ('Refund Notification', 'CUSTOMER', 'PUSH', 'Refund processed', 'Your refund of {amount} has been credited.', 'View wallet'),
  ('Vaccination Reminder', 'CUSTOMER', 'PUSH', 'Vaccination due', '{pet_name} is due for {vaccine} vaccination.', 'Book now'),
  ('Review Request', 'CUSTOMER', 'PUSH', 'How was your visit?', 'Rate your experience with {vendor_name}.', 'Leave review'),
  ('Promotional Offer', 'CUSTOMER', 'PUSH', 'Special offer', '{message}', 'Shop now')
) AS v(name, target_app, channel, title_template, message_template, cta_template)
WHERE NOT EXISTS (
  SELECT 1 FROM notification_campaign_templates t WHERE t.name = v.name
);
