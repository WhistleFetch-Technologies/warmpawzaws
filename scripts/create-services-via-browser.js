#!/usr/bin/env node
/**
 * Create Services in Service Catalog via Browser Automation
 * 
 * This script creates comprehensive pet care services for all roles and service styles
 * Uses browser automation to interact with Admin UI
 */

const services = [
  // ============================================================================
  // VETERINARY SERVICES
  // ============================================================================
  {
    service_id: 'vet_general_checkup',
    service_name: 'General Health Checkup',
    display_name: 'Complete Physical Examination',
    description: 'Comprehensive health checkup for your pet including vital signs, physical examination, and health assessment',
    category_id: 'veterinary',
    category_name: 'Veterinary Services',
    applicable_roles: ['veterinarian', 'vet_clinic'],
    service_style: 'at_center',
    base_price: 500.00,
    duration_minutes: 30,
    display_order: 1,
    is_package: false
  },
  {
    service_id: 'vet_vaccination',
    service_name: 'Vaccination',
    display_name: 'Core and Non-Core Vaccinations',
    description: 'Essential vaccinations to protect your pet from common diseases',
    category_id: 'veterinary',
    category_name: 'Veterinary Services',
    applicable_roles: ['veterinarian', 'vet_clinic'],
    service_style: 'at_center',
    base_price: 800.00,
    duration_minutes: 20,
    display_order: 2,
    is_package: false
  },
  {
    service_id: 'vet_home_visit',
    service_name: 'Home Visit Consultation',
    display_name: 'Veterinarian Visits Your Home',
    description: 'Convenient at-home veterinary consultation for pets who are stressed by clinic visits',
    category_id: 'veterinary',
    category_name: 'Veterinary Services',
    applicable_roles: ['veterinarian'],
    service_style: 'at_home',
    base_price: 1000.00,
    duration_minutes: 45,
    display_order: 7,
    is_package: false
  },
  {
    service_id: 'vet_tele_consult',
    service_name: 'Tele-Consultation',
    display_name: 'Online Video Consultation',
    description: 'Connect with veterinarian via video call for quick consultations and follow-ups',
    category_id: 'veterinary',
    category_name: 'Veterinary Services',
    applicable_roles: ['veterinarian', 'vet_clinic'],
    service_style: 'tele',
    base_price: 300.00,
    duration_minutes: 20,
    display_order: 8,
    is_package: false
  },
  
  // ============================================================================
  // DIAGNOSTIC SERVICES
  // ============================================================================
  {
    service_id: 'diag_xray',
    service_name: 'X-Ray',
    display_name: 'Digital X-Ray Imaging',
    description: 'Radiographic examination for bone fractures, joint issues, and internal structures',
    category_id: 'diagnostic',
    category_name: 'Diagnostics & Lab',
    applicable_roles: ['diagnostics_center', 'vet_clinic'],
    service_style: 'at_center',
    base_price: 1500.00,
    duration_minutes: 30,
    display_order: 11,
    is_package: false
  },
  {
    service_id: 'diag_home_sample',
    service_name: 'Home Sample Collection',
    display_name: 'Sample Collection at Home',
    description: 'Convenient at-home sample pickup for blood, urine, or stool tests',
    category_id: 'diagnostic',
    category_name: 'Diagnostics & Lab',
    applicable_roles: ['diagnostics_center'],
    service_style: 'at_home',
    base_price: 500.00,
    duration_minutes: 20,
    display_order: 18,
    is_package: false
  },
  
  // ============================================================================
  // GROOMING SERVICES
  // ============================================================================
  {
    service_id: 'groom_bath',
    service_name: 'Bath & Dry',
    display_name: 'Full Bath and Blow Dry',
    description: 'Complete bathing and drying service with premium pet shampoo',
    category_id: 'grooming',
    category_name: 'Grooming & Hygiene',
    applicable_roles: ['pet_groomer', 'pet_spa'],
    service_style: 'at_center',
    base_price: 600.00,
    duration_minutes: 45,
    display_order: 19,
    is_package: false
  },
  {
    service_id: 'groom_home',
    service_name: 'Home Grooming',
    display_name: 'At-Home Grooming Service',
    description: 'Professional grooming at your home for pets who prefer familiar environment',
    category_id: 'grooming',
    category_name: 'Grooming & Hygiene',
    applicable_roles: ['pet_groomer'],
    service_style: 'at_home',
    base_price: 1000.00,
    duration_minutes: 90,
    display_order: 26,
    is_package: false
  },
  
  // ============================================================================
  // TRAINING SERVICES
  // ============================================================================
  {
    service_id: 'train_basic_obedience',
    service_name: 'Basic Obedience Training',
    display_name: 'Fundamental Commands Training',
    description: 'Teach sit, stay, come, heel and basic commands',
    category_id: 'training',
    category_name: 'Training & Behavior',
    applicable_roles: ['pet_trainer'],
    service_style: 'at_center',
    base_price: 1500.00,
    duration_minutes: 60,
    display_order: 27,
    is_package: false
  },
  {
    service_id: 'train_home',
    service_name: 'Home Training Session',
    display_name: 'At-Home Training',
    description: 'Personalized training at your home for better results in familiar environment',
    category_id: 'training',
    category_name: 'Training & Behavior',
    applicable_roles: ['pet_trainer'],
    service_style: 'at_home',
    base_price: 1800.00,
    duration_minutes: 60,
    display_order: 33,
    is_package: false
  },
  
  // ============================================================================
  // WALKING SERVICES
  // ============================================================================
  {
    service_id: 'walk_30min',
    service_name: '30 Min Walk',
    display_name: 'Short Neighborhood Walk',
    description: '30 minute walking session for daily exercise',
    category_id: 'walking',
    category_name: 'Walking & Exercise',
    applicable_roles: ['pet_walker'],
    service_style: 'at_home',
    base_price: 200.00,
    duration_minutes: 30,
    display_order: 34,
    is_package: false
  },
  {
    service_id: 'walk_60min',
    service_name: '60 Min Walk',
    display_name: 'Extended Walk Session',
    description: '1 hour walking and exercise session',
    category_id: 'walking',
    category_name: 'Walking & Exercise',
    applicable_roles: ['pet_walker'],
    service_style: 'at_home',
    base_price: 350.00,
    duration_minutes: 60,
    display_order: 35,
    is_package: false
  },
  
  // ============================================================================
  // PHARMACY SERVICES
  // ============================================================================
  {
    service_id: 'pharmacy_medicine',
    service_name: 'Prescription Medicine',
    display_name: 'Veterinary Medications',
    description: 'Fill prescription medications as per veterinarian recommendation',
    category_id: 'pharmacy',
    category_name: 'Pharmacy & Medication',
    applicable_roles: ['pharmacy'],
    service_style: 'at_center',
    base_price: 500.00,
    duration_minutes: 15,
    display_order: 48,
    is_package: false
  },
  {
    service_id: 'pharmacy_delivery',
    service_name: 'Medicine Delivery',
    display_name: 'Home Delivery Service',
    description: 'Deliver medicines to your home for convenience',
    category_id: 'pharmacy',
    category_name: 'Pharmacy & Medication',
    applicable_roles: ['pharmacy'],
    service_style: 'delivery',
    base_price: 100.00,
    duration_minutes: 30,
    display_order: 50,
    is_package: false
  },
  
  // ============================================================================
  // NUTRITION SERVICES
  // ============================================================================
  {
    service_id: 'nutrition_consult',
    service_name: 'Nutrition Consultation',
    display_name: 'Diet Planning Session',
    description: 'Personalized diet plan consultation for optimal pet health',
    category_id: 'wellness',
    category_name: 'Wellness & Nutrition',
    applicable_roles: ['pet_nutritionist'],
    service_style: 'tele',
    base_price: 800.00,
    duration_minutes: 30,
    display_order: 51,
    is_package: false
  },
  {
    service_id: 'nutrition_meal_delivery',
    service_name: 'Custom Meal Delivery',
    display_name: 'Tailored Diet Meal Delivery',
    description: 'Daily delivery of custom-prepared meals based on nutrition plan',
    category_id: 'wellness',
    category_name: 'Wellness & Nutrition',
    applicable_roles: ['pet_nutritionist'],
    service_style: 'delivery',
    base_price: 500.00,
    duration_minutes: 0, // Daily service
    display_order: 52,
    is_package: false
  },
  
  // ============================================================================
  // SERVICE PACKAGES
  // ============================================================================
  {
    service_id: 'package_wellness',
    service_name: 'Wellness Package',
    display_name: 'Complete Wellness Checkup Package',
    description: 'General Checkup + Vaccination + Deworming - Save ₹100',
    category_id: 'veterinary',
    category_name: 'Veterinary Services',
    applicable_roles: ['veterinarian', 'vet_clinic'],
    service_style: 'at_center',
    base_price: 1500.00,
    duration_minutes: 65,
    display_order: 100,
    is_package: true,
    package_services: ['vet_general_checkup', 'vet_vaccination', 'vet_deworming']
  },
  {
    service_id: 'package_grooming_complete',
    service_name: 'Complete Grooming Package',
    display_name: 'Full Grooming Service Package',
    description: 'Bath + Haircut + Nail Trim + Ear Clean - Save ₹250',
    category_id: 'grooming',
    category_name: 'Grooming & Hygiene',
    applicable_roles: ['pet_groomer', 'pet_spa'],
    service_style: 'at_center',
    base_price: 1500.00,
    duration_minutes: 90,
    display_order: 101,
    is_package: true,
    package_services: ['groom_bath', 'groom_haircut', 'groom_nail', 'groom_ear']
  },
  {
    service_id: 'package_training_starter',
    service_name: 'Training Starter Pack',
    display_name: '4 Session Basic Training Package',
    description: '4 Basic Obedience Sessions - Save ₹1,000',
    category_id: 'training',
    category_name: 'Training & Behavior',
    applicable_roles: ['pet_trainer'],
    service_style: 'at_center',
    base_price: 5000.00,
    duration_minutes: 240,
    display_order: 102,
    is_package: true,
    package_services: ['train_basic_obedience']
  },
  {
    service_id: 'package_walking_monthly',
    service_name: 'Monthly Walking Package',
    display_name: '20 Walk Monthly Package',
    description: '20 x 60 Min Walks - Save ₹1,000',
    category_id: 'walking',
    category_name: 'Walking & Exercise',
    applicable_roles: ['pet_walker'],
    service_style: 'at_home',
    base_price: 6000.00,
    duration_minutes: 1200,
    display_order: 103,
    is_package: true,
    package_services: ['walk_60min']
  }
];

console.log(`Total services to create: ${services.length}`);
console.log(`Services: ${services.filter(s => !s.is_package).length}`);
console.log(`Packages: ${services.filter(s => s.is_package).length}`);

// Export for use in browser automation
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { services };
}
