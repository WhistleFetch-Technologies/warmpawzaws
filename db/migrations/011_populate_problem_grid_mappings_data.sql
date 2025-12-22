-- ============================================================================
-- MIGRATION 011: Populate Problem Grid Mappings Data
-- ============================================================================
-- Purpose: Populate problem_grid_mappings table with actual data from catalog
-- Date: 2025-01-27
-- ============================================================================

-- Clear existing mappings (will be repopulated)
TRUNCATE TABLE problem_grid_mappings;

-- ============================================================================
-- VETERINARY HEALTH PROBLEMS
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
SELECT populate_problem_grid_mapping('emergency', 'Emergency & Critical Care', 'Emergency Care', 'veterinarian', 'sub_emergency_services', 'emergency services', 0);
SELECT populate_problem_grid_mapping('emergency', 'Emergency & Critical Care', 'Emergency Care', 'veterinarian', 'sub_critical_care', 'critical care', 1);

-- Vaccination
SELECT populate_problem_grid_mapping('vaccination', 'Vaccination', 'Vaccination & Immunization', 'veterinarian', 'sub_vaccination', 'vaccination', 0);
SELECT populate_problem_grid_mapping('vaccination', 'Vaccination', 'Vaccination & Immunization', 'veterinarian', 'sub_preventive_wellness', 'preventive wellness', 1);

-- Deworming
SELECT populate_problem_grid_mapping('deworming', 'Deworming', 'Parasite Control', 'veterinarian', 'sub_deworming', 'deworming', 0);
SELECT populate_problem_grid_mapping('deworming', 'Deworming', 'Parasite Control', 'veterinarian', 'sub_preventive_wellness', 'preventive wellness', 1);

-- ============================================================================
-- GROOMING NEEDS
-- ============================================================================

-- Basic Grooming
SELECT populate_problem_grid_mapping('basic_grooming', 'Basic Grooming', 'Basic Grooming', 'groomer', 'sub_basic_grooming', 'basic grooming', 0);
SELECT populate_problem_grid_mapping('basic_grooming', 'Basic Grooming', 'Basic Grooming', 'groomer', 'sub_grooming_services', 'grooming services', 1);

-- Full Grooming
SELECT populate_problem_grid_mapping('full_grooming', 'Full Grooming', 'Full Grooming Package', 'groomer', 'sub_full_grooming', 'full grooming', 0);
SELECT populate_problem_grid_mapping('full_grooming', 'Full Grooming', 'Full Grooming Package', 'groomer', 'sub_grooming_services', 'grooming services', 1);

-- Nail Trimming
SELECT populate_problem_grid_mapping('nail_trimming', 'Nail Trimming', 'Nail Care', 'groomer', 'sub_nail_care', 'nail care', 0);
SELECT populate_problem_grid_mapping('nail_trimming', 'Nail Trimming', 'Nail Care', 'groomer', 'sub_grooming_services', 'grooming services', 1);

-- Bath & Brush
SELECT populate_problem_grid_mapping('bath_brush', 'Bath & Brush', 'Bath & Brush', 'groomer', 'sub_bath_services', 'bath services', 0);
SELECT populate_problem_grid_mapping('bath_brush', 'Bath & Brush', 'Bath & Brush', 'groomer', 'sub_grooming_services', 'grooming services', 1);

-- ============================================================================
-- TRAINING GOALS
-- ============================================================================

-- Basic Obedience
SELECT populate_problem_grid_mapping('basic_obedience', 'Basic Obedience', 'Basic Training', 'trainer', 'sub_basic_training', 'basic training', 0);
SELECT populate_problem_grid_mapping('basic_obedience', 'Basic Obedience', 'Basic Training', 'trainer', 'sub_training_services', 'training services', 1);

-- Advanced Training
SELECT populate_problem_grid_mapping('advanced_training', 'Advanced Training', 'Advanced Skills', 'trainer', 'sub_advanced_training', 'advanced training', 0);
SELECT populate_problem_grid_mapping('advanced_training', 'Advanced Training', 'Advanced Skills', 'trainer', 'sub_training_services', 'training services', 1);

-- Behavior Modification
SELECT populate_problem_grid_mapping('behavior_modification', 'Behavior Modification', 'Behavior Training', 'trainer', 'sub_behavior_training', 'behavior training', 0);
SELECT populate_problem_grid_mapping('behavior_modification', 'Behavior Modification', 'Behavior Training', 'trainer', 'sub_training_services', 'training services', 1);

-- ============================================================================
-- WALKING NEEDS
-- ============================================================================

-- Regular Walking
SELECT populate_problem_grid_mapping('regular_walking', 'Regular Walking', 'Daily Walks', 'walker', 'sub_walking_services', 'walking services', 0);

-- Exercise Walking
SELECT populate_problem_grid_mapping('exercise_walking', 'Exercise Walking', 'Exercise & Fitness', 'walker', 'sub_walking_services', 'walking services', 0);

-- ============================================================================
-- BEHAVIORAL ISSUES
-- ============================================================================

-- Aggression
SELECT populate_problem_grid_mapping('aggression', 'Aggression', 'Aggressive Behavior', 'behaviourist', 'sub_behavior_modification', 'behavior modification', 0);
SELECT populate_problem_grid_mapping('aggression', 'Aggression', 'Aggressive Behavior', 'behaviourist', 'sub_behavioral_services', 'behavioral services', 1);

-- Anxiety
SELECT populate_problem_grid_mapping('anxiety', 'Anxiety', 'Anxiety & Stress', 'behaviourist', 'sub_behavior_modification', 'behavior modification', 0);
SELECT populate_problem_grid_mapping('anxiety', 'Anxiety', 'Anxiety & Stress', 'behaviourist', 'sub_behavioral_services', 'behavioral services', 1);

-- ============================================================================
-- BOARDING NEEDS
-- ============================================================================

-- Daycare
SELECT populate_problem_grid_mapping('daycare', 'Daycare', 'Daycare Services', 'boarding', 'sub_daycare', 'daycare', 0);

-- Overnight Boarding
SELECT populate_problem_grid_mapping('overnight_boarding', 'Overnight Boarding', 'Overnight Stay', 'boarding', 'sub_boarding_services', 'boarding services', 0);

-- ============================================================================
-- NUTRITION NEEDS
-- ============================================================================

-- Weight Management
SELECT populate_problem_grid_mapping('weight_management', 'Weight Management', 'Weight Loss/Gain', 'nutritionist', 'sub_nutrition_consultation', 'nutrition consultation', 0);
SELECT populate_problem_grid_mapping('weight_management', 'Weight Management', 'Weight Loss/Gain', 'nutritionist', 'sub_diet_planning', 'diet planning', 1);

-- Food Allergies
SELECT populate_problem_grid_mapping('allergies_sensitivities', 'Food Allergies', 'Allergies & Sensitivities', 'nutritionist', 'sub_nutrition_consultation', 'nutrition consultation', 0);
SELECT populate_problem_grid_mapping('allergies_sensitivities', 'Food Allergies', 'Allergies & Sensitivities', 'nutritionist', 'sub_special_diets', 'special diets', 1);

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

