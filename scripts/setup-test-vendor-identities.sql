-- ============================================================================
-- SETUP TEST VENDOR IDENTITIES FOR MIDDLEWARE TESTING
-- ============================================================================
-- Creates test vendor identities with different onboarding statuses
-- Run this before testing middleware
-- ============================================================================

-- Clean up existing test identities (optional)
DELETE FROM vendor_identity WHERE phone LIKE '+91111111111%';

-- Create test vendor identities with different statuses
INSERT INTO vendor_identity (phone, email, onboarding_status, metadata) VALUES
  ('+911111111111', 'test.init@example.com', 'INIT', '{"test": true}'::jsonb),
  ('+911111111112', 'test.role@example.com', 'ROLE_PENDING', '{"test": true}'::jsonb),
  ('+911111111113', 'test.form@example.com', 'FORM_PENDING', '{"test": true}'::jsonb),
  ('+911111111114', 'test.review@example.com', 'UNDER_REVIEW', '{"test": true}'::jsonb),
  ('+911111111115', 'test.clarify@example.com', 'CLARIFICATION_REQUIRED', '{"test": true}'::jsonb),
  ('+911111111116', 'test.approved@example.com', 'APPROVED', '{"test": true}'::jsonb),
  ('+911111111117', 'test.activated@example.com', 'ACTIVATED', '{"test": true}'::jsonb),
  ('+911111111118', 'test.rejected@example.com', 'REJECTED', '{"test": true}'::jsonb)
ON CONFLICT (phone) DO UPDATE SET
  onboarding_status = EXCLUDED.onboarding_status,
  updated_at = NOW();

-- Verify
SELECT phone, onboarding_status 
FROM vendor_identity 
WHERE phone LIKE '+91111111111%'
ORDER BY phone;

-- Expected: 8 rows with different statuses

