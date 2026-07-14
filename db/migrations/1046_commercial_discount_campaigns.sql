-- Commercial discount campaigns (orchestration layer — distinct from notification_campaigns)
CREATE TABLE IF NOT EXISTS commercial_discount_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT,
  campaign_type TEXT NOT NULL,
  template_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  funding_type TEXT NOT NULL DEFAULT 'PLATFORM',
  funding_split JSONB,
  schedule_type TEXT NOT NULL DEFAULT 'immediate',
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  recurring_rule JSONB,
  audience JSONB NOT NULL DEFAULT '{}'::jsonb,
  notification_mode TEXT NOT NULL DEFAULT 'skip',
  notification_campaign_id UUID,
  vendor_id UUID,
  version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy_fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commercial_discount_campaigns_status
  ON commercial_discount_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_commercial_discount_campaigns_type
  ON commercial_discount_campaigns (campaign_type);
CREATE INDEX IF NOT EXISTS idx_commercial_discount_campaigns_vendor
  ON commercial_discount_campaigns (vendor_id)
  WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commercial_discount_campaigns_schedule
  ON commercial_discount_campaigns (start_at, end_at);

CREATE TABLE IF NOT EXISTS commercial_campaign_promotion_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES commercial_discount_campaigns(id) ON DELETE CASCADE,
  promotion_id UUID,
  coupon_id UUID,
  link_type TEXT NOT NULL CHECK (link_type IN ('promotion', 'coupon')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commercial_campaign_links_campaign
  ON commercial_campaign_promotion_links (campaign_id);
CREATE INDEX IF NOT EXISTS idx_commercial_campaign_links_promotion
  ON commercial_campaign_promotion_links (promotion_id)
  WHERE promotion_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commercial_campaign_links_coupon
  ON commercial_campaign_promotion_links (coupon_id)
  WHERE coupon_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS commercial_campaign_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES commercial_discount_campaigns(id) ON DELETE CASCADE,
  audit JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commercial_campaign_audit_campaign
  ON commercial_campaign_audit_log (campaign_id, created_at DESC);
