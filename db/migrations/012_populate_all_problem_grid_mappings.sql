-- ============================================================================
-- MIGRATION 012: Populate ALL Problem Grid Mappings from Catalog
-- ============================================================================
-- This migration populates all problem grid mappings from the complete catalog
-- Date: 2025-01-27
-- ============================================================================

-- Clear existing mappings
TRUNCATE TABLE problem_grid_mappings;

-- ============================================================================
-- VETERINARY HEALTH PROBLEMS → veterinarian role
-- ============================================================================

-- Surgery
SELECT populate_problem_grid_mapping('surgery', 'Surgery', 'Surgery & Procedures', 'veterinarian', 'sub_surgical_services', 'surgical services', 0);
SELECT populate_problem_grid_mapping('surgery', 'Surgery', 'Surgery & Procedures', 'veterinarian', 'sub_surgery', 'surgery', 1);

-- Dermatology
SELECT populate_problem_grid_mapping('dermatology', 'Dermatology', 'Skin & Coat Care', 'veterinarian', 'sub_dermatology', 'dermatology', 0);
SELECT populate_problem_grid_mapping('dermatology', 'Dermatology', 'Skin & Coat Care', 'veterinarian', 'sub_specialty_services', 'specialty services', 1);
SELECT populate_problem_grid_mapping('dermatology', 'Dermatology', 'Skin & Coat Care', 'veterinarian', 'sub_medical_treatment', 'medical treatment', 2);

-- Dentistry
SELECT populate_problem_grid_mapping('dentistry', 'Dentistry', 'Dental Care', 'veterinarian', 'sub_dentistry', 'dentistry', 0);
SELECT populate_problem_grid_mapping('dentistry', 'Dentistry', 'Dental Care', 'veterinarian', 'sub_dental', 'dental', 1);
SELECT populate_problem_grid_mapping('dentistry', 'Dentistry', 'Dental Care', 'veterinarian', 'sub_specialty_services', 'specialty services', 2);

-- Ophthalmology
SELECT populate_problem_grid_mapping('ophthalmology', 'Ophthalmology', 'Eye Care', 'veterinarian', 'sub_ophthalmology', 'ophthalmology', 0);
SELECT populate_problem_grid_mapping('ophthalmology', 'Ophthalmology', 'Eye Care', 'veterinarian', 'sub_specialty_services', 'specialty services', 1);

-- Cardiology
SELECT populate_problem_grid_mapping('cardiology', 'Cardiology', 'Heart & Cardiovascular', 'veterinarian', 'sub_cardiology', 'cardiology', 0);
SELECT populate_problem_grid_mapping('cardiology', 'Cardiology', 'Heart & Cardiovascular', 'veterinarian', 'sub_specialty_services', 'specialty services', 1);
SELECT populate_problem_grid_mapping('cardiology', 'Cardiology', 'Heart & Cardiovascular', 'veterinarian', 'sub_diagnostics', 'diagnostics', 2);

-- Neurology
SELECT populate_problem_grid_mapping('neurology', 'Neurology', 'Neurological Care', 'veterinarian', 'sub_neurology', 'neurology', 0);
SELECT populate_problem_grid_mapping('neurology', 'Neurology', 'Neurological Care', 'veterinarian', 'sub_specialty_services', 'specialty services', 1);

-- General Medicine
SELECT populate_problem_grid_mapping('medicine', 'General Medicine', 'General Health', 'veterinarian', 'sub_general_medicine', 'general medicine', 0);
SELECT populate_problem_grid_mapping('medicine', 'General Medicine', 'General Health', 'veterinarian', 'sub_preventive_wellness', 'preventive wellness', 1);
SELECT populate_problem_grid_mapping('medicine', 'General Medicine', 'General Health', 'veterinarian', 'sub_medical_treatment', 'medical treatment', 2);
SELECT populate_problem_grid_mapping('medicine', 'General Medicine', 'General Health', 'veterinarian', 'sub_diagnostics', 'diagnostics', 3);

-- Emergency
SELECT populate_problem_grid_mapping('emergency', 'Emergency & Critical Care', 'Emergency Care', 'veterinarian', 'sub_emergency_critical', 'emergency critical', 0);
SELECT populate_problem_grid_mapping('emergency', 'Emergency & Critical Care', 'Emergency Care', 'veterinarian', 'sub_emergency', 'emergency', 1);

-- Orthopedic
SELECT populate_problem_grid_mapping('orthopedic', 'Orthopedic', 'Bone & Joint Care', 'veterinarian', 'sub_orthopedic', 'orthopedic', 0);
SELECT populate_problem_grid_mapping('orthopedic', 'Orthopedic', 'Bone & Joint Care', 'veterinarian', 'sub_specialty_services', 'specialty services', 1);
SELECT populate_problem_grid_mapping('orthopedic', 'Orthopedic', 'Bone & Joint Care', 'veterinarian', 'sub_surgical_services', 'surgical services', 2);

-- Physiotherapy
SELECT populate_problem_grid_mapping('physiotherapy', 'Physiotherapy', 'Physical Therapy', 'veterinarian', 'sub_physiotherapy', 'physiotherapy', 0);
SELECT populate_problem_grid_mapping('physiotherapy', 'Physiotherapy', 'Physical Therapy', 'veterinarian', 'sub_specialty_services', 'specialty services', 1);

-- ============================================================================
-- GROOMING NEEDS → groomer role
-- ============================================================================

-- Full Grooming
SELECT populate_problem_grid_mapping('full_grooming', 'Full Grooming', 'Complete Grooming', 'groomer', 'sub_grooming_basic', 'grooming basic', 0);
SELECT populate_problem_grid_mapping('full_grooming', 'Full Grooming', 'Complete Grooming', 'groomer', 'sub_grooming_specialty', 'grooming specialty', 1);

-- Bath Only
SELECT populate_problem_grid_mapping('bath_only', 'Bath & Brush', 'Bath Service', 'groomer', 'sub_grooming_basic', 'grooming basic', 0);

-- Haircut Styling
SELECT populate_problem_grid_mapping('haircut_styling', 'Haircut & Styling', 'Hair Styling', 'groomer', 'sub_grooming_basic', 'grooming basic', 0);

-- Nail Care
SELECT populate_problem_grid_mapping('nail_care', 'Nail Care', 'Nail Trimming', 'groomer', 'sub_grooming_basic', 'grooming basic', 0);

-- De-shedding
SELECT populate_problem_grid_mapping('deshedding', 'De-shedding', 'Shedding Control', 'groomer', 'sub_grooming_basic', 'grooming basic', 0);

-- Spa Treatment
SELECT populate_problem_grid_mapping('spa_treatment', 'Spa & Wellness', 'Spa Treatment', 'groomer', 'sub_grooming_specialty', 'grooming specialty', 0);

-- ============================================================================
-- TRAINING GOALS → trainer role
-- ============================================================================

-- Basic Obedience
SELECT populate_problem_grid_mapping('basic_obedience', 'Basic Obedience', 'Basic Commands', 'trainer', 'sub_training_basic', 'training basic', 0);

-- Potty Training
SELECT populate_problem_grid_mapping('potty_training', 'Potty Training', 'House Training', 'trainer', 'sub_training_basic', 'training basic', 0);

-- Socialization
SELECT populate_problem_grid_mapping('socialization', 'Socialization', 'Social Skills', 'trainer', 'sub_training_basic', 'training basic', 0);

-- Aggression Issues
SELECT populate_problem_grid_mapping('aggression', 'Aggression Issues', 'Behavioral Problems', 'trainer', 'sub_behavior', 'behavior', 0);

-- Advanced Training
SELECT populate_problem_grid_mapping('advanced_training', 'Advanced Training', 'Advanced Skills', 'trainer', 'sub_training_advanced', 'training advanced', 0);

-- Leash Training
SELECT populate_problem_grid_mapping('leash_training', 'Leash Training', 'Walking Skills', 'trainer', 'sub_training_basic', 'training basic', 0);

-- ============================================================================
-- WALKING NEEDS → walker role
-- ============================================================================

-- Daily Walk
SELECT populate_problem_grid_mapping('daily_walk', 'Daily Walk', 'Regular Walking', 'walker', 'sub_walking', 'walking', 0);

-- Puppy Walk
SELECT populate_problem_grid_mapping('puppy_walk', 'Puppy Walking', 'Gentle Puppy Walks', 'walker', 'sub_walking', 'walking', 0);

-- Senior Walk
SELECT populate_problem_grid_mapping('senior_walk', 'Senior Pet Walk', 'Senior Care Walks', 'walker', 'sub_walking', 'walking', 0);

-- Multiple Dogs
SELECT populate_problem_grid_mapping('multiple_dogs', 'Multiple Dogs', 'Group Walking', 'walker', 'sub_walking', 'walking', 0);

-- Long Walk
SELECT populate_problem_grid_mapping('long_walk', 'Long/Adventure Walk', 'Extended Walks', 'walker', 'sub_walking', 'walking', 0);

-- ============================================================================
-- BEHAVIORAL ISSUES → behaviourist role
-- ============================================================================

-- Separation Anxiety
SELECT populate_problem_grid_mapping('separation_anxiety', 'Separation Anxiety', 'Anxiety & Stress', 'behaviourist', 'sub_behavior', 'behavior', 0);

-- Excessive Barking
SELECT populate_problem_grid_mapping('barking', 'Excessive Barking', 'Barking Issues', 'behaviourist', 'sub_behavior', 'behavior', 0);

-- Destructive Behavior
SELECT populate_problem_grid_mapping('destructive', 'Destructive Behavior', 'Destructive Habits', 'behaviourist', 'sub_behavior', 'behavior', 0);

-- Fear & Phobias
SELECT populate_problem_grid_mapping('fear_phobia', 'Fear & Phobias', 'Fear Issues', 'behaviourist', 'sub_behavior', 'behavior', 0);

-- Resource Guarding
SELECT populate_problem_grid_mapping('resource_guarding', 'Resource Guarding', 'Possessive Behavior', 'behaviourist', 'sub_behavior', 'behavior', 0);

-- ============================================================================
-- BOARDING NEEDS → boarding role
-- ============================================================================

-- Short Stay
SELECT populate_problem_grid_mapping('short_stay', 'Short Stay (1-3 days)', 'Weekend Boarding', 'boarding', 'sub_daycare', 'daycare', 0);

-- Long Stay
SELECT populate_problem_grid_mapping('long_stay', 'Long Stay (4+ days)', 'Extended Boarding', 'boarding', 'sub_daycare', 'daycare', 0);

-- Daycare
SELECT populate_problem_grid_mapping('daycare', 'Daycare', 'Daily Daycare', 'boarding', 'sub_daycare', 'daycare', 0);

-- Luxury Boarding
SELECT populate_problem_grid_mapping('luxury_boarding', 'Luxury Boarding', 'Premium Care', 'boarding', 'sub_daycare', 'daycare', 0);

-- Medical Boarding
SELECT populate_problem_grid_mapping('medical_boarding', 'Medical Boarding', 'Special Needs', 'boarding', 'sub_daycare', 'daycare', 0);

-- ============================================================================
-- NUTRITION NEEDS → nutritionist role
-- ============================================================================

-- Weight Management
SELECT populate_problem_grid_mapping('weight_management', 'Weight Management', 'Weight Loss/Gain', 'nutritionist', 'sub_nutrition_consultation', 'nutrition consultation', 0);
SELECT populate_problem_grid_mapping('weight_management', 'Weight Management', 'Weight Loss/Gain', 'nutritionist', 'sub_diet_planning', 'diet planning', 1);

-- Food Allergies
SELECT populate_problem_grid_mapping('allergies_sensitivities', 'Food Allergies', 'Allergies & Sensitivities', 'nutritionist', 'sub_nutrition_consultation', 'nutrition consultation', 0);
SELECT populate_problem_grid_mapping('allergies_sensitivities', 'Food Allergies', 'Allergies & Sensitivities', 'nutritionist', 'sub_special_diets', 'special diets', 1);

-- Digestive Issues
SELECT populate_problem_grid_mapping('digestive_issues', 'Digestive Problems', 'Digestive Health', 'nutritionist', 'sub_nutrition_consultation', 'nutrition consultation', 0);
SELECT populate_problem_grid_mapping('digestive_issues', 'Digestive Problems', 'Digestive Health', 'nutritionist', 'sub_special_diets', 'special diets', 1);

-- Puppy/Kitten Nutrition
SELECT populate_problem_grid_mapping('puppy_kitten_nutrition', 'Puppy/Kitten Nutrition', 'Growth & Development', 'nutritionist', 'sub_nutrition_consultation', 'nutrition consultation', 0);
SELECT populate_problem_grid_mapping('puppy_kitten_nutrition', 'Puppy/Kitten Nutrition', 'Growth & Development', 'nutritionist', 'sub_diet_planning', 'diet planning', 1);

-- Senior Nutrition
SELECT populate_problem_grid_mapping('senior_nutrition', 'Senior Pet Nutrition', 'Senior Care Diet', 'nutritionist', 'sub_nutrition_consultation', 'nutrition consultation', 0);
SELECT populate_problem_grid_mapping('senior_nutrition', 'Senior Pet Nutrition', 'Senior Care Diet', 'nutritionist', 'sub_diet_planning', 'diet planning', 1);

-- Medical Condition Diets
SELECT populate_problem_grid_mapping('medical_conditions', 'Medical Condition Diets', 'Therapeutic Nutrition', 'nutritionist', 'sub_nutrition_consultation', 'nutrition consultation', 0);
SELECT populate_problem_grid_mapping('medical_conditions', 'Medical Condition Diets', 'Therapeutic Nutrition', 'nutritionist', 'sub_special_diets', 'special diets', 1);

-- Raw/Fresh Food Diet
SELECT populate_problem_grid_mapping('raw_fresh_food', 'Raw/Fresh Food Diet', 'Natural Feeding', 'nutritionist', 'sub_nutrition_consultation', 'nutrition consultation', 0);
SELECT populate_problem_grid_mapping('raw_fresh_food', 'Raw/Fresh Food Diet', 'Natural Feeding', 'nutritionist', 'sub_diet_planning', 'diet planning', 1);

-- Performance Nutrition
SELECT populate_problem_grid_mapping('performance_nutrition', 'Performance Nutrition', 'Active Pet Diets', 'nutritionist', 'sub_nutrition_consultation', 'nutrition consultation', 0);
SELECT populate_problem_grid_mapping('performance_nutrition', 'Performance Nutrition', 'Active Pet Diets', 'nutritionist', 'sub_diet_planning', 'diet planning', 1);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Count total mappings
SELECT 
    'Total Mappings' as metric,
    COUNT(*) as count
FROM problem_grid_mappings;

-- Count by role
SELECT 
    role_id,
    COUNT(*) as count
FROM problem_grid_mappings
GROUP BY role_id
ORDER BY role_id;

-- Sample mappings
SELECT 
    problem_id,
    problem_name,
    role_id,
    COUNT(*) as subcategory_count
FROM problem_grid_mappings
GROUP BY problem_id, problem_name, role_id
ORDER BY role_id, problem_id
LIMIT 20;

