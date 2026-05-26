-- ============================================================================
-- 749: Migrate customer delivery fee policy v1 (zoneA/zoneB) → v2 (zones[])
-- ============================================================================

UPDATE platform_settings
SET setting_value = jsonb_build_object(
  'version', 2,
  'maxServiceRadiusKm', (setting_value->>'maxServiceRadiusKm')::numeric,
  'zones', jsonb_build_array(
    jsonb_build_object(
      'id', 'zone_near',
      'name', 'Zone A',
      'sortOrder', 0,
      'minDistanceKm', 0,
      'maxDistanceKm', (setting_value->>'zoneABoundaryKm')::numeric,
      'slabs', setting_value->'zones'->'zoneA',
      'surgeConfig', COALESCE(
        setting_value->'zoneSurgeConfig'->'zoneA',
        '{"weekend":true,"festival":true,"rain":true}'::jsonb
      ),
      'description', setting_value->'content'->>'zoneADescription',
      'operationalRules', COALESCE(setting_value->'content'->'rulesBeyond5Km', '[]'::jsonb)
    ),
    jsonb_build_object(
      'id', 'zone_mid',
      'name', 'Zone B',
      'sortOrder', 1,
      'minDistanceKm', (setting_value->>'zoneABoundaryKm')::numeric,
      'maxDistanceKm', (setting_value->>'maxServiceRadiusKm')::numeric,
      'slabs', setting_value->'zones'->'zoneB',
      'surgeConfig', COALESCE(
        setting_value->'zoneSurgeConfig'->'zoneB',
        '{"weekend":true,"festival":true,"rain":true}'::jsonb
      ),
      'description', setting_value->'content'->>'zoneBDescription',
      'operationalRules', COALESCE(setting_value->'content'->'rulesBeyond8Km', '[]'::jsonb)
    )
  ),
  'surges', setting_value->'surges',
  'runtimeSignals', COALESCE(
    setting_value->'runtimeSignals',
    '{"festivalActive":false,"rainActive":false}'::jsonb
  ),
  'content', jsonb_build_object(
    'coverageSummary', setting_value->'content'->>'coverageSummary',
    'surgeIntro', setting_value->'content'->>'surgeIntro',
    'rulesFreeDelivery', COALESCE(setting_value->'content'->'rulesFreeDelivery', '[]'::jsonb),
    'importantNotes', COALESCE(setting_value->'content'->'importantNotes', '[]'::jsonb)
  )
),
updated_at = NOW()
WHERE setting_key = 'customer:delivery:fee_policy'
  AND (setting_value->>'version')::int < 2
  AND setting_value ? 'zoneABoundaryKm'
  AND setting_value->'zones' ? 'zoneA';
