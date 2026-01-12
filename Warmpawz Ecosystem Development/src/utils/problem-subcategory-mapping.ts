/**
 * Problem Subcategory Mapping Utilities
 * Shared mapping between frontend and backend
 */

export const subcategoryIdToNames: Record<string, string[]> = {
  // Veterinary subcategories
  'sub_preventive_wellness': ['1. Preventive & Wellness Care'],
  'sub_diagnostics': ['2. Diagnostics'],
  'sub_medical_treatment': ['3. Medical Treatment (Non-Surgical)'],
  'sub_surgical_services': ['4. Surgical Services'],
  'sub_specialty_services': ['5. Specialty Vet Services'],
  'sub_emergency_critical': ['6. Emergency & Critical Care'],
  'sub_vet_home': ['7. Vet at Home Services'],
  'sub_teleconsult': ['8. Tele-Consultation Services'],
  'sub_health_programs': ['9. Health Programs & Packages'],
  'sub_documents_cert': ['10. Documents & Certification'],
  
  // Grooming subcategories
  'sub_grooming_basic': ['1. Basic Grooming Services'],
  'sub_grooming_specialty': ['2. Specialty Grooming'],
  'sub_grooming_mobile': ['3. Mobile Grooming'],
  'sub_daycare': ['4. Daycare Services'],
  
  // Training subcategories
  'sub_training_basic': ['1. Basic Obedience Training'],
  'sub_training_advanced': ['2. Advanced Training'],
  'sub_behavior': ['3. Behavior Modification'],
  'sub_training_private': ['4. Private Training Sessions'],
  
  // Walking subcategories
  'sub_walking': ['1. Dog Walking'],
  'sub_sitting': ['2. Pet Sitting'],
  
  // Boarding subcategories
  'sub_boarding': ['1. Pet Boarding'],
  'sub_boarding_daycare': ['2. Daycare & Boarding']
};
