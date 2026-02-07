-- ============================================================================
-- Migration: 532_behaviorist_role_same_as_trainer.sql
-- Description: Add Behaviorist role (copy from Trainer); make it active.
--              Onboarding forms, service styles, and discovery aligned with Trainer.
-- Date: 2026-02-03
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. INSERT ROLES: behaviorist_solo, behaviorist_center (same config as trainer)
-- ============================================================================
INSERT INTO roles (name, display_name, description, is_system_role, is_active, config)
VALUES
  ('behaviorist_solo', 'Behaviorist (Solo)', 'Individual behaviorist providing training and behavior modification services', true, true,
   '{"category":"training","icon":"🧠","vendorTypes":["service_provider"],"serviceStyles":["at_home","at_center","online"],"pricingControl":{"canControlPrice":true,"canControlDuration":true}}'::jsonb),
  ('behaviorist_center', 'Behaviorist Center', 'Behavior center with multiple behaviorists and facilities', true, true,
   '{"category":"training","icon":"🧠","vendorTypes":["service_provider"],"serviceStyles":["at_home","at_center","online"],"pricingControl":{"canControlPrice":true,"canControlDuration":true}}'::jsonb)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_active = true,
  config = EXCLUDED.config,
  updated_at = NOW();

-- ============================================================================
-- 2. COPY ROLE_PERMISSIONS from trainer_solo / trainer_center to behaviorist_solo / behaviorist_center
-- ============================================================================
INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT (SELECT id FROM roles WHERE name = 'behaviorist_solo' LIMIT 1), permission_name, resource, action
FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'trainer_solo' LIMIT 1)
ON CONFLICT (role_id, permission_name, resource, action) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_name, resource, action)
SELECT (SELECT id FROM roles WHERE name = 'behaviorist_center' LIMIT 1), permission_name, resource, action
FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'trainer_center' LIMIT 1)
ON CONFLICT (role_id, permission_name, resource, action) DO NOTHING;

-- ============================================================================
-- 3. COPY ONBOARDING_FORMS from trainer to behaviorist (by role_id text)
-- ============================================================================
INSERT INTO onboarding_forms (role_id, fields, version, status, updated_at)
SELECT 'behaviorist_solo', fields, version, COALESCE(status, 'active'), NOW()
FROM onboarding_forms WHERE role_id = 'trainer_solo' LIMIT 1
ON CONFLICT (role_id) DO UPDATE SET fields = EXCLUDED.fields, version = EXCLUDED.version, status = EXCLUDED.status, updated_at = NOW();

INSERT INTO onboarding_forms (role_id, fields, version, status, updated_at)
SELECT 'behaviorist_center', fields, version, COALESCE(status, 'active'), NOW()
FROM onboarding_forms WHERE role_id = 'trainer_center' LIMIT 1
ON CONFLICT (role_id) DO UPDATE SET fields = EXCLUDED.fields, version = EXCLUDED.version, status = EXCLUDED.status, updated_at = NOW();

-- ============================================================================
-- 4. INSERT SERVICE_CATALOG for Behaviorist (same services as Trainer, unique service_id)
-- ============================================================================
INSERT INTO service_catalog (
    service_id, service_name, display_name, description,
    category_id, category_name, applicable_roles, service_style,
    base_price, duration_minutes, status, publish_status, display_order
) VALUES
-- At-Home Behavior Services
('behave_home_basic_obedience', 'Basic Obedience (Home Visit)', 'Fundamental commands at home',
 'Teach sit, stay, come, heel in your home environment',
 'training', 'Training & Behavior', ARRAY['pet_behaviorist','behaviorist_solo','behaviorist_center'], 'at_home',
 1800.00, 60, 'active', 'published', 100),
('behave_home_puppy', 'Puppy Training (Home Visit)', 'Early socialization at home',
 'Puppy kindergarten and basics in comfortable home setting',
 'training', 'Training & Behavior', ARRAY['pet_behaviorist','behaviorist_solo','behaviorist_center'], 'at_home',
 1500.00, 45, 'active', 'published', 101),
('behave_home_behavior', 'Behavior Modification (Home Visit)', 'Problem behavior correction at home',
 'Address aggression, anxiety, barking in the environment where issues occur',
 'training', 'Training & Behavior', ARRAY['pet_behaviorist','behaviorist_solo','behaviorist_center'], 'at_home',
 2800.00, 90, 'active', 'published', 102),
('behave_home_advanced', 'Advanced Training (Home Visit)', 'Complex commands at home',
 'Advanced obedience and tricks training at your location',
 'training', 'Training & Behavior', ARRAY['pet_behaviorist','behaviorist_solo','behaviorist_center'], 'at_home',
 2200.00, 60, 'active', 'published', 103),
('behave_home_leash_walking', 'Leash Walking Training (Home)', 'Proper leash manners',
 'Teach your pet proper leash walking behavior',
 'training', 'Training & Behavior', ARRAY['pet_behaviorist','behaviorist_solo','behaviorist_center'], 'at_home',
 1600.00, 45, 'active', 'published', 104),
('behave_home_socialization', 'Socialization Training (Home)', 'Pet social skills at home',
 'Build confidence and reduce fear in home environment',
 'training', 'Training & Behavior', ARRAY['pet_behaviorist','behaviorist_solo','behaviorist_center'], 'at_home',
 1800.00, 60, 'active', 'published', 105),
-- Tele/Video Consultation
('behave_tele_consultation', 'Behavior Consultation (Video)', 'Online behavior consultation',
 'Initial assessment and behavior plan via video call',
 'training', 'Training & Behavior', ARRAY['pet_behaviorist','behaviorist_solo','behaviorist_center'], 'tele',
 500.00, 30, 'active', 'published', 110),
('behave_tele_behavior_assessment', 'Behavior Assessment (Video)', 'Remote behavior evaluation',
 'Assess pet behavior issues via video consultation',
 'training', 'Training & Behavior', ARRAY['pet_behaviorist','behaviorist_solo','behaviorist_center'], 'tele',
 600.00, 45, 'active', 'published', 111),
('behave_tele_puppy_guidance', 'Puppy Training Guidance (Video)', 'Remote puppy training tips',
 'Video guidance for new puppy owners on basic training',
 'training', 'Training & Behavior', ARRAY['pet_behaviorist','behaviorist_solo','behaviorist_center'], 'tele',
 400.00, 30, 'active', 'published', 112),
('behave_tele_behavior_coaching', 'Behavior Coaching Session (Video)', 'Live behavior modification coaching',
 'Real-time coaching for addressing behavioral issues',
 'training', 'Training & Behavior', ARRAY['pet_behaviorist','behaviorist_solo','behaviorist_center'], 'tele',
 700.00, 45, 'active', 'published', 113),
('behave_tele_followup', 'Behavior Follow-up (Video)', 'Progress check and adjustments',
 'Follow-up session to review behavior progress',
 'training', 'Training & Behavior', ARRAY['pet_behaviorist','behaviorist_solo','behaviorist_center'], 'tele',
 350.00, 20, 'active', 'published', 114),
('behave_tele_qa_session', 'Q&A Behavior Session (Video)', 'Ask the behaviorist anything',
 'Open Q&A session for behavior questions and tips',
 'training', 'Training & Behavior', ARRAY['pet_behaviorist','behaviorist_solo','behaviorist_center'], 'tele',
 300.00, 20, 'active', 'published', 115)
ON CONFLICT (service_id) DO UPDATE SET
    service_name = EXCLUDED.service_name,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    applicable_roles = EXCLUDED.applicable_roles,
    service_style = EXCLUDED.service_style,
    base_price = EXCLUDED.base_price,
    duration_minutes = EXCLUDED.duration_minutes,
    status = EXCLUDED.status,
    publish_status = EXCLUDED.publish_status;

-- Log success
DO $$
BEGIN
  RAISE NOTICE '✅ Behaviorist role added: behaviorist_solo, behaviorist_center (same as Trainer); onboarding forms and service catalog seeded';
END $$;

COMMIT;
