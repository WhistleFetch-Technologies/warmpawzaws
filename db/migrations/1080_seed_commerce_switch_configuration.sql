-- Seed default Commerce Switch configuration (Marketplace only).
INSERT INTO platform_settings (
  setting_key,
  setting_value,
  setting_type,
  description,
  is_public,
  created_at,
  updated_at
)
SELECT
  'platform:commerce-switch:configuration',
  '{
    "version": 1,
    "schemaVersion": "1.0",
    "activeModelId": "marketplace",
    "availableModels": ["marketplace"],
    "rollout": { "mode": "global" },
    "features": {
      "allowAdminSwitch": true,
      "allowPilotRollout": false
    },
    "updatedAt": "1970-01-01T00:00:00.000Z",
    "updatedBy": "system"
  }'::jsonb,
  'object',
  'Platform Commerce Switch configuration (active commerce model)',
  false,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings WHERE setting_key = 'platform:commerce-switch:configuration'
);
