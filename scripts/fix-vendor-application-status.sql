-- One-time fix: Update vendor_onboarding_applications that are SUBMITTED to UNDER_REVIEW
-- so the Admin Review API can process them.
-- Run this against prod DB if you have applications stuck in SUBMITTED.

-- Fix specific application (replace with your application ID if different)
UPDATE vendor_onboarding_applications
SET status = 'UNDER_REVIEW', updated_at = NOW()
WHERE id = '517d9db8-67af-41b1-a861-7141cc0c5765'
  AND status = 'SUBMITTED';

-- Fix all applications that are SUBMITTED but should be UNDER_REVIEW
-- (vendor_identity.onboarding_status = 'UNDER_REVIEW' indicates they were submitted)
UPDATE vendor_onboarding_applications voa
SET status = 'UNDER_REVIEW', updated_at = NOW()
FROM vendor_identity vi
WHERE voa.vendor_identity_id = vi.id
  AND voa.status = 'SUBMITTED'
  AND vi.onboarding_status = 'UNDER_REVIEW';
