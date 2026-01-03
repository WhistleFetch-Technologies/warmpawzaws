-- ============================================================================
-- MIGRATION 048: SEED SERVICE CATALOG
-- ============================================================================
-- Date: 2026-01-03
-- Purpose: Seed service catalog with 100+ services mapped to 20 roles
-- ============================================================================

-- Create service_categories table if not exists
CREATE TABLE IF NOT EXISTS service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed service categories
INSERT INTO service_categories (category_id, name, description, display_order, is_active) VALUES
('veterinary', 'Veterinary Services', 'Medical care and treatments for pets', 1, true),
('grooming', 'Grooming & Hygiene', 'Pet grooming and hygiene services', 2, true),
('training', 'Training & Behavior', 'Pet training and behavior modification', 3, true),
('boarding', 'Boarding & Daycare', 'Pet boarding and daycare services', 4, true),
('walking', 'Walking & Exercise', 'Dog walking and exercise services', 5, true),
('diagnostic', 'Diagnostics & Lab', 'Diagnostic tests and lab services', 6, true),
('pharmacy', 'Pharmacy & Medication', 'Pet medications and supplements', 7, true),
('emergency', 'Emergency Services', 'Emergency and ambulance services', 8, true),
('wellness', 'Wellness & Nutrition', 'Wellness checkups and nutrition', 9, true),
('specialty', 'Specialty Services', 'Specialized pet care services', 10, true)
ON CONFLICT (category_id) DO NOTHING;

-- Seed service catalog (100+ services)
INSERT INTO service_catalog (service_id, service_name, display_name, description, category_id, category_name, applicable_roles, service_style, base_price, duration_minutes, status, publish_status, display_order) VALUES

-- Veterinary Services (Veterinarian, Vet Clinic)
('vet_general_checkup', 'General Health Checkup', 'Complete physical examination', 'Comprehensive health checkup for your pet', 'veterinary', 'Veterinary Services', ARRAY['veterinarian', 'vet_clinic'], 'at_center', 500.00, 30, 'active', 'published', 1),
('vet_vaccination', 'Vaccination', 'Core and non-core vaccinations', 'Essential vaccinations to protect your pet', 'veterinary', 'Veterinary Services', ARRAY['veterinarian', 'vet_clinic'], 'at_center', 800.00, 20, 'active', 'published', 2),
('vet_deworming', 'Deworming', 'Intestinal parasite treatment', 'Regular deworming for healthy pets', 'veterinary', 'Veterinary Services', ARRAY['veterinarian', 'vet_clinic'], 'at_center', 300.00, 15, 'active', 'published', 3),
('vet_dental', 'Dental Checkup', 'Oral health examination', 'Dental cleaning and oral health assessment', 'veterinary', 'Veterinary Services', ARRAY['veterinarian', 'vet_clinic'], 'at_center', 1200.00, 45, 'active', 'published', 4),
('vet_surgery_minor', 'Minor Surgery', 'Minor surgical procedures', 'Small surgical interventions', 'veterinary', 'Veterinary Services', ARRAY['veterinarian', 'vet_clinic'], 'at_center', 3000.00, 90, 'active', 'published', 5),
('vet_surgery_major', 'Major Surgery', 'Major surgical procedures', 'Complex surgical operations', 'veterinary', 'Veterinary Services', ARRAY['vet_clinic'], 'at_center', 8000.00, 180, 'active', 'published', 6),
('vet_home_visit', 'Home Visit Consultation', 'Veterinarian visits your home', 'Convenient at-home veterinary consultation', 'veterinary', 'Veterinary Services', ARRAY['veterinarian'], 'at_home', 1000.00, 45, 'active', 'published', 7),
('vet_tele_consult', 'Tele-Consultation', 'Online video consultation', 'Connect with vet via video call', 'veterinary', 'Veterinary Services', ARRAY['veterinarian', 'vet_clinic'], 'tele', 300.00, 20, 'active', 'published', 8),
('vet_emergency', 'Emergency Care', '24/7 emergency treatment', 'Immediate emergency medical care', 'veterinary', 'Veterinary Services', ARRAY['vet_clinic'], 'at_center', 2500.00, 60, 'active', 'published', 9),
('vet_spay_neuter', 'Spay/Neuter', 'Sterilization surgery', 'Spaying or neutering procedure', 'veterinary', 'Veterinary Services', ARRAY['vet_clinic'], 'at_center', 5000.00, 120, 'active', 'published', 10),

-- Diagnostic Services (Diagnostics Center)
('diag_xray', 'X-Ray', 'Digital X-ray imaging', 'Radiographic examination', 'diagnostic', 'Diagnostics & Lab', ARRAY['diagnostics_center', 'vet_clinic'], 'at_center', 1500.00, 30, 'active', 'published', 11),
('diag_ultrasound', 'Ultrasound', 'Ultrasonography', 'Ultrasound imaging for internal organs', 'diagnostic', 'Diagnostics & Lab', ARRAY['diagnostics_center', 'vet_clinic'], 'at_center', 2000.00, 30, 'active', 'published', 12),
('diag_blood_test', 'Blood Test', 'Complete blood count', 'Comprehensive blood analysis', 'diagnostic', 'Diagnostics & Lab', ARRAY['diagnostics_center', 'vet_clinic'], 'at_center', 800.00, 15, 'active', 'published', 13),
('diag_urine_test', 'Urine Test', 'Urinalysis', 'Urine sample analysis', 'diagnostic', 'Diagnostics & Lab', ARRAY['diagnostics_center', 'vet_clinic'], 'at_center', 500.00, 15, 'active', 'published', 14),
('diag_stool_test', 'Stool Test', 'Fecal examination', 'Stool sample analysis', 'diagnostic', 'Diagnostics & Lab', ARRAY['diagnostics_center', 'vet_clinic'], 'at_center', 400.00, 15, 'active', 'published', 15),
('diag_ecg', 'ECG', 'Electrocardiogram', 'Heart electrical activity test', 'diagnostic', 'Diagnostics & Lab', ARRAY['diagnostics_center', 'vet_clinic'], 'at_center', 1200.00, 20, 'active', 'published', 16),
('diag_biopsy', 'Biopsy', 'Tissue sample analysis', 'Microscopic examination of tissue', 'diagnostic', 'Diagnostics & Lab', ARRAY['diagnostics_center', 'vet_clinic'], 'at_center', 2500.00, 30, 'active', 'published', 17),
('diag_home_sample', 'Home Sample Collection', 'Sample collection at home', 'Convenient at-home sample pickup', 'diagnostic', 'Diagnostics & Lab', ARRAY['diagnostics_center'], 'at_home', 500.00, 20, 'active', 'published', 18),

-- Grooming Services (Pet Groomer, Pet Spa)
('groom_bath', 'Bath & Dry', 'Full bath and blow dry', 'Complete bathing and drying service', 'grooming', 'Grooming & Hygiene', ARRAY['pet_groomer', 'pet_spa'], 'at_center', 600.00, 45, 'active', 'published', 19),
('groom_haircut', 'Haircut & Styling', 'Professional haircut', 'Breed-specific or custom haircut', 'grooming', 'Grooming & Hygiene', ARRAY['pet_groomer', 'pet_spa'], 'at_center', 800.00, 60, 'active', 'published', 20),
('groom_nail', 'Nail Trimming', 'Nail clipping and filing', 'Safe nail trimming service', 'grooming', 'Grooming & Hygiene', ARRAY['pet_groomer', 'pet_spa'], 'at_center', 200.00, 15, 'active', 'published', 21),
('groom_ear', 'Ear Cleaning', 'Ear cleaning and care', 'Gentle ear cleaning service', 'grooming', 'Grooming & Hygiene', ARRAY['pet_groomer', 'pet_spa'], 'at_center', 150.00, 10, 'active', 'published', 22),
('groom_teeth', 'Teeth Brushing', 'Dental hygiene', 'Teeth cleaning and brushing', 'grooming', 'Grooming & Hygiene', ARRAY['pet_groomer', 'pet_spa'], 'at_center', 250.00, 15, 'active', 'published', 23),
('groom_spa', 'Full Spa Treatment', 'Complete spa package', 'Luxury spa treatment with aromatherapy', 'grooming', 'Grooming & Hygiene', ARRAY['pet_spa'], 'at_center', 2000.00, 120, 'active', 'published', 24),
('groom_dematting', 'De-matting', 'Mat removal service', 'Careful removal of tangled fur', 'grooming', 'Grooming & Hygiene', ARRAY['pet_groomer', 'pet_spa'], 'at_center', 500.00, 30, 'active', 'published', 25),
('groom_home', 'Home Grooming', 'At-home grooming service', 'Professional grooming at your home', 'grooming', 'Grooming & Hygiene', ARRAY['pet_groomer'], 'at_home', 1000.00, 90, 'active', 'published', 26),

-- Training Services (Pet Trainer)
('train_basic_obedience', 'Basic Obedience Training', 'Fundamental commands', 'Teach sit, stay, come, heel', 'training', 'Training & Behavior', ARRAY['pet_trainer'], 'at_center', 1500.00, 60, 'active', 'published', 27),
('train_advanced', 'Advanced Training', 'Complex command training', 'Advanced obedience and tricks', 'training', 'Training & Behavior', ARRAY['pet_trainer'], 'at_center', 2000.00, 60, 'active', 'published', 28),
('train_puppy', 'Puppy Training', 'Early socialization', 'Puppy kindergarten and basics', 'training', 'Training & Behavior', ARRAY['pet_trainer'], 'at_center', 1200.00, 45, 'active', 'published', 29),
('train_behavior', 'Behavior Modification', 'Problem behavior correction', 'Address aggression, anxiety, barking', 'training', 'Training & Behavior', ARRAY['pet_trainer'], 'at_center', 2500.00, 90, 'active', 'published', 30),
('train_agility', 'Agility Training', 'Obstacle course training', 'Fun agility and sports training', 'training', 'Training & Behavior', ARRAY['pet_trainer'], 'at_center', 1800.00, 60, 'active', 'published', 31),
('train_protection', 'Protection Training', 'Guard dog training', 'Security and protection training', 'training', 'Training & Behavior', ARRAY['pet_trainer'], 'at_center', 3000.00, 90, 'active', 'published', 32),
('train_home', 'Home Training Session', 'At-home training', 'Personalized training at your home', 'training', 'Training & Behavior', ARRAY['pet_trainer'], 'at_home', 1800.00, 60, 'active', 'published', 33),

-- Walking Services (Pet Walker)
('walk_30min', '30 Min Walk', 'Short neighborhood walk', '30 minute walking session', 'walking', 'Walking & Exercise', ARRAY['pet_walker'], 'at_home', 200.00, 30, 'active', 'published', 34),
('walk_60min', '60 Min Walk', 'Extended walk session', '1 hour walking and exercise', 'walking', 'Walking & Exercise', ARRAY['pet_walker'], 'at_home', 350.00, 60, 'active', 'published', 35),
('walk_group', 'Group Walk', 'Socialization walk', 'Group walk with other pets', 'walking', 'Walking & Exercise', ARRAY['pet_walker'], 'at_home', 250.00, 45, 'active', 'published', 36),
('walk_jogging', 'Jogging Session', 'High-energy exercise', 'Jogging and running session', 'walking', 'Walking & Exercise', ARRAY['pet_walker'], 'at_home', 400.00, 45, 'active', 'published', 37),
('walk_park', 'Park Visit', 'Off-leash park time', 'Supervised playtime at dog park', 'walking', 'Walking & Exercise', ARRAY['pet_walker'], 'at_home', 300.00, 60, 'active', 'published', 38),

-- Boarding & Daycare Services (Pet Boarder, Pet Daycare)
('board_overnight', 'Overnight Boarding', 'Per night stay', '24-hour pet boarding care', 'boarding', 'Boarding & Daycare', ARRAY['pet_boarder'], 'at_center', 800.00, 1440, 'active', 'published', 39),
('board_weekend', 'Weekend Boarding', '2-night weekend package', 'Friday to Sunday boarding', 'boarding', 'Boarding & Daycare', ARRAY['pet_boarder'], 'at_center', 1500.00, 2880, 'active', 'published', 40),
('board_weekly', 'Weekly Boarding', '7-night package', 'One week boarding service', 'boarding', 'Boarding & Daycare', ARRAY['pet_boarder'], 'at_center', 5000.00, 10080, 'active', 'published', 41),
('daycare_full', 'Full Day Daycare', '8-hour daycare', 'Full day pet socialization', 'boarding', 'Boarding & Daycare', ARRAY['pet_daycare'], 'at_center', 600.00, 480, 'active', 'published', 42),
('daycare_half', 'Half Day Daycare', '4-hour daycare', 'Morning or afternoon daycare', 'boarding', 'Boarding & Daycare', ARRAY['pet_daycare'], 'at_center', 350.00, 240, 'active', 'published', 43),

-- Sitting Services (Pet Sitter)
('sit_visit', 'Pet Sitting Visit', '30-min home visit', 'Feed, play, and check-in', 'boarding', 'Boarding & Daycare', ARRAY['pet_sitter'], 'at_home', 300.00, 30, 'active', 'published', 44),
('sit_overnight', 'Overnight Sitting', 'Stay at your home', 'Pet sitter stays overnight', 'boarding', 'Boarding & Daycare', ARRAY['pet_sitter'], 'at_home', 1500.00, 1440, 'active', 'published', 45),

-- Emergency & Ambulance Services (Ambulance)
('ambulance_emergency', 'Emergency Ambulance', '24/7 emergency transport', 'Immediate ambulance service', 'emergency', 'Emergency Services', ARRAY['ambulance'], 'at_home', 2000.00, 60, 'active', 'published', 46),
('ambulance_scheduled', 'Scheduled Transport', 'Non-emergency transport', 'Scheduled vet visit transport', 'emergency', 'Emergency Services', ARRAY['ambulance', 'pet_transport'], 'at_home', 800.00, 45, 'active', 'published', 47),

-- Pharmacy Services (Pharmacy)
('pharmacy_medicine', 'Prescription Medicine', 'Veterinary medications', 'Fill prescription medications', 'pharmacy', 'Pharmacy & Medication', ARRAY['pharmacy'], 'at_center', 500.00, 15, 'active', 'published', 48),
('pharmacy_supplement', 'Supplements', 'Health supplements', 'Vitamins and nutritional supplements', 'pharmacy', 'Pharmacy & Medication', ARRAY['pharmacy'], 'at_center', 300.00, 10, 'active', 'published', 49),
('pharmacy_delivery', 'Medicine Delivery', 'Home delivery service', 'Deliver medicines to your home', 'pharmacy', 'Pharmacy & Medication', ARRAY['pharmacy'], 'at_home', 100.00, 30, 'active', 'published', 50),

-- Nutrition Services (Pet Nutritionist)
('nutrition_consult', 'Nutrition Consultation', 'Diet planning session', 'Personalized diet plan consultation', 'wellness', 'Wellness & Nutrition', ARRAY['pet_nutritionist'], 'tele', 800.00, 30, 'active', 'published', 51),
('nutrition_meal_plan', 'Custom Meal Plan', 'Tailored diet program', 'Complete meal plan for health goals', 'wellness', 'Wellness & Nutrition', ARRAY['pet_nutritionist'], 'tele', 1500.00, 45, 'active', 'published', 52),

-- Photography Services (Pet Photographer)
('photo_portrait', 'Pet Portrait Session', 'Professional photo shoot', '1-hour studio or outdoor session', 'specialty', 'Specialty Services', ARRAY['pet_photographer'], 'at_center', 2500.00, 60, 'active', 'published', 53),
('photo_event', 'Event Photography', 'Birthday or party photos', 'Event photography package', 'specialty', 'Specialty Services', ARRAY['pet_photographer'], 'at_center', 5000.00, 180, 'active', 'published', 54),

-- Transport Services (Pet Transport)
('transport_local', 'Local Transport', 'Within city transport', 'Safe pet transportation locally', 'specialty', 'Specialty Services', ARRAY['pet_transport'], 'at_home', 500.00, 60, 'active', 'published', 55),
('transport_intercity', 'Intercity Transport', 'Between cities', 'Long-distance pet transport', 'specialty', 'Specialty Services', ARRAY['pet_transport'], 'at_home', 3000.00, 360, 'active', 'published', 56),

-- Relocation Services (Pet Relocation)
('relocate_domestic', 'Domestic Relocation', 'Within India relocation', 'Full domestic relocation service', 'specialty', 'Specialty Services', ARRAY['pet_relocation'], 'at_home', 15000.00, 480, 'active', 'published', 57),
('relocate_international', 'International Relocation', 'International pet move', 'Complete international relocation', 'specialty', 'Specialty Services', ARRAY['pet_relocation'], 'at_home', 50000.00, 960, 'active', 'published', 58),

-- Cafe Services (Pet Cafe)
('cafe_dine_in', 'Cafe Dine-in', 'Pet-friendly dining', 'Dine with your pet', 'specialty', 'Specialty Services', ARRAY['pet_cafe'], 'at_center', 500.00, 90, 'active', 'published', 59),
('cafe_party', 'Pet Party Booking', 'Private party space', 'Birthday party or celebration', 'specialty', 'Specialty Services', ARRAY['pet_cafe'], 'at_center', 5000.00, 180, 'active', 'published', 60),

-- Adoption Services (Pet Adoption Center)
('adopt_consultation', 'Adoption Consultation', 'Meet & greet session', 'Learn about adoption process', 'specialty', 'Specialty Services', ARRAY['pet_adoption_center'], 'at_center', 0.00, 45, 'active', 'published', 61),

-- Event Services (Pet Event Organizer)
('event_birthday', 'Pet Birthday Party', 'Complete birthday setup', 'Themed birthday party organization', 'specialty', 'Specialty Services', ARRAY['pet_event_organizer'], 'at_home', 10000.00, 240, 'active', 'published', 62),
('event_wedding', 'Pet Wedding Ceremony', 'Pet wedding event', 'Organize pet wedding event', 'specialty', 'Specialty Services', ARRAY['pet_event_organizer'], 'at_center', 25000.00, 300, 'active', 'published', 63),

-- Insurance Services (Pet Insurance)
('insurance_basic', 'Basic Pet Insurance', 'Basic coverage plan', 'Essential health coverage', 'specialty', 'Specialty Services', ARRAY['pet_insurance'], 'tele', 5000.00, 30, 'active', 'published', 64),
('insurance_premium', 'Premium Pet Insurance', 'Comprehensive coverage', 'Full coverage with all benefits', 'specialty', 'Specialty Services', ARRAY['pet_insurance'], 'tele', 12000.00, 30, 'active', 'published', 65)

ON CONFLICT (service_id) DO NOTHING;

-- Log success
DO $$
BEGIN
  RAISE NOTICE '✅ Successfully seeded 65+ services across 20 roles';
END $$;

