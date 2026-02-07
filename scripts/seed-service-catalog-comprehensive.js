#!/usr/bin/env node
/**
 * ============================================================================
 * COMPREHENSIVE SERVICE CATALOG SEED – VET + TRAINER + GROOMER + WALKER + BEHAVIORIST
 * ============================================================================
 *
 * - Adds new specializations: diagnostics, reproductive, palliative (vet).
 * - Seeds full vet service catalog from provided list (consultation, preventive,
 *   medical, surgical, dental, emergency, dermatology, reproductive, pediatric/
 *   geriatric, euthanasia, documentation, in-clinic, lab/diagnostics).
 * - Expands trainer, groomer, walker, behaviorist services with India metro
 *   pricing (research: Mumbai, Delhi, Bangalore 2024–2025).
 * - Does NOT remove existing services; only inserts or updates by service_id.
 *
 * Prerequisites: Migration 524 applied; specialization_master seeded (run
 * seed-specialization-master.js first if you added new specs here).
 *
 * Usage: ENVIRONMENT=dev node scripts/seed-service-catalog-comprehensive.js
 * ============================================================================
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';

let DB_HOST = process.env.DB_HOST || process.env.RDS_HOSTNAME;
let DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
let DB_NAME = process.env.DB_NAME || process.env.RDS_DB_NAME;
let DB_USER = process.env.DB_USER || process.env.RDS_USERNAME;
const DB_SECRET_ARN = process.env.DB_SECRET_ARN;
let DB_PASSWORD = process.env.DB_PASSWORD || process.env.RDS_PASSWORD;

const secretsClient = new SecretsManagerClient({ region: AWS_REGION });

async function fetchDbCredentials() {
  if (DB_USER && DB_PASSWORD) return;
  const secretName = DB_SECRET_ARN || `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  try {
    const response = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
    const secret = JSON.parse(response.SecretString);
    DB_USER = DB_USER || secret.username || secret.Username || secret.user;
    DB_PASSWORD = DB_PASSWORD || secret.password || secret.Password;
    if (!DB_PASSWORD) throw new Error('No password in secret');
  } catch (e) {
    if (!DB_USER || !DB_PASSWORD) throw e;
  }
}

// Vet roles (canonical + legacy)
const VET_ROLES = ['veterinarian', 'vet_clinic', 'vet_solo'];
const WALKER_ROLES = ['pet_walker', 'walker', 'dog_walker'];
const TRAINER_ROLES = ['pet_trainer', 'trainer_center', 'trainer_solo', 'trainer'];
const GROOMER_ROLES = ['pet_groomer', 'groomer_center', 'groomer_solo', 'groomer', 'pet_spa'];
const BEHAVIORIST_ROLES = ['pet_behaviorist', 'trainer_solo', 'trainer_center', 'pet_trainer'];

// New specializations to add for vet (diagnostics, reproductive, palliative)
const NEW_SPECIALIZATIONS = [
  { specialization_id: 'diagnostics', name: 'Lab & Diagnostics', display_name: 'Lab & Diagnostics', description: 'Lab tests, imaging, and diagnostic procedures', category_id: 'veterinary', applicable_roles: ['vet_solo', 'vet_clinic', 'veterinarian'], icon_name: 'Microscope', icon_color: 'text-slate-500' },
  { specialization_id: 'reproductive', name: 'Reproductive Care', display_name: 'Reproductive & Breeding', description: 'Pregnancy, breeding, and neonatal care', category_id: 'veterinary', applicable_roles: ['vet_solo', 'vet_clinic', 'veterinarian'], icon_name: 'Heart', icon_color: 'text-pink-500' },
  { specialization_id: 'palliative', name: 'Palliative & End-of-Life', display_name: 'Palliative & End-of-Life Care', description: 'Euthanasia, palliative care, and grief support', category_id: 'veterinary', applicable_roles: ['vet_solo', 'vet_clinic', 'veterinarian'], icon_name: 'Flower2', icon_color: 'text-gray-500' },
];

// ---------- FULL SERVICE CATALOG: VET (user list) + TRAINER + GROOMER + WALKER + BEHAVIORIST (India metro) ----------
// Prices in INR (India metro research). specialization_ids match specialization_master.
const SERVICES = [
  // ==================== VETERINARY – Consultation & Checkups ====================
  { service_id: 'vet_general_consultation', service_name: 'General Consultation', display_name: 'General Consultation', description: 'Routine consultation and examination', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 600, duration_minutes: 25, display_order: 1, specialization_ids: ['medicine'] },
  { service_id: 'vet_puppy_kitten_first_visit', service_name: 'Puppy / Kitten First Visit', display_name: 'Puppy / Kitten First Visit', description: 'First wellness visit for puppies and kittens', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 800, duration_minutes: 40, display_order: 2, specialization_ids: ['medicine'] },
  { service_id: 'vet_general_health_checkup', service_name: 'General Health Check-up', display_name: 'General Health Check-up', description: 'Complete physical examination', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 700, duration_minutes: 30, display_order: 3, specialization_ids: ['medicine'] },
  { service_id: 'vet_sick_pet_consultation', service_name: 'Sick Pet Consultation', display_name: 'Sick Pet Consultation', description: 'Consultation for ill or symptomatic pets', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 650, duration_minutes: 30, display_order: 4, specialization_ids: ['medicine'] },
  { service_id: 'vet_followup_consultation', service_name: 'Follow-up Consultation', display_name: 'Follow-up Consultation', description: 'Follow-up visit after treatment', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 500, duration_minutes: 20, display_order: 5, specialization_ids: ['medicine'] },
  { service_id: 'vet_second_opinion', service_name: 'Second Opinion Consultation', display_name: 'Second Opinion Consultation', description: 'Second opinion from another vet', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 800, duration_minutes: 35, display_order: 6, specialization_ids: ['medicine'] },
  { service_id: 'vet_senior_pet_consultation', service_name: 'Senior Pet Consultation', display_name: 'Senior Pet Consultation', description: 'Health assessment for senior pets', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 750, duration_minutes: 35, display_order: 7, specialization_ids: ['medicine'] },

  // ==================== VETERINARY – Preventive ====================
  { service_id: 'vet_preventive_care_package', service_name: 'Preventive Care Package', display_name: 'Preventive Care (Packages)', description: 'Custom preventive care packages', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1500, duration_minutes: 0, display_order: 10, specialization_ids: ['medicine', 'vaccination'] },
  { service_id: 'vet_vaccination_core', service_name: 'Vaccination (Core & Non-Core)', display_name: 'Vaccination (Core & Non-Core)', description: 'Core and non-core vaccinations', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 900, duration_minutes: 20, display_order: 11, specialization_ids: ['vaccination'] },
  { service_id: 'vet_annual_health_package', service_name: 'Annual Health Check Packages', display_name: 'Annual Health Check Packages', description: 'Annual wellness package', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 2000, duration_minutes: 60, display_order: 12, specialization_ids: ['medicine', 'vaccination'] },
  { service_id: 'vet_deworming', service_name: 'Deworming', display_name: 'Deworming', description: 'Intestinal parasite treatment', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 350, duration_minutes: 15, display_order: 13, specialization_ids: ['medicine'] },
  { service_id: 'vet_external_parasite', service_name: 'External Parasite Control', display_name: 'External Parasite Control (Ticks/Fleas/Mites)', description: 'Ticks, fleas, and mites treatment', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 450, duration_minutes: 20, display_order: 14, specialization_ids: ['medicine'] },
  { service_id: 'vet_nutritional_counselling', service_name: 'Nutritional Counselling', display_name: 'Nutritional Counselling', description: 'Diet and nutrition advice', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 600, duration_minutes: 30, display_order: 15, specialization_ids: ['medicine'] },
  { service_id: 'vet_preventive_wellness_plans', service_name: 'Preventive Wellness Plans', display_name: 'Preventive Wellness Plans', description: 'Ongoing wellness plans', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 2500, duration_minutes: 0, display_order: 16, specialization_ids: ['medicine', 'vaccination'] },

  // ==================== VETERINARY – Medical Treatment ====================
  { service_id: 'vet_fever_infection', service_name: 'Fever & Infection Management', display_name: 'Fever & Infection Management', description: 'Treatment for fever and infections', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 800, duration_minutes: 30, display_order: 20, specialization_ids: ['medicine'] },
  { service_id: 'vet_gi_disorders', service_name: 'Gastrointestinal Disorders', display_name: 'Gastrointestinal Disorders', description: 'GI condition treatment', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 850, duration_minutes: 30, display_order: 21, specialization_ids: ['medicine'] },
  { service_id: 'vet_respiratory', service_name: 'Respiratory Conditions', display_name: 'Respiratory Conditions', description: 'Respiratory illness treatment', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 850, duration_minutes: 30, display_order: 22, specialization_ids: ['medicine'] },
  { service_id: 'vet_skin_allergy', service_name: 'Skin & Allergy Treatment', display_name: 'Skin & Allergy Treatment', description: 'Skin and allergy management', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 900, duration_minutes: 30, display_order: 23, specialization_ids: ['dermatology'] },
  { service_id: 'vet_uti', service_name: 'Urinary Tract Disorders', display_name: 'Urinary Tract Disorders', description: 'UTI and urinary condition treatment', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 900, duration_minutes: 30, display_order: 24, specialization_ids: ['medicine'] },
  { service_id: 'vet_liver_kidney', service_name: 'Liver & Kidney Disease Management', display_name: 'Liver & Kidney Disease Management', description: 'Liver and kidney condition care', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1200, duration_minutes: 40, display_order: 25, specialization_ids: ['medicine'] },
  { service_id: 'vet_endocrine', service_name: 'Endocrine Disorders', display_name: 'Endocrine Disorders (Diabetes, Thyroid)', description: 'Diabetes, thyroid and hormone management', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1100, duration_minutes: 35, display_order: 26, specialization_ids: ['medicine'] },
  { service_id: 'vet_cardiac', service_name: 'Cardiac Condition Management', display_name: 'Cardiac Condition Management', description: 'Heart condition care', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1200, duration_minutes: 40, display_order: 27, specialization_ids: ['cardiology'] },
  { service_id: 'vet_pain_management', service_name: 'Pain Management', display_name: 'Pain Management', description: 'Pain relief and management', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 900, duration_minutes: 30, display_order: 28, specialization_ids: ['medicine'] },
  { service_id: 'vet_chronic_disease', service_name: 'Chronic Disease Management', display_name: 'Chronic Disease Management', description: 'Ongoing chronic condition care', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1000, duration_minutes: 35, display_order: 29, specialization_ids: ['medicine'] },

  // ==================== VETERINARY – Surgical ====================
  { service_id: 'vet_soft_tissue_surgery', service_name: 'Soft Tissue Surgery', display_name: 'Soft Tissue Surgery', description: 'General soft tissue procedures', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['vet_clinic', 'veterinarian'], service_style: 'at_center', base_price: 4000, duration_minutes: 90, display_order: 35, specialization_ids: ['surgery'] },
  { service_id: 'vet_spay', service_name: 'Spay (Female Sterilisation)', display_name: 'Spay (Female Sterilisation)', description: 'Female sterilisation surgery', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['vet_clinic'], service_style: 'at_center', base_price: 5500, duration_minutes: 120, display_order: 36, specialization_ids: ['surgery'] },
  { service_id: 'vet_neuter', service_name: 'Neuter (Male Sterilisation)', display_name: 'Neuter (Male Sterilisation)', description: 'Male sterilisation surgery', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['vet_clinic'], service_style: 'at_center', base_price: 4500, duration_minutes: 90, display_order: 37, specialization_ids: ['surgery'] },
  { service_id: 'vet_tumour_removal', service_name: 'Tumour / Lump Removal', display_name: 'Tumour / Lump Removal', description: 'Tumour or lump removal surgery', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['vet_clinic', 'veterinarian'], service_style: 'at_center', base_price: 5000, duration_minutes: 90, display_order: 38, specialization_ids: ['surgery'] },
  { service_id: 'vet_wound_abscess_surgery', service_name: 'Wound & Abscess Surgery', display_name: 'Wound & Abscess Surgery', description: 'Wound repair and abscess drainage', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 3500, duration_minutes: 60, display_order: 39, specialization_ids: ['surgery'] },
  { service_id: 'vet_hernia_repair', service_name: 'Hernia Repair', display_name: 'Hernia Repair', description: 'Hernia repair surgery', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['vet_clinic'], service_style: 'at_center', base_price: 4500, duration_minutes: 90, display_order: 40, specialization_ids: ['surgery'] },
  { service_id: 'vet_emergency_surgery', service_name: 'Emergency Surgery', display_name: 'Emergency Surgery', description: 'Emergency surgical procedure', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['vet_clinic'], service_style: 'at_center', base_price: 8000, duration_minutes: 120, display_order: 41, specialization_ids: ['surgery', 'emergency'] },

  // ==================== VETERINARY – Orthopaedics ====================
  { service_id: 'vet_fracture_treatment', service_name: 'Fracture Treatment', display_name: 'Fracture Treatment', description: 'Bone fracture treatment', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['vet_clinic'], service_style: 'at_center', base_price: 6000, duration_minutes: 90, display_order: 45, specialization_ids: ['orthopedic'] },
  { service_id: 'vet_bone_plating', service_name: 'Bone Plating / Pinning', display_name: 'Bone Plating / Pinning', description: 'Orthopaedic fixation', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['vet_clinic'], service_style: 'at_center', base_price: 12000, duration_minutes: 150, display_order: 46, specialization_ids: ['orthopedic'] },
  { service_id: 'vet_joint_surgery', service_name: 'Joint Surgery', display_name: 'Joint Surgery', description: 'Joint surgery procedures', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['vet_clinic'], service_style: 'at_center', base_price: 10000, duration_minutes: 120, display_order: 47, specialization_ids: ['orthopedic'] },
  { service_id: 'vet_ligament_repair', service_name: 'Ligament Repair', display_name: 'Ligament Repair', description: 'Ligament repair surgery', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['vet_clinic'], service_style: 'at_center', base_price: 8000, duration_minutes: 100, display_order: 48, specialization_ids: ['orthopedic'] },
  { service_id: 'vet_lameness_eval', service_name: 'Lameness Evaluation', display_name: 'Lameness Evaluation', description: 'Gait and lameness assessment', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 800, duration_minutes: 30, display_order: 49, specialization_ids: ['orthopedic'] },

  // ==================== VETERINARY – Dental ====================
  { service_id: 'vet_dental_checkup', service_name: 'Dental Check-up', display_name: 'Dental Check-up', description: 'Oral health examination', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 500, duration_minutes: 20, display_order: 52, specialization_ids: ['dentistry'] },
  { service_id: 'vet_scaling_polishing', service_name: 'Scaling & Polishing', display_name: 'Scaling & Polishing', description: 'Dental scaling and polishing', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1800, duration_minutes: 45, display_order: 53, specialization_ids: ['dentistry'] },
  { service_id: 'vet_tooth_extraction', service_name: 'Tooth Extraction', display_name: 'Tooth Extraction', description: 'Tooth extraction procedure', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 2500, duration_minutes: 45, display_order: 54, specialization_ids: ['dentistry'] },
  { service_id: 'vet_oral_infection', service_name: 'Oral Infection Treatment', display_name: 'Oral Infection Treatment', description: 'Treatment for oral infections', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1200, duration_minutes: 30, display_order: 55, specialization_ids: ['dentistry'] },
  { service_id: 'vet_gum_disease', service_name: 'Gum Disease Management', display_name: 'Gum Disease Management', description: 'Gum disease treatment', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1500, duration_minutes: 35, display_order: 56, specialization_ids: ['dentistry'] },

  // ==================== VETERINARY – Emergency & Critical Care ====================
  { service_id: 'vet_emergency_consultation', service_name: 'Emergency Consultation', display_name: 'Emergency Consultation', description: 'Emergency vet consultation', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1500, duration_minutes: 30, display_order: 58, specialization_ids: ['emergency'] },
  { service_id: 'vet_trauma_care', service_name: 'Trauma & Accident Care', display_name: 'Trauma & Accident Care', description: 'Trauma and accident treatment', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['vet_clinic', 'veterinarian'], service_style: 'at_center', base_price: 3500, duration_minutes: 60, display_order: 59, specialization_ids: ['emergency'] },
  { service_id: 'vet_poisoning_toxicity', service_name: 'Poisoning / Toxicity Management', display_name: 'Poisoning / Toxicity Management', description: 'Poisoning and toxicity treatment', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['vet_clinic', 'veterinarian'], service_style: 'at_center', base_price: 2500, duration_minutes: 60, display_order: 60, specialization_ids: ['emergency'] },
  { service_id: 'vet_critical_care_stabilisation', service_name: 'Critical Care Stabilisation', display_name: 'Critical Care Stabilisation', description: 'Critical care stabilisation', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['vet_clinic'], service_style: 'at_center', base_price: 5000, duration_minutes: 90, display_order: 61, specialization_ids: ['emergency'] },
  { service_id: 'vet_seizure_management', service_name: 'Seizure Management', display_name: 'Seizure Management', description: 'Seizure assessment and management', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 2000, duration_minutes: 45, display_order: 62, specialization_ids: ['emergency', 'neurology'] },

  // ==================== VETERINARY – Dermatology ====================
  { service_id: 'vet_skin_infection', service_name: 'Skin Infection Treatment', display_name: 'Skin Infection Treatment', description: 'Skin infection treatment', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 900, duration_minutes: 30, display_order: 65, specialization_ids: ['dermatology'] },
  { service_id: 'vet_allergy_testing', service_name: 'Allergy Testing & Management', display_name: 'Allergy Testing & Management', description: 'Allergy testing and management', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 2500, duration_minutes: 45, display_order: 66, specialization_ids: ['dermatology'] },
  { service_id: 'vet_mange_treatment', service_name: 'Mange Treatment', display_name: 'Mange Treatment', description: 'Mange treatment', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 800, duration_minutes: 25, display_order: 67, specialization_ids: ['dermatology'] },
  { service_id: 'vet_fungal_infection', service_name: 'Fungal Infection Treatment', display_name: 'Fungal Infection Treatment', description: 'Fungal skin infection treatment', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 900, duration_minutes: 30, display_order: 68, specialization_ids: ['dermatology'] },
  { service_id: 'vet_chronic_skin_disease', service_name: 'Chronic Skin Disease Care', display_name: 'Chronic Skin Disease Care', description: 'Ongoing chronic skin condition care', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1000, duration_minutes: 35, display_order: 69, specialization_ids: ['dermatology'] },

  // ==================== VETERINARY – Reproductive ====================
  { service_id: 'vet_pregnancy_diagnosis', service_name: 'Pregnancy Diagnosis', display_name: 'Pregnancy Diagnosis', description: 'Pregnancy diagnosis', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 600, duration_minutes: 25, display_order: 72, specialization_ids: ['reproductive'] },
  { service_id: 'vet_antenatal_care', service_name: 'Antenatal Care', display_name: 'Antenatal Care', description: 'Prenatal care for pregnant pets', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 800, duration_minutes: 30, display_order: 73, specialization_ids: ['reproductive'] },
  { service_id: 'vet_assisted_delivery', service_name: 'Assisted Delivery', display_name: 'Assisted Delivery', description: 'Assisted birthing', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['vet_clinic', 'veterinarian'], service_style: 'at_center', base_price: 5000, duration_minutes: 120, display_order: 74, specialization_ids: ['reproductive'] },
  { service_id: 'vet_postnatal_care', service_name: 'Post-Natal Care', display_name: 'Post-Natal Care', description: 'Post-birth care for mother and litter', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 600, duration_minutes: 25, display_order: 75, specialization_ids: ['reproductive'] },
  { service_id: 'vet_infertility_consultation', service_name: 'Infertility Consultation', display_name: 'Infertility Consultation', description: 'Breeding and infertility consultation', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1500, duration_minutes: 45, display_order: 76, specialization_ids: ['reproductive'] },

  // ==================== VETERINARY – Pediatric & Geriatric ====================
  { service_id: 'vet_puppy_kitten_growth', service_name: 'Puppy / Kitten Growth Monitoring', display_name: 'Puppy / Kitten Growth Monitoring', description: 'Growth and development monitoring', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 500, duration_minutes: 20, display_order: 78, specialization_ids: ['medicine'] },
  { service_id: 'vet_behavioural_guidance_early', service_name: 'Behavioural Guidance (Early Age)', display_name: 'Behavioural Guidance (Early Age)', description: 'Early-age behaviour guidance', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 600, duration_minutes: 25, display_order: 79, specialization_ids: ['medicine'] },
  { service_id: 'vet_senior_health_screening', service_name: 'Senior Pet Health Screening', display_name: 'Senior Pet Health Screening', description: 'Comprehensive senior health screening', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1200, duration_minutes: 45, display_order: 80, specialization_ids: ['medicine'] },
  { service_id: 'vet_arthritis_mobility', service_name: 'Arthritis & Mobility Care', display_name: 'Arthritis & Mobility Care', description: 'Arthritis and mobility management', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 900, duration_minutes: 30, display_order: 81, specialization_ids: ['orthopedic', 'medicine'] },

  // ==================== VETERINARY – Euthanasia & End-of-Life ====================
  { service_id: 'vet_quality_of_life_consultation', service_name: 'Quality of Life Consultation', display_name: 'Quality of Life Consultation', description: 'End-of-life quality of life discussion', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 800, duration_minutes: 30, display_order: 84, specialization_ids: ['palliative'] },
  { service_id: 'vet_humane_euthanasia', service_name: 'Humane Euthanasia', display_name: 'Humane Euthanasia', description: 'Humane euthanasia procedure', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 3500, duration_minutes: 45, display_order: 85, specialization_ids: ['palliative'] },
  { service_id: 'vet_palliative_care', service_name: 'Palliative Care', display_name: 'Palliative Care', description: 'Palliative and comfort care', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1500, duration_minutes: 40, display_order: 86, specialization_ids: ['palliative'] },
  { service_id: 'vet_grief_support', service_name: 'Grief Support Guidance', display_name: 'Grief Support Guidance', description: 'Grief support for pet owners', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 500, duration_minutes: 25, display_order: 87, specialization_ids: ['palliative'] },

  // ==================== VETERINARY – Documentation ====================
  { service_id: 'vet_health_certificate', service_name: 'Health Certificate', display_name: 'Health Certificate', description: 'Health certificate issuance', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 400, duration_minutes: 15, display_order: 90, specialization_ids: ['medicine'] },
  { service_id: 'vet_fitness_certificate', service_name: 'Fitness Certificate', display_name: 'Fitness Certificate', description: 'Fitness certificate issuance', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 400, duration_minutes: 15, display_order: 91, specialization_ids: ['medicine'] },
  { service_id: 'vet_vaccination_certificate', service_name: 'Vaccination Certificate', display_name: 'Vaccination Certificate', description: 'Vaccination certificate', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 300, duration_minutes: 10, display_order: 92, specialization_ids: ['vaccination'] },
  { service_id: 'vet_pet_travel_documentation', service_name: 'Pet Travel Documentation', display_name: 'Pet Travel Documentation (Domestic / International)', description: 'Pet travel documentation', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 800, duration_minutes: 25, display_order: 93, specialization_ids: ['medicine'] },

  // ==================== VETERINARY – Other In-Clinic ====================
  { service_id: 'vet_wound_dressing', service_name: 'Wound Dressing', display_name: 'Wound Dressing', description: 'Wound dressing and care', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 350, duration_minutes: 15, display_order: 96, specialization_ids: ['medicine'] },
  { service_id: 'vet_iv_fluid_therapy', service_name: 'IV Fluid Therapy', display_name: 'IV Fluid Therapy', description: 'Intravenous fluid therapy', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1500, duration_minutes: 60, display_order: 97, specialization_ids: ['medicine'] },
  { service_id: 'vet_injection_admin', service_name: 'Injection Administration', display_name: 'Injection Administration', description: 'Vaccination or medication injection', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 200, duration_minutes: 10, display_order: 98, specialization_ids: ['medicine'] },
  { service_id: 'vet_microchipping', service_name: 'Microchipping', display_name: 'Microchipping', description: 'Pet microchipping', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1200, duration_minutes: 20, display_order: 99, specialization_ids: ['medicine'] },
  { service_id: 'vet_nail_clipping_medical', service_name: 'Nail Clipping (Medical)', display_name: 'Nail Clipping (Medical)', description: 'Medical nail clipping', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 200, duration_minutes: 10, display_order: 100, specialization_ids: ['medicine'] },
  { service_id: 'vet_ear_cleaning_medical', service_name: 'Ear Cleaning (Medical)', display_name: 'Ear Cleaning (Medical)', description: 'Medical ear cleaning', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 250, duration_minutes: 15, display_order: 101, specialization_ids: ['medicine'] },

  // ==================== VETERINARY – Home & Tele ====================
  { service_id: 'vet_home_visit', service_name: 'Home Visit Consultation', display_name: 'Home Visit Consultation', description: 'Veterinarian visit at home', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['veterinarian', 'vet_solo'], service_style: 'at_home', base_price: 1200, duration_minutes: 45, display_order: 110, specialization_ids: ['medicine'] },
  { service_id: 'vet_tele_consult', service_name: 'Tele-Consultation', display_name: 'Tele-Consultation', description: 'Video consultation with vet', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'tele', base_price: 400, duration_minutes: 20, display_order: 111, specialization_ids: ['medicine'] },

  // ==================== VETERINARY – Lab & Diagnostics (sample – full list in next block) ====================
  { service_id: 'vet_lab_cbc', service_name: 'Complete Blood Count (CBC)', display_name: 'Complete Blood Count (CBC)', description: 'Full blood count test', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 800, duration_minutes: 0, display_order: 120, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_lab_lft_kft', service_name: 'Liver & Kidney Function (LFT/KFT)', display_name: 'Liver & Kidney Function (LFT/KFT)', description: 'Liver and kidney function tests', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1200, duration_minutes: 0, display_order: 121, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_xray_single', service_name: 'X-Ray (Single View)', display_name: 'X-Ray (Single View)', description: 'Single view X-ray', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 800, duration_minutes: 20, display_order: 122, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_xray_multiple', service_name: 'X-Ray (Multiple Views)', display_name: 'X-Ray (Multiple Views)', description: 'Multiple view X-ray', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1500, duration_minutes: 30, display_order: 123, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_ultrasound_abdominal', service_name: 'Abdominal Ultrasound', display_name: 'Abdominal Ultrasound', description: 'Abdominal ultrasound', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 2000, duration_minutes: 45, display_order: 124, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_ecg', service_name: 'Electrocardiogram (ECG)', display_name: 'Electrocardiogram (ECG)', description: 'Heart rhythm assessment', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 600, duration_minutes: 20, display_order: 125, specialization_ids: ['diagnostics', 'cardiology'] },
  { service_id: 'vet_rapid_tick_fever', service_name: 'Rapid Tick Fever Panel', display_name: 'Rapid Tick Fever Panel', description: 'Rapid tick fever screening', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 600, duration_minutes: 15, display_order: 126, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_urine_routine', service_name: 'Routine Urine Examination', display_name: 'Routine Urine Examination', description: 'Urine routine examination', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 400, duration_minutes: 0, display_order: 127, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_culture_sensitivity', service_name: 'Bacterial Culture & Sensitivity', display_name: 'Bacterial Culture & Sensitivity', description: 'Culture and sensitivity test', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1200, duration_minutes: 0, display_order: 128, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_fnac', service_name: 'Fine Needle Aspiration Cytology (FNAC)', display_name: 'Fine Needle Aspiration Cytology (FNAC)', description: 'FNAC for lump evaluation', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 800, duration_minutes: 20, display_order: 129, specialization_ids: ['diagnostics'] },

  // ==================== VETERINARY – Lab & Diagnostics (extended) ====================
  { service_id: 'vet_lab_thyroid', service_name: 'Thyroid Panel (T3/T4/TSH)', display_name: 'Thyroid Panel (T3/T4/TSH)', description: 'Thyroid function testing', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1200, duration_minutes: 0, display_order: 130, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_lab_blood_glucose', service_name: 'Blood Glucose Test', display_name: 'Blood Glucose Test', description: 'Blood glucose measurement', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 350, duration_minutes: 0, display_order: 131, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_lab_electrolytes', service_name: 'Electrolyte Panel', display_name: 'Electrolyte Panel', description: 'Sodium, potassium, chloride', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 800, duration_minutes: 0, display_order: 132, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_lab_coagulation', service_name: 'Coagulation Profile', display_name: 'Coagulation Profile', description: 'PT, PTT, clotting time', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1500, duration_minutes: 0, display_order: 133, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_lab_amylase_lipase', service_name: 'Pancreatic Enzymes (Amylase/Lipase)', display_name: 'Pancreatic Enzymes (Amylase/Lipase)', description: 'Pancreatitis screening', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1000, duration_minutes: 0, display_order: 134, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_lab_bile_acids', service_name: 'Bile Acids Test', display_name: 'Bile Acids Test', description: 'Liver function and portosystemic shunt', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1800, duration_minutes: 0, display_order: 135, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_lab_crp', service_name: 'C-Reactive Protein (CRP)', display_name: 'C-Reactive Protein (CRP)', description: 'Inflammation marker', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 900, duration_minutes: 0, display_order: 136, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_lab_progesterone', service_name: 'Progesterone Assay', display_name: 'Progesterone Assay', description: 'Breeding timing and pregnancy', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1200, duration_minutes: 0, display_order: 137, specialization_ids: ['diagnostics', 'reproductive'] },
  { service_id: 'vet_lab_brucella', service_name: 'Brucella Testing', display_name: 'Brucella Testing', description: 'Brucellosis screening', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1500, duration_minutes: 0, display_order: 138, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_lab_heartworm', service_name: 'Heartworm Antigen Test', display_name: 'Heartworm Antigen Test', description: 'Heartworm screening', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 600, duration_minutes: 0, display_order: 139, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_lab_felv_fiv', service_name: 'FeLV / FIV Combo Test', display_name: 'FeLV / FIV Combo Test', description: 'Feline leukemia and immunodeficiency', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 800, duration_minutes: 0, display_order: 140, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_lab_blood_smear', service_name: 'Blood Smear Examination', display_name: 'Blood Smear Examination', description: 'Microscopic blood cell morphology', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 400, duration_minutes: 0, display_order: 141, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_lab_cytology', service_name: 'Cytology (Ear/Skin/Lesion)', display_name: 'Cytology (Ear/Skin/Lesion)', description: 'Cytology for infection or masses', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 600, duration_minutes: 0, display_order: 142, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_lab_histopathology', service_name: 'Histopathology (Biopsy)', display_name: 'Histopathology (Biopsy)', description: 'Tissue biopsy and histopathology', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 2500, duration_minutes: 0, display_order: 143, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_ultrasound_cardiac', service_name: 'Cardiac Ultrasound (Echocardiogram)', display_name: 'Cardiac Ultrasound (Echocardiogram)', description: 'Heart ultrasound', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 3500, duration_minutes: 45, display_order: 144, specialization_ids: ['diagnostics', 'cardiology'] },
  { service_id: 'vet_ultrasound_doppler', service_name: 'Doppler Ultrasound', display_name: 'Doppler Ultrasound', description: 'Blood flow assessment', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 2500, duration_minutes: 30, display_order: 145, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_ecg_holter', service_name: '24-Hour Holter Monitoring', display_name: '24-Hour Holter Monitoring', description: 'Ambulatory ECG monitoring', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 4000, duration_minutes: 0, display_order: 146, specialization_ids: ['diagnostics', 'cardiology'] },
  { service_id: 'vet_lab_parasite_fecal', service_name: 'Fecal Parasite Examination', display_name: 'Fecal Parasite Examination', description: 'Stool parasite screening', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 400, duration_minutes: 0, display_order: 147, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_lab_giardia', service_name: 'Giardia Antigen Test', display_name: 'Giardia Antigen Test', description: 'Giardia screening', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 500, duration_minutes: 0, display_order: 148, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_lab_blood_gas', service_name: 'Blood Gas Analysis', display_name: 'Blood Gas Analysis', description: 'Arterial/venous blood gas', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1200, duration_minutes: 0, display_order: 149, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_lab_profile_senior', service_name: 'Senior Wellness Profile', display_name: 'Senior Wellness Profile', description: 'CBC, LFT, KFT, thyroid, glucose', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 2800, duration_minutes: 0, display_order: 150, specialization_ids: ['diagnostics'] },
  { service_id: 'vet_lab_profile_preop', service_name: 'Pre-Anaesthetic Profile', display_name: 'Pre-Anaesthetic Profile', description: 'Pre-surgery blood work', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: VET_ROLES, service_style: 'at_center', base_price: 1500, duration_minutes: 0, display_order: 151, specialization_ids: ['diagnostics'] },

  // ==================== WALKING (India metro: ₹200–500/session, packages 999–3699) ====================
  { service_id: 'walk_30min', service_name: '30 Min Walk', display_name: '30 Min Walk', description: 'Short neighborhood walk', category_id: 'walking', category_name: 'Walking & Exercise', applicable_roles: WALKER_ROLES, service_style: 'at_home', base_price: 220, duration_minutes: 30, display_order: 200, specialization_ids: ['daily_walk'] },
  { service_id: 'walk_60min', service_name: '60 Min Walk', display_name: '60 Min Walk', description: '1 hour walking session', category_id: 'walking', category_name: 'Walking & Exercise', applicable_roles: WALKER_ROLES, service_style: 'at_home', base_price: 380, duration_minutes: 60, display_order: 201, specialization_ids: ['daily_walk', 'long_walk'] },
  { service_id: 'walk_group', service_name: 'Group Walk', display_name: 'Group Walk', description: 'Group walk with other pets', category_id: 'walking', category_name: 'Walking & Exercise', applicable_roles: WALKER_ROLES, service_style: 'at_home', base_price: 280, duration_minutes: 45, display_order: 202, specialization_ids: ['multiple_dogs'] },
  { service_id: 'walk_jogging', service_name: 'Jogging Session', display_name: 'Jogging Session', description: 'High-energy jogging session', category_id: 'walking', category_name: 'Walking & Exercise', applicable_roles: WALKER_ROLES, service_style: 'at_home', base_price: 450, duration_minutes: 45, display_order: 203, specialization_ids: ['long_walk'] },
  { service_id: 'walk_park', service_name: 'Park Visit', display_name: 'Park Visit', description: 'Supervised playtime at dog park', category_id: 'walking', category_name: 'Walking & Exercise', applicable_roles: WALKER_ROLES, service_style: 'at_home', base_price: 350, duration_minutes: 60, display_order: 204, specialization_ids: ['daily_walk', 'long_walk'] },
  { service_id: 'walk_puppy', service_name: 'Puppy Walk', display_name: 'Puppy Walk', description: 'Gentle short walk for puppies', category_id: 'walking', category_name: 'Walking & Exercise', applicable_roles: WALKER_ROLES, service_style: 'at_home', base_price: 250, duration_minutes: 25, display_order: 205, specialization_ids: ['puppy_walk'] },
  { service_id: 'walk_senior', service_name: 'Senior Dog Walk', display_name: 'Senior Dog Walk', description: 'Gentle walk for senior dogs', category_id: 'walking', category_name: 'Walking & Exercise', applicable_roles: WALKER_ROLES, service_style: 'at_home', base_price: 300, duration_minutes: 30, display_order: 206, specialization_ids: ['senior_walk'] },
  { service_id: 'walk_weekly_5', service_name: 'Weekly Walk Package', display_name: '5 Walks (30 min each)', description: '5 sessions per week, 30 min each', category_id: 'walking', category_name: 'Walking & Exercise', applicable_roles: WALKER_ROLES, service_style: 'at_home', base_price: 999, duration_minutes: 150, display_order: 207, specialization_ids: ['daily_walk'] },
  { service_id: 'walk_monthly_20', service_name: 'Monthly Walk Package', display_name: '20 Walks (30 min each)', description: '20 sessions per month', category_id: 'walking', category_name: 'Walking & Exercise', applicable_roles: WALKER_ROLES, service_style: 'at_home', base_price: 3699, duration_minutes: 600, display_order: 208, specialization_ids: ['daily_walk'] },

  // ==================== TRAINING (India: ₹500–700/session basic; ₹1200–2500 advanced/behavior) ====================
  { service_id: 'train_basic_obedience', service_name: 'Basic Obedience Training', display_name: 'Basic Obedience Training', description: 'Sit, stay, come, heel', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: TRAINER_ROLES, service_style: 'at_center', base_price: 650, duration_minutes: 60, display_order: 220, specialization_ids: ['basic_obedience'] },
  { service_id: 'train_advanced', service_name: 'Advanced Training', display_name: 'Advanced Training', description: 'Advanced obedience and tricks', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: TRAINER_ROLES, service_style: 'at_center', base_price: 1200, duration_minutes: 60, display_order: 221, specialization_ids: ['advanced_training'] },
  { service_id: 'train_puppy', service_name: 'Puppy Training', display_name: 'Puppy Training', description: 'Puppy kindergarten and basics', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: TRAINER_ROLES, service_style: 'at_center', base_price: 600, duration_minutes: 45, display_order: 222, specialization_ids: ['potty_training', 'basic_obedience'] },
  { service_id: 'train_behavior', service_name: 'Behavior Modification', display_name: 'Behavior Modification', description: 'Aggression, anxiety, barking', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: [...TRAINER_ROLES, 'pet_behaviorist'], service_style: 'at_center', base_price: 1800, duration_minutes: 90, display_order: 223, specialization_ids: ['aggression'] },
  { service_id: 'train_agility', service_name: 'Agility Training', display_name: 'Agility Training', description: 'Obstacle course training', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: TRAINER_ROLES, service_style: 'at_center', base_price: 700, duration_minutes: 60, display_order: 224, specialization_ids: ['advanced_training'] },
  { service_id: 'train_leash', service_name: 'Leash Training', display_name: 'Leash Training', description: 'Loose-leash walking', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: TRAINER_ROLES, service_style: 'at_center', base_price: 600, duration_minutes: 45, display_order: 225, specialization_ids: ['leash_training'] },
  { service_id: 'train_socialization', service_name: 'Socialization Session', display_name: 'Socialization Session', description: 'Social skills with people and dogs', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: TRAINER_ROLES, service_style: 'at_center', base_price: 650, duration_minutes: 50, display_order: 226, specialization_ids: ['socialization'] },
  { service_id: 'train_home', service_name: 'Home Training Session', display_name: 'Home Training Session', description: 'Training at your home', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: TRAINER_ROLES, service_style: 'at_home', base_price: 1000, duration_minutes: 60, display_order: 227, specialization_ids: ['basic_obedience'] },
  { service_id: 'train_tele_consult', service_name: 'Training Tele-Consultation', display_name: 'Training Tele-Consultation', description: 'Online training consultation', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: TRAINER_ROLES, service_style: 'tele', base_price: 500, duration_minutes: 30, display_order: 228, specialization_ids: ['basic_obedience'] },
  { service_id: 'train_5_session_pack', service_name: '5 Session Training Pack', display_name: '5 Session Training Pack', description: 'Pack of 5 one-on-one sessions', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: TRAINER_ROLES, service_style: 'at_center', base_price: 3000, duration_minutes: 300, display_order: 229, specialization_ids: ['basic_obedience'] },

  // ==================== BEHAVIORIST (India: ₹2000–3500/session) ====================
  { service_id: 'behavior_consultation', service_name: 'Behavior Consultation', display_name: 'Behavior Consultation', description: 'Initial behavior assessment', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: BEHAVIORIST_ROLES, service_style: 'at_home', base_price: 2200, duration_minutes: 60, display_order: 240, specialization_ids: ['separation_anxiety', 'barking'] },
  { service_id: 'behavior_separation_anxiety', service_name: 'Separation Anxiety Session', display_name: 'Separation Anxiety Session', description: 'Anxiety and stress support', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: BEHAVIORIST_ROLES, service_style: 'at_home', base_price: 2700, duration_minutes: 90, display_order: 241, specialization_ids: ['separation_anxiety'] },
  { service_id: 'behavior_barking', service_name: 'Barking Issues Session', display_name: 'Barking Issues Session', description: 'Excessive barking support', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: BEHAVIORIST_ROLES, service_style: 'at_home', base_price: 2000, duration_minutes: 60, display_order: 242, specialization_ids: ['barking'] },
  { service_id: 'behavior_fear_phobia', service_name: 'Fear & Phobia Session', display_name: 'Fear & Phobia Session', description: 'Fear and phobia support', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: BEHAVIORIST_ROLES, service_style: 'at_home', base_price: 2400, duration_minutes: 60, display_order: 243, specialization_ids: ['fear_phobia'] },
  { service_id: 'behavior_destructive', service_name: 'Destructive Behavior Session', display_name: 'Destructive Behavior Session', description: 'Destructive habits support', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: BEHAVIORIST_ROLES, service_style: 'at_home', base_price: 2300, duration_minutes: 60, display_order: 244, specialization_ids: ['destructive'] },
  { service_id: 'behavior_resource_guarding', service_name: 'Resource Guarding Session', display_name: 'Resource Guarding Session', description: 'Possessive behavior support', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: BEHAVIORIST_ROLES, service_style: 'at_home', base_price: 2500, duration_minutes: 60, display_order: 245, specialization_ids: ['resource_guarding'] },
  { service_id: 'behavior_tele_consult', service_name: 'Behavior Tele-Consultation', display_name: 'Behavior Tele-Consultation', description: 'Online behavior consultation', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: BEHAVIORIST_ROLES, service_style: 'tele', base_price: 1500, duration_minutes: 45, display_order: 246, specialization_ids: ['separation_anxiety', 'barking'] },

  // ==================== GROOMING (India: ₹799–2199 salon; home +₹300) ====================
  { service_id: 'groom_bath', service_name: 'Bath & Dry', display_name: 'Bath & Dry', description: 'Full bath and blow dry', category_id: 'grooming', category_name: 'Grooming & Hygiene', applicable_roles: GROOMER_ROLES, service_style: 'at_center', base_price: 850, duration_minutes: 45, display_order: 260, specialization_ids: ['bath_only'] },
  { service_id: 'groom_haircut', service_name: 'Haircut & Styling', display_name: 'Haircut & Styling', description: 'Breed-specific or custom haircut', category_id: 'grooming', category_name: 'Grooming & Hygiene', applicable_roles: GROOMER_ROLES, service_style: 'at_center', base_price: 1300, duration_minutes: 60, display_order: 261, specialization_ids: ['haircut_styling', 'full_grooming'] },
  { service_id: 'groom_nail', service_name: 'Nail Trimming', display_name: 'Nail Trimming', description: 'Nail clipping and filing', category_id: 'grooming', category_name: 'Grooming & Hygiene', applicable_roles: GROOMER_ROLES, service_style: 'at_center', base_price: 220, duration_minutes: 15, display_order: 262, specialization_ids: ['nail_care'] },
  { service_id: 'groom_ear', service_name: 'Ear Cleaning', display_name: 'Ear Cleaning', description: 'Ear cleaning and care', category_id: 'grooming', category_name: 'Grooming & Hygiene', applicable_roles: GROOMER_ROLES, service_style: 'at_center', base_price: 180, duration_minutes: 10, display_order: 263, specialization_ids: ['bath_only'] },
  { service_id: 'groom_teeth', service_name: 'Teeth Brushing', display_name: 'Teeth Brushing', description: 'Dental hygiene', category_id: 'grooming', category_name: 'Grooming & Hygiene', applicable_roles: GROOMER_ROLES, service_style: 'at_center', base_price: 280, duration_minutes: 15, display_order: 264, specialization_ids: ['spa_treatment'] },
  { service_id: 'groom_spa', service_name: 'Full Spa Treatment', display_name: 'Full Spa Treatment', description: 'Luxury spa package', category_id: 'grooming', category_name: 'Grooming & Hygiene', applicable_roles: GROOMER_ROLES, service_style: 'at_center', base_price: 2400, duration_minutes: 120, display_order: 265, specialization_ids: ['spa_treatment'] },
  { service_id: 'groom_dematting', service_name: 'De-matting', display_name: 'De-matting', description: 'Mat removal service', category_id: 'grooming', category_name: 'Grooming & Hygiene', applicable_roles: GROOMER_ROLES, service_style: 'at_center', base_price: 600, duration_minutes: 30, display_order: 266, specialization_ids: ['full_grooming', 'deshedding'] },
  { service_id: 'groom_deshedding', service_name: 'De-shedding Treatment', display_name: 'De-shedding Treatment', description: 'Reduce shedding and undercoat', category_id: 'grooming', category_name: 'Grooming & Hygiene', applicable_roles: GROOMER_ROLES, service_style: 'at_center', base_price: 700, duration_minutes: 40, display_order: 267, specialization_ids: ['deshedding'] },
  { service_id: 'groom_home', service_name: 'Home Grooming', display_name: 'Home Grooming', description: 'Grooming at your home', category_id: 'grooming', category_name: 'Grooming & Hygiene', applicable_roles: ['pet_groomer', 'groomer_solo', 'groomer'], service_style: 'at_home', base_price: 1200, duration_minutes: 90, display_order: 268, specialization_ids: ['bath_only', 'full_grooming'] },
];

async function run() {
  console.log('='.repeat(70));
  console.log('Comprehensive Service Catalog Seed – Vet + Trainer + Groomer + Walker + Behaviorist');
  console.log('='.repeat(70));
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log('');

  if (!DB_HOST || !DB_NAME) {
    console.log('📊 Auto-discovering RDS cluster...');
    try {
      const { execSync } = require('child_process');
      const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
      const endpoint = execSync(`aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].Endpoint' --output text 2>/dev/null`, { encoding: 'utf8', maxBuffer: 1024 * 1024 }).trim();
      if (endpoint && endpoint !== 'None' && endpoint !== 'null') {
        DB_HOST = endpoint;
        DB_PORT = parseInt(execSync(`aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].Port' --output text 2>/dev/null`, { encoding: 'utf8', maxBuffer: 1024 * 1024 }).trim() || '5432', 10);
        DB_NAME = execSync(`aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].DatabaseName' --output text 2>/dev/null`, { encoding: 'utf8', maxBuffer: 1024 * 1024 }).trim() || 'warmpawz';
        DB_USER = execSync(`aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${AWS_REGION} --query 'DBClusters[0].MasterUsername' --output text 2>/dev/null`, { encoding: 'utf8', maxBuffer: 1024 * 1024 }).trim() || 'warmpawz_admin';
        console.log('✅ RDS cluster found');
      }
    } catch (e) {
      console.log('⚠️  Could not auto-discover RDS');
    }
  }

  if (!DB_HOST || !DB_NAME) {
    console.error('❌ Missing DB_HOST or DB_NAME.');
    process.exit(1);
  }

  await fetchDbCredentials().catch((e) => {
    console.error('❌ Credentials:', e.message);
    process.exit(1);
  });

  const pool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 2,
  });

  let updated = 0;
  let inserted = 0;

  try {
    await pool.query('SELECT 1');
    console.log('✅ Database connected');
    console.log('');

    // 1) Ensure new specializations exist
    console.log('🔧 Ensuring specializations (diagnostics, reproductive, palliative)...');
    for (const spec of NEW_SPECIALIZATIONS) {
      await pool.query(
        `INSERT INTO specialization_master (specialization_id, name, display_name, description, category_id, applicable_roles, icon_name, icon_color, display_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, true)
         ON CONFLICT (specialization_id) DO UPDATE SET name = EXCLUDED.name, display_name = EXCLUDED.display_name, description = EXCLUDED.description`,
        [spec.specialization_id, spec.name, spec.display_name, spec.description, spec.category_id, spec.applicable_roles, spec.icon_name, spec.icon_color]
      );
    }
    console.log('   ✅ Specializations ready');
    console.log('');

    // 2) Upsert services
    console.log('🔧 Upserting service catalog...');
    for (const s of SERVICES) {
      const specialization_ids = s.specialization_ids || [];
      const applicable_roles = s.applicable_roles || [];

      const existing = await pool.query('SELECT id FROM service_catalog WHERE service_id = $1', [s.service_id]);

      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE service_catalog SET
            specialization_ids = $1, base_price = $2, applicable_roles = $3, service_style = $4,
            display_name = $5, description = $6, duration_minutes = $7, display_order = $8, category_name = $9, service_name = $10, category_id = $11
          WHERE service_id = $12`,
          [specialization_ids, s.base_price, applicable_roles, s.service_style, s.display_name, s.description, s.duration_minutes, s.display_order, s.category_name, s.service_name, s.category_id, s.service_id]
        );
        updated++;
        console.log(`  ✅ Updated: ${s.service_id} (₹${s.base_price})`);
      } else {
        await pool.query(
          `INSERT INTO service_catalog (service_id, service_name, display_name, description, category_id, category_name, applicable_roles, service_style, base_price, duration_minutes, status, publish_status, display_order, specialization_ids)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', 'published', $11, $12)`,
          [s.service_id, s.service_name, s.display_name, s.description, s.category_id, s.category_name, applicable_roles, s.service_style, s.base_price, s.duration_minutes, s.display_order, specialization_ids]
        );
        inserted++;
        console.log(`  ➕ Inserted: ${s.service_id} (₹${s.base_price})`);
      }
    }

    console.log('');
    console.log('Summary:');
    console.log(`  Updated: ${updated}`);
    console.log(`  Inserted: ${inserted}`);
    console.log('✅ Comprehensive catalog seed complete.');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
