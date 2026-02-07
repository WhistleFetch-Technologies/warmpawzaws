#!/usr/bin/env node
/**
 * ============================================================================
 * SERVICE CATALOG ENHANCEMENT: India Metro Pricing, Specializations, Roles
 * ============================================================================
 *
 * - Does NOT remove any existing services; only enhances/inserts.
 * - Vet: All services from migration 048 included with specialization_ids and
 *   India metro pricing (research: Bangalore, Mumbai, Delhi 2024–2025).
 * - Walker, Trainer, Behaviorist, Groomer: Allowed service styles aligned to
 *   category; India metro prices; specialization_ids aligned to
 *   specialization_master (category → specializations); correct applicable_roles;
 *   package-style services added where relevant.
 *
 * Prerequisites:
 * - Migration 524 applied (service_catalog.specialization_ids).
 * - specialization_master seeded (node scripts/seed-specialization-master.js).
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/seed-service-catalog-india-metro.js
 *
 * ============================================================================
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const fs = require('fs');
const path = require('path');

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

// India metro pricing (research: Bangalore, Mumbai, Delhi 2024–2025). All amounts INR.
// Each row: update existing by service_id or insert if missing. specialization_ids align to specialization_master.
const ENHANCED_SERVICES = [
  // ---------- VETERINARY (048 + specialization_ids + India metro) ----------
  { service_id: 'vet_general_checkup', service_name: 'General Health Checkup', display_name: 'Complete physical examination', description: 'Comprehensive health checkup for your pet', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['veterinarian', 'vet_clinic', 'vet_solo'], service_style: 'at_center', base_price: 600, duration_minutes: 30, display_order: 1, specialization_ids: ['medicine'] },
  { service_id: 'vet_vaccination', service_name: 'Vaccination', display_name: 'Core and non-core vaccinations', description: 'Essential vaccinations to protect your pet', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['veterinarian', 'vet_clinic', 'vet_solo'], service_style: 'at_center', base_price: 900, duration_minutes: 20, display_order: 2, specialization_ids: ['vaccination'] },
  { service_id: 'vet_deworming', service_name: 'Deworming', display_name: 'Intestinal parasite treatment', description: 'Regular deworming for healthy pets', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['veterinarian', 'vet_clinic', 'vet_solo'], service_style: 'at_center', base_price: 350, duration_minutes: 15, display_order: 3, specialization_ids: ['medicine'] },
  { service_id: 'vet_dental', service_name: 'Dental Checkup', display_name: 'Oral health examination', description: 'Dental cleaning and oral health assessment', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['veterinarian', 'vet_clinic', 'vet_solo'], service_style: 'at_center', base_price: 1400, duration_minutes: 45, display_order: 4, specialization_ids: ['dentistry'] },
  { service_id: 'vet_surgery_minor', service_name: 'Minor Surgery', display_name: 'Minor surgical procedures', description: 'Small surgical interventions', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['veterinarian', 'vet_clinic', 'vet_solo'], service_style: 'at_center', base_price: 3500, duration_minutes: 90, display_order: 5, specialization_ids: ['surgery'] },
  { service_id: 'vet_surgery_major', service_name: 'Major Surgery', display_name: 'Major surgical procedures', description: 'Complex surgical operations', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['vet_clinic'], service_style: 'at_center', base_price: 9000, duration_minutes: 180, display_order: 6, specialization_ids: ['surgery'] },
  { service_id: 'vet_home_visit', service_name: 'Home Visit Consultation', display_name: 'Veterinarian visits your home', description: 'Convenient at-home veterinary consultation', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['veterinarian', 'vet_solo'], service_style: 'at_home', base_price: 1200, duration_minutes: 45, display_order: 7, specialization_ids: ['medicine'] },
  { service_id: 'vet_tele_consult', service_name: 'Tele-Consultation', display_name: 'Online video consultation', description: 'Connect with vet via video call', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['veterinarian', 'vet_clinic', 'vet_solo'], service_style: 'tele', base_price: 400, duration_minutes: 20, display_order: 8, specialization_ids: ['medicine'] },
  { service_id: 'vet_emergency', service_name: 'Emergency Care', display_name: '24/7 emergency treatment', description: 'Immediate emergency medical care', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['vet_clinic', 'veterinarian'], service_style: 'at_center', base_price: 3000, duration_minutes: 60, display_order: 9, specialization_ids: ['emergency'] },
  { service_id: 'vet_spay_neuter', service_name: 'Spay/Neuter', display_name: 'Sterilization surgery', description: 'Spaying or neutering procedure', category_id: 'veterinary', category_name: 'Veterinary Services', applicable_roles: ['vet_clinic'], service_style: 'at_center', base_price: 5500, duration_minutes: 120, display_order: 10, specialization_ids: ['surgery'] },

  // ---------- WALKING (at_home only; India metro + packages) ----------
  { service_id: 'walk_30min', service_name: '30 Min Walk', display_name: 'Short neighborhood walk', description: '30 minute walking session', category_id: 'walking', category_name: 'Walking & Exercise', applicable_roles: ['pet_walker', 'walker', 'dog_walker'], service_style: 'at_home', base_price: 220, duration_minutes: 30, display_order: 34, specialization_ids: ['daily_walk'] },
  { service_id: 'walk_60min', service_name: '60 Min Walk', display_name: 'Extended walk session', description: '1 hour walking and exercise', category_id: 'walking', category_name: 'Walking & Exercise', applicable_roles: ['pet_walker', 'walker', 'dog_walker'], service_style: 'at_home', base_price: 380, duration_minutes: 60, display_order: 35, specialization_ids: ['daily_walk', 'long_walk'] },
  { service_id: 'walk_group', service_name: 'Group Walk', display_name: 'Socialization walk', description: 'Group walk with other pets', category_id: 'walking', category_name: 'Walking & Exercise', applicable_roles: ['pet_walker', 'walker', 'dog_walker'], service_style: 'at_home', base_price: 280, duration_minutes: 45, display_order: 36, specialization_ids: ['multiple_dogs'] },
  { service_id: 'walk_jogging', service_name: 'Jogging Session', display_name: 'High-energy exercise', description: 'Jogging and running session', category_id: 'walking', category_name: 'Walking & Exercise', applicable_roles: ['pet_walker', 'walker', 'dog_walker'], service_style: 'at_home', base_price: 450, duration_minutes: 45, display_order: 37, specialization_ids: ['long_walk'] },
  { service_id: 'walk_park', service_name: 'Park Visit', display_name: 'Off-leash park time', description: 'Supervised playtime at dog park', category_id: 'walking', category_name: 'Walking & Exercise', applicable_roles: ['pet_walker', 'walker', 'dog_walker'], service_style: 'at_home', base_price: 350, duration_minutes: 60, display_order: 38, specialization_ids: ['daily_walk', 'long_walk'] },
  { service_id: 'walk_weekly_5', service_name: 'Weekly Walk Package', display_name: '5 walks (30 min each)', description: '5 sessions per week, 30 min each', category_id: 'walking', category_name: 'Walking & Exercise', applicable_roles: ['pet_walker', 'walker', 'dog_walker'], service_style: 'at_home', base_price: 999, duration_minutes: 150, display_order: 39, specialization_ids: ['daily_walk'] },
  { service_id: 'walk_monthly_20', service_name: 'Monthly Walk Package', display_name: '20 walks (30 min each)', description: '20 sessions per month, 30 min each', category_id: 'walking', category_name: 'Walking & Exercise', applicable_roles: ['pet_walker', 'walker', 'dog_walker'], service_style: 'at_home', base_price: 3699, duration_minutes: 600, display_order: 40, specialization_ids: ['daily_walk'] },

  // ---------- TRAINING (at_center, at_home, tele) ----------
  { service_id: 'train_basic_obedience', service_name: 'Basic Obedience Training', display_name: 'Fundamental commands', description: 'Teach sit, stay, come, heel', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: ['pet_trainer', 'trainer_center', 'trainer_solo', 'trainer'], service_style: 'at_center', base_price: 1400, duration_minutes: 60, display_order: 27, specialization_ids: ['basic_obedience'] },
  { service_id: 'train_advanced', service_name: 'Advanced Training', display_name: 'Complex command training', description: 'Advanced obedience and tricks', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: ['pet_trainer', 'trainer_center', 'trainer_solo', 'trainer'], service_style: 'at_center', base_price: 2200, duration_minutes: 60, display_order: 28, specialization_ids: ['advanced_training'] },
  { service_id: 'train_puppy', service_name: 'Puppy Training', display_name: 'Early socialization', description: 'Puppy kindergarten and basics', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: ['pet_trainer', 'trainer_center', 'trainer_solo', 'trainer'], service_style: 'at_center', base_price: 1300, duration_minutes: 45, display_order: 29, specialization_ids: ['potty_training', 'basic_obedience'] },
  { service_id: 'train_behavior', service_name: 'Behavior Modification', display_name: 'Problem behavior correction', description: 'Address aggression, anxiety, barking', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: ['pet_trainer', 'trainer_center', 'trainer_solo', 'trainer', 'pet_behaviorist'], service_style: 'at_center', base_price: 2700, duration_minutes: 90, display_order: 30, specialization_ids: ['aggression'] },
  { service_id: 'train_agility', service_name: 'Agility Training', display_name: 'Obstacle course training', description: 'Fun agility and sports training', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: ['pet_trainer', 'trainer_center', 'trainer_solo', 'trainer'], service_style: 'at_center', base_price: 2000, duration_minutes: 60, display_order: 31, specialization_ids: ['advanced_training'] },
  { service_id: 'train_protection', service_name: 'Protection Training', display_name: 'Guard dog training', description: 'Security and protection training', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: ['pet_trainer', 'trainer_center', 'trainer_solo', 'trainer'], service_style: 'at_center', base_price: 3500, duration_minutes: 90, display_order: 32, specialization_ids: ['advanced_training'] },
  { service_id: 'train_home', service_name: 'Home Training Session', display_name: 'At-home training', description: 'Personalized training at your home', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: ['pet_trainer', 'trainer_center', 'trainer_solo', 'trainer'], service_style: 'at_home', base_price: 2000, duration_minutes: 60, display_order: 33, specialization_ids: ['basic_obedience'] },
  { service_id: 'train_tele_consult', service_name: 'Training Tele-Consultation', display_name: 'Online training consultation', description: 'Video consultation for training plan', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: ['pet_trainer', 'trainer_center', 'trainer_solo', 'trainer'], service_style: 'tele', base_price: 900, duration_minutes: 30, display_order: 34, specialization_ids: ['basic_obedience'] },
  { service_id: 'train_5_session_pack', service_name: '5 Session Training Pack', display_name: '5 training sessions', description: 'Pack of 5 one-on-one sessions', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: ['pet_trainer', 'trainer_center', 'trainer_solo', 'trainer'], service_style: 'at_center', base_price: 6000, duration_minutes: 300, display_order: 35, specialization_ids: ['basic_obedience'] },

  // ---------- BEHAVIORAL (pet_behaviorist; at_home, tele) ----------
  { service_id: 'behavior_consultation', service_name: 'Behavior Consultation', display_name: 'Initial behavior assessment', description: 'Assessment and plan for behavior issues', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: ['pet_behaviorist', 'trainer_solo', 'trainer_center', 'pet_trainer'], service_style: 'at_home', base_price: 2200, duration_minutes: 60, display_order: 41, specialization_ids: ['separation_anxiety', 'barking'] },
  { service_id: 'behavior_separation_anxiety', service_name: 'Separation Anxiety Session', display_name: 'Anxiety & stress support', description: 'Address separation anxiety and stress', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: ['pet_behaviorist', 'trainer_solo', 'trainer_center', 'pet_trainer'], service_style: 'at_home', base_price: 2700, duration_minutes: 90, display_order: 42, specialization_ids: ['separation_anxiety'] },
  { service_id: 'behavior_barking', service_name: 'Barking Issues Session', display_name: 'Excessive barking support', description: 'Address excessive barking and vocalization', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: ['pet_behaviorist', 'trainer_solo', 'trainer_center', 'pet_trainer'], service_style: 'at_home', base_price: 2000, duration_minutes: 60, display_order: 43, specialization_ids: ['barking'] },
  { service_id: 'behavior_fear_phobia', service_name: 'Fear & Phobia Session', display_name: 'Fear and phobia support', description: 'Help with fears and phobias', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: ['pet_behaviorist', 'trainer_solo', 'trainer_center', 'pet_trainer'], service_style: 'at_home', base_price: 2400, duration_minutes: 60, display_order: 44, specialization_ids: ['fear_phobia'] },
  { service_id: 'behavior_destructive', service_name: 'Destructive Behavior Session', display_name: 'Destructive habits support', description: 'Address destructive behaviors', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: ['pet_behaviorist', 'trainer_solo', 'trainer_center', 'pet_trainer'], service_style: 'at_home', base_price: 2300, duration_minutes: 60, display_order: 45, specialization_ids: ['destructive'] },
  { service_id: 'behavior_resource_guarding', service_name: 'Resource Guarding Session', display_name: 'Possessive behavior support', description: 'Address resource guarding', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: ['pet_behaviorist', 'trainer_solo', 'trainer_center', 'pet_trainer'], service_style: 'at_home', base_price: 2500, duration_minutes: 60, display_order: 46, specialization_ids: ['resource_guarding'] },
  { service_id: 'behavior_tele_consult', service_name: 'Behavior Tele-Consultation', display_name: 'Online behavior consultation', description: 'Video consultation for behavior plan', category_id: 'training', category_name: 'Training & Behavior', applicable_roles: ['pet_behaviorist', 'trainer_solo', 'trainer_center', 'pet_trainer'], service_style: 'tele', base_price: 1500, duration_minutes: 45, display_order: 47, specialization_ids: ['separation_anxiety', 'barking'] },

  // ---------- GROOMING (at_center, at_home; India metro) ----------
  { service_id: 'groom_bath', service_name: 'Bath & Dry', display_name: 'Full bath and blow dry', description: 'Complete bathing and drying service', category_id: 'grooming', category_name: 'Grooming & Hygiene', applicable_roles: ['pet_groomer', 'groomer_center', 'groomer_solo', 'groomer', 'pet_spa'], service_style: 'at_center', base_price: 850, duration_minutes: 45, display_order: 19, specialization_ids: ['bath_only'] },
  { service_id: 'groom_haircut', service_name: 'Haircut & Styling', display_name: 'Professional haircut', description: 'Breed-specific or custom haircut', category_id: 'grooming', category_name: 'Grooming & Hygiene', applicable_roles: ['pet_groomer', 'groomer_center', 'groomer_solo', 'groomer', 'pet_spa'], service_style: 'at_center', base_price: 1300, duration_minutes: 60, display_order: 20, specialization_ids: ['haircut_styling', 'full_grooming'] },
  { service_id: 'groom_nail', service_name: 'Nail Trimming', display_name: 'Nail clipping and filing', description: 'Safe nail trimming service', category_id: 'grooming', category_name: 'Grooming & Hygiene', applicable_roles: ['pet_groomer', 'groomer_center', 'groomer_solo', 'groomer', 'pet_spa'], service_style: 'at_center', base_price: 220, duration_minutes: 15, display_order: 21, specialization_ids: ['nail_care'] },
  { service_id: 'groom_ear', service_name: 'Ear Cleaning', display_name: 'Ear cleaning and care', description: 'Gentle ear cleaning service', category_id: 'grooming', category_name: 'Grooming & Hygiene', applicable_roles: ['pet_groomer', 'groomer_center', 'groomer_solo', 'groomer', 'pet_spa'], service_style: 'at_center', base_price: 180, duration_minutes: 10, display_order: 22, specialization_ids: ['bath_only'] },
  { service_id: 'groom_teeth', service_name: 'Teeth Brushing', display_name: 'Dental hygiene', description: 'Teeth cleaning and brushing', category_id: 'grooming', category_name: 'Grooming & Hygiene', applicable_roles: ['pet_groomer', 'groomer_center', 'groomer_solo', 'groomer', 'pet_spa'], service_style: 'at_center', base_price: 280, duration_minutes: 15, display_order: 23, specialization_ids: ['spa_treatment'] },
  { service_id: 'groom_spa', service_name: 'Full Spa Treatment', display_name: 'Complete spa package', description: 'Luxury spa treatment with aromatherapy', category_id: 'grooming', category_name: 'Grooming & Hygiene', applicable_roles: ['pet_spa', 'pet_groomer', 'groomer_center', 'groomer_solo', 'groomer'], service_style: 'at_center', base_price: 2400, duration_minutes: 120, display_order: 24, specialization_ids: ['spa_treatment'] },
  { service_id: 'groom_dematting', service_name: 'De-matting', display_name: 'Mat removal service', description: 'Careful removal of tangled fur', category_id: 'grooming', category_name: 'Grooming & Hygiene', applicable_roles: ['pet_groomer', 'groomer_center', 'groomer_solo', 'groomer', 'pet_spa'], service_style: 'at_center', base_price: 600, duration_minutes: 30, display_order: 25, specialization_ids: ['full_grooming', 'deshedding'] },
  { service_id: 'groom_home', service_name: 'Home Grooming', display_name: 'At-home grooming service', description: 'Professional grooming at your home', category_id: 'grooming', category_name: 'Grooming & Hygiene', applicable_roles: ['pet_groomer', 'groomer_solo', 'groomer'], service_style: 'at_home', base_price: 1200, duration_minutes: 90, display_order: 26, specialization_ids: ['bath_only', 'full_grooming'] },
];

async function run() {
  console.log('='.repeat(70));
  console.log('Service Catalog Enhancement: India Metro + Specializations + Roles');
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
  let skipped = 0;

  try {
    await pool.query('SELECT 1');
    console.log('✅ Database connected');
    console.log('');

    for (const s of ENHANCED_SERVICES) {
      const existing = await pool.query(
        'SELECT id, service_id FROM service_catalog WHERE service_id = $1',
        [s.service_id]
      );

      const specialization_ids = s.specialization_ids || [];
      const applicable_roles = s.applicable_roles || [];

      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE service_catalog SET
            specialization_ids = $1,
            base_price = $2,
            applicable_roles = $3,
            service_style = $4,
            display_name = $5,
            description = $6,
            duration_minutes = $7,
            display_order = $8,
            category_name = $9
          WHERE service_id = $10`,
          [
            specialization_ids,
            s.base_price,
            applicable_roles,
            s.service_style,
            s.display_name,
            s.description,
            s.duration_minutes,
            s.display_order,
            s.category_name,
            s.service_id,
          ]
        );
        updated++;
        console.log(`  ✅ Updated: ${s.service_id} (₹${s.base_price}, ${specialization_ids.length} specs)`);
      } else {
        await pool.query(
          `INSERT INTO service_catalog (
            service_id, service_name, display_name, description, category_id, category_name,
            applicable_roles, service_style, base_price, duration_minutes, status, publish_status, display_order, specialization_ids
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', 'published', $11, $12)`,
          [
            s.service_id,
            s.service_name,
            s.display_name,
            s.description,
            s.category_id,
            s.category_name,
            applicable_roles,
            s.service_style,
            s.base_price,
            s.duration_minutes,
            s.display_order,
            specialization_ids,
          ]
        );
        inserted++;
        console.log(`  ➕ Inserted: ${s.service_id} (₹${s.base_price}, ${specialization_ids.length} specs)`);
      }
    }

    console.log('');
    console.log('Summary:');
    console.log(`  Updated: ${updated}`);
    console.log(`  Inserted: ${inserted}`);
    console.log('✅ Catalog enhancement complete. Existing services preserved; prices and specializations aligned to India metro.');
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
