-- ============================================================================
-- Migration: 215_add_trainer_home_tele_services.sql
-- Description: Add at_home and tele services for pet_trainer role
-- Date: 2026-01-21
-- Issue: Solo trainers only have 1 at_home service and no tele services
--        This migration adds complete service coverage for home and tele styles
-- ============================================================================

-- Add more at_home training services for pet_trainer
INSERT INTO service_catalog (
    service_id, service_name, display_name, description, 
    category_id, category_name, applicable_roles, service_style, 
    base_price, duration_minutes, status, publish_status, display_order
) VALUES

-- At-Home Training Services
('train_home_basic_obedience', 'Basic Obedience (Home Visit)', 'Fundamental commands at home', 
 'Teach sit, stay, come, heel in your home environment', 
 'training', 'Training & Behavior', ARRAY['pet_trainer'], 'at_home', 
 1800.00, 60, 'active', 'published', 100),

('train_home_puppy', 'Puppy Training (Home Visit)', 'Early socialization at home', 
 'Puppy kindergarten and basics in comfortable home setting', 
 'training', 'Training & Behavior', ARRAY['pet_trainer'], 'at_home', 
 1500.00, 45, 'active', 'published', 101),

('train_home_behavior', 'Behavior Modification (Home Visit)', 'Problem behavior correction at home', 
 'Address aggression, anxiety, barking in the environment where issues occur', 
 'training', 'Training & Behavior', ARRAY['pet_trainer'], 'at_home', 
 2800.00, 90, 'active', 'published', 102),

('train_home_advanced', 'Advanced Training (Home Visit)', 'Complex commands at home', 
 'Advanced obedience and tricks training at your location', 
 'training', 'Training & Behavior', ARRAY['pet_trainer'], 'at_home', 
 2200.00, 60, 'active', 'published', 103),

('train_home_leash_walking', 'Leash Walking Training (Home)', 'Proper leash manners', 
 'Teach your pet proper leash walking behavior', 
 'training', 'Training & Behavior', ARRAY['pet_trainer'], 'at_home', 
 1600.00, 45, 'active', 'published', 104),

('train_home_socialization', 'Socialization Training (Home)', 'Pet social skills at home', 
 'Build confidence and reduce fear in home environment', 
 'training', 'Training & Behavior', ARRAY['pet_trainer'], 'at_home', 
 1800.00, 60, 'active', 'published', 105),

-- Tele/Video Consultation Training Services
('train_tele_consultation', 'Training Consultation (Video)', 'Online training consultation', 
 'Initial assessment and training plan via video call', 
 'training', 'Training & Behavior', ARRAY['pet_trainer'], 'tele', 
 500.00, 30, 'active', 'published', 110),

('train_tele_behavior_assessment', 'Behavior Assessment (Video)', 'Remote behavior evaluation', 
 'Assess pet behavior issues via video consultation', 
 'training', 'Training & Behavior', ARRAY['pet_trainer'], 'tele', 
 600.00, 45, 'active', 'published', 111),

('train_tele_puppy_guidance', 'Puppy Training Guidance (Video)', 'Remote puppy training tips', 
 'Video guidance for new puppy owners on basic training', 
 'training', 'Training & Behavior', ARRAY['pet_trainer'], 'tele', 
 400.00, 30, 'active', 'published', 112),

('train_tele_behavior_coaching', 'Behavior Coaching Session (Video)', 'Live behavior modification coaching', 
 'Real-time coaching for addressing behavioral issues', 
 'training', 'Training & Behavior', ARRAY['pet_trainer'], 'tele', 
 700.00, 45, 'active', 'published', 113),

('train_tele_followup', 'Training Follow-up (Video)', 'Progress check and adjustments', 
 'Follow-up session to review training progress', 
 'training', 'Training & Behavior', ARRAY['pet_trainer'], 'tele', 
 350.00, 20, 'active', 'published', 114),

('train_tele_qa_session', 'Q&A Training Session (Video)', 'Ask the trainer anything', 
 'Open Q&A session for training questions and tips', 
 'training', 'Training & Behavior', ARRAY['pet_trainer'], 'tele', 
 300.00, 20, 'active', 'published', 115)

ON CONFLICT (service_id) DO UPDATE SET
    service_name = EXCLUDED.service_name,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    service_style = EXCLUDED.service_style,
    base_price = EXCLUDED.base_price,
    duration_minutes = EXCLUDED.duration_minutes,
    status = EXCLUDED.status,
    publish_status = EXCLUDED.publish_status;

-- Log success
DO $$
BEGIN
  RAISE NOTICE '✅ Added 12 new training services: 6 at_home + 6 tele for pet_trainer role';
END $$;

-- ============================================================================
-- VERIFICATION QUERY (run after migration to confirm)
-- ============================================================================
-- SELECT service_id, service_name, service_style, applicable_roles 
-- FROM service_catalog 
-- WHERE 'pet_trainer' = ANY(applicable_roles)
-- ORDER BY service_style, display_order;
