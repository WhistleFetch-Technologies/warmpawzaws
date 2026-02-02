#!/usr/bin/env node
/**
 * Update specialization_ids for ALL service_catalog rows (244 products).
 * Uses logical rules: category + role overlap + keyword match from service name/description
 * so specializations resonate with service name and role.
 *
 * Prerequisites: Migration 524 applied; specialization_master populated.
 * Usage: ENVIRONMENT=dev node scripts/update-service-catalog-specializations.js
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

// Map service_catalog.category_id to specialization_master.category_id (some differ)
const CATEGORY_TO_SPEC_CATEGORY = {
  veterinary: 'veterinary',
  grooming: 'grooming',
  training: 'training',
  walking: 'walking',
  diagnostic: 'veterinary',  // diagnostics specs live under veterinary
  diagnostics: 'veterinary',
  pharmacy: 'veterinary',
  emergency: 'veterinary',
  wellness: 'wellness',
  specialty: 'veterinary',
  boarding: 'boarding',
  nutrition: 'wellness',
  behavioral: 'behavioral',
  behaviour: 'behavioral',
};

// Keyword (lowercase) -> specialization_id. Order matters: first match can add primary spec.
const KEYWORD_TO_SPEC = [
  // Veterinary
  { keywords: ['dental', 'teeth', 'tooth', 'scaling', 'gum', 'oral'], spec: 'dentistry' },
  { keywords: ['vaccination', 'vaccine', 'immunization', 'booster'], spec: 'vaccination' },
  { keywords: ['surgery', 'surgical', 'spay', 'neuter', 'sterilis', 'tumour', 'tumor', 'lump removal', 'hernia', 'wound repair'], spec: 'surgery' },
  { keywords: ['fracture', 'bone', 'ortho', 'joint', 'lameness', 'ligament', 'plating', 'pinning'], spec: 'orthopedic' },
  { keywords: ['emergency', 'trauma', 'poison', 'critical care', 'stabilisation', 'seizure'], spec: 'emergency' },
  { keywords: ['skin', 'dermatology', 'allergy', 'mange', 'fungal', 'hot spot'], spec: 'dermatology' },
  { keywords: ['heart', 'cardiac', 'ecg', 'cardiolog'], spec: 'cardiology' },
  { keywords: ['eye', 'ophthalm'], spec: 'ophthalmology' },
  { keywords: ['neuro', 'seizure'], spec: 'neurology' },
  { keywords: ['reproductive', 'pregnancy', 'antenatal', 'postnatal', 'breeding', 'infertility', 'delivery'], spec: 'reproductive' },
  { keywords: ['euthanasia', 'palliative', 'grief', 'quality of life', 'end-of-life'], spec: 'palliative' },
  { keywords: ['lab', 'diagnostic', 'x-ray', 'xray', 'ultrasound', 'blood test', 'cbc', 'urine test', 'culture', 'fnac', 'biopsy', 'lft', 'kft', 'home sample', 'sample collection', 'diag_'], spec: 'diagnostics' },
  { keywords: ['consultation', 'checkup', 'check-up', 'examination', 'consult', 'general health', 'sick pet', 'follow-up', 'second opinion', 'senior', 'puppy', 'kitten', 'deworm', 'parasite', 'nutritional', 'certificate', 'microchip', 'wound dressing', 'iv fluid', 'injection'], spec: 'medicine' },
  // Grooming
  { keywords: ['bath', 'bathing', 'brush', 'dry'], spec: 'bath_only' },
  { keywords: ['haircut', 'hair cut', 'styling', 'full groom', 'breed cut'], spec: 'full_grooming' },
  { keywords: ['nail', 'trimming'], spec: 'nail_care' },
  { keywords: ['haircut', 'styling'], spec: 'haircut_styling' },
  { keywords: ['spa', 'wellness', 'aromatherapy', 'luxury'], spec: 'spa_treatment' },
  { keywords: ['de-mat', 'dematting', 'mat removal'], spec: 'full_grooming' },
  { keywords: ['de-shed', 'deshedding', 'shedding'], spec: 'deshedding' },
  { keywords: ['ear clean'], spec: 'bath_only' },
  { keywords: ['teeth brush'], spec: 'spa_treatment' },
  // Training
  { keywords: ['basic obedience', 'obedience', 'sit', 'stay', 'come', 'heel', 'session pack'], spec: 'basic_obedience' },
  { keywords: ['potty', 'house train', 'housebreaking'], spec: 'potty_training' },
  { keywords: ['leash', 'walking', 'loose leash'], spec: 'leash_training' },
  { keywords: ['socialization', 'social'], spec: 'socialization' },
  { keywords: ['advanced', 'agility', 'trick'], spec: 'advanced_training' },
  { keywords: ['behavior modification', 'aggression', 'anxiety', 'barking'], spec: 'aggression' },
  { keywords: ['puppy train'], spec: 'potty_training' },
  // Behavioral (behaviorist)
  { keywords: ['separation anxiety', 'anxiety session'], spec: 'separation_anxiety' },
  { keywords: ['barking issue'], spec: 'barking' },
  { keywords: ['fear', 'phobia'], spec: 'fear_phobia' },
  { keywords: ['destructive'], spec: 'destructive' },
  { keywords: ['resource guard', 'possessive'], spec: 'resource_guarding' },
  { keywords: ['behavior consult', 'behaviour consult'], spec: 'separation_anxiety' },
  // Walking
  { keywords: ['30 min', '30min', 'short walk'], spec: 'daily_walk' },
  { keywords: ['60 min', '60min', 'hour walk', 'long walk', 'jogging', 'adventure'], spec: 'long_walk' },
  { keywords: ['group walk', 'multiple dog'], spec: 'multiple_dogs' },
  { keywords: ['puppy walk'], spec: 'puppy_walk' },
  { keywords: ['senior walk'], spec: 'senior_walk' },
  { keywords: ['park visit'], spec: 'daily_walk' },
  { keywords: ['weekly', 'monthly', 'package'], spec: 'daily_walk' },
  // Boarding
  { keywords: ['daycare', 'day care'], spec: 'daycare' },
  { keywords: ['short stay', 'weekend'], spec: 'short_stay' },
  { keywords: ['long stay', 'extended'], spec: 'long_stay' },
  { keywords: ['luxury', 'premium board'], spec: 'luxury_boarding' },
  { keywords: ['medical board', 'medication'], spec: 'medical_boarding' },
  // Nutrition / Wellness
  { keywords: ['diet plan', 'meal plan', 'nutrition'], spec: 'diet_plan' },
  { keywords: ['puppy diet', 'puppy nutrition'], spec: 'puppy_nutrition' },
  { keywords: ['senior diet', 'senior nutrition'], spec: 'senior_nutrition' },
  { keywords: ['weight', 'obesity'], spec: 'weight_management' },
  { keywords: ['allergy diet', 'food allergy'], spec: 'allergies_sensitivities' },
  { keywords: ['prescription diet', 'medical diet'], spec: 'special_diet' },
];

function rolesOverlap(serviceRoles, specRoles) {
  if (!Array.isArray(serviceRoles) || !Array.isArray(specRoles)) return false;
  const s = new Set(serviceRoles.map((r) => (r || '').toLowerCase()));
  return specRoles.some((r) => s.has((r || '').toLowerCase()));
}

function matchKeywordToSpecs(text) {
  if (!text || typeof text !== 'string') return [];
  const t = text.toLowerCase();
  const matched = new Set();
  for (const { keywords, spec } of KEYWORD_TO_SPEC) {
    if (keywords.some((k) => t.includes(k))) matched.add(spec);
  }
  return [...matched];
}

function resolveSpecializationIds(service, specializations) {
  const categoryId = (service.category_id || '').toString().toLowerCase().trim();
  const specCategory = CATEGORY_TO_SPEC_CATEGORY[categoryId] || categoryId;
  const serviceRoles = Array.isArray(service.applicable_roles) ? service.applicable_roles : [];
  const text = [service.service_name, service.display_name, service.description].filter(Boolean).join(' ');

  // Specs for this category with role overlap
  const byCategory = specializations.filter(
    (s) => (s.category_id || '').toLowerCase() === specCategory && rolesOverlap(serviceRoles, s.applicable_roles || [])
  );

  // Keyword-based specs (must exist in byCategory or in all specs for same category)
  const keywordSpecIds = matchKeywordToSpecs(text);
  const validSpecIds = new Set(specializations.map((s) => s.specialization_id));
  const matched = keywordSpecIds.filter((id) => validSpecIds.has(id));

  // If we have keyword matches, use them and add category default if only one
  if (matched.length > 0) {
    const result = [...new Set(matched)];
    // Ensure at least one is in byCategory for this service's category
    const inCategory = byCategory.map((s) => s.specialization_id);
    const hasCategory = result.some((id) => inCategory.includes(id));
    if (!hasCategory && inCategory.length > 0) result.push(inCategory[0]);
    return result.slice(0, 5); // cap at 5
  }

  // No keyword match: use first 1–2 specs for this category+role
  if (byCategory.length > 0) {
    return byCategory.slice(0, 2).map((s) => s.specialization_id);
  }

  // Fallback: any spec with role overlap (any category)
  const anyRole = specializations.filter((s) => rolesOverlap(serviceRoles, s.applicable_roles || []));
  if (anyRole.length > 0) return [anyRole[0].specialization_id];

  return [];
}

async function run() {
  console.log('='.repeat(70));
  console.log('Update specialization_ids for all service_catalog rows');
  console.log('='.repeat(70));
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log('');

  if (!DB_HOST || !DB_NAME) {
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

  try {
    await pool.query('SELECT 1');
    console.log('✅ Database connected');
    console.log('');

    const [servicesRes, specsRes] = await Promise.all([
      pool.query(`SELECT service_id, service_name, display_name, description, category_id, category_name, applicable_roles, COALESCE(specialization_ids, '{}') AS specialization_ids FROM service_catalog WHERE status = 'active'`),
      pool.query(`SELECT specialization_id, category_id, applicable_roles FROM specialization_master WHERE is_active = true`),
    ]);

    const services = servicesRes.rows;
    const specializations = specsRes.rows;
    console.log(`📋 Loaded ${services.length} services, ${specializations.length} specializations`);
    console.log('');

    let updated = 0;
    let skipped = 0;

    for (const svc of services) {
      const resolved = resolveSpecializationIds(svc, specializations);
      const existing = Array.isArray(svc.specialization_ids) ? svc.specialization_ids : [];
      const same = existing.length === resolved.length && existing.every((id, i) => id === resolved[i]);
      if (same && existing.length > 0) {
        skipped++;
        continue;
      }
      if (resolved.length === 0) {
        console.log(`  ⚠️  No spec for: ${svc.service_id} (${svc.service_name})`);
      }
      await pool.query(
        `UPDATE service_catalog SET specialization_ids = $1, updated_at = NOW() WHERE service_id = $2`,
        [resolved, svc.service_id]
      );
      updated++;
      console.log(`  ✅ ${svc.service_id} → [${resolved.join(', ') || 'none'}]`);
    }

    console.log('');
    console.log('Summary:');
    console.log(`  Updated: ${updated}`);
    console.log(`  Skipped (already set): ${skipped}`);
    console.log('✅ Specialization update complete.');
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
