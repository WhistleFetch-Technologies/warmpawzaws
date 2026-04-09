-- Admin no longer uses POST /admin/vendor/onboarding/:applicationId/review; loyalty uses application/approve only.
DELETE FROM action_sources
WHERE route_pattern = '/admin/vendor/onboarding/:applicationId/review';
