-- Add policy_type, vendor_types, service_types, priority to cancellation_policies
-- so admin can create Standard / Vendor Specific / Service Specific policies
-- and they can be matched when resolving which policy applies to a booking/vendor.

ALTER TABLE cancellation_policies
  ADD COLUMN IF NOT EXISTS policy_type TEXT NOT NULL DEFAULT 'standard'
    CHECK (policy_type IN ('standard', 'vendor_specific', 'service_specific')),
  ADD COLUMN IF NOT EXISTS vendor_types TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_types TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN cancellation_policies.policy_type IS 'standard = applies to all; vendor_specific = filter by vendor_types; service_specific = filter by service_types';
COMMENT ON COLUMN cancellation_policies.vendor_types IS 'Role IDs this policy applies to (when policy_type = vendor_specific). Empty = all.';
COMMENT ON COLUMN cancellation_policies.service_types IS 'Service delivery types: at_home, at_center, video_consultation, delivery, pickup (when policy_type = service_specific). Empty = all.';
COMMENT ON COLUMN cancellation_policies.priority IS 'Higher value = higher precedence when multiple policies match.';

CREATE INDEX IF NOT EXISTS idx_cancellation_policies_policy_type ON cancellation_policies(policy_type);
CREATE INDEX IF NOT EXISTS idx_cancellation_policies_priority ON cancellation_policies(priority DESC);
