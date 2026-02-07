#!/usr/bin/env node
/**
 * Analyse vendors on legacy/inactive roles and show mapping to canonical active roles.
 * Uses same RDS connection as run-migration-rds-node.js (AWS RDS + Secrets Manager)
 * or DATABASE_URL if set.
 *
 * Usage:
 *   node scripts/analyse-legacy-role-vendors.js
 *   ENVIRONMENT=dev node scripts/analyse-legacy-role-vendors.js
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

// Canonical active roles (from catalog / migration 250)
const CANONICAL_ACTIVE_ROLES = [
  'vet_solo', 'vet_clinic', 'groomer_solo', 'groomer_center', 'trainer_solo', 'trainer_center',
  'boarding', 'walker', 'sitter', 'adoption_center', 'cafe', 'photographer', 'pharmacy', 'seller',
  'ambulance', 'insurance', 'nutritionist', 'nutritionist_center', 'relocation', 'resort',
  'holiday', 'sunset', 'breeder', 'diagnostics_center', 'event_organizer',
];

// Legacy → canonical (default solo when ambiguous)
const LEGACY_TO_CANONICAL = {
  veterinary_clinic: 'vet_clinic',
  veterinarian: 'vet_solo',
  vet: 'vet_solo',
  pet_boarder: 'boarding',
  pet_daycare: 'boarding',
  pet_boarding: 'boarding',
  pet_cafe: 'cafe',
  pet_groomer: 'groomer_solo',
  pet_spa: 'groomer_solo',
  grooming_salon: 'groomer_solo',
  pet_trainer: 'trainer_solo',
  pet_behaviorist: 'trainer_solo',
  training_solo: 'trainer_solo',
  obedience_trainer: 'trainer_solo',
  dog_trainer: 'trainer_solo',
  pet_walker: 'walker',
  walker_solo: 'walker',
  dog_walker: 'walker',
  pet_sitter: 'sitter',
  sitter_solo: 'sitter',
  pet_photographer: 'photographer',
  pet_pharmacy: 'pharmacy',
  pet_ambulance: 'ambulance',
  pet_resort: 'resort',
  pet_breeder: 'breeder',
  pet_sunset_services: 'sunset',
  pet_shelter: 'adoption_center',
  pet_adoption_center: 'adoption_center',
  pet_products_store: 'seller',
  pet_taxi: 'relocation',
  pet_transport: 'relocation',
  pet_relocation: 'relocation',
  pet_nutritionist: 'nutritionist',
  pet_insurance: 'insurance',
  pet_event_organizer: 'event_organizer',
  diagnostics_solo: 'diagnostics_center',
  diagnostics_provider: 'diagnostics_center',
};

async function getPool() {
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('rds.') ? { rejectUnauthorized: false } : undefined,
    });
  }
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const endpoint = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
    { encoding: 'utf8' }
  ).trim();
  const port = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Port' --output text`,
    { encoding: 'utf8' }
  ).trim() || '5432';
  const dbName = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].DatabaseName' --output text`,
    { encoding: 'utf8' }
  ).trim() || 'warmpawz';
  const username = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text`,
    { encoding: 'utf8' }
  ).trim() || 'warmpawz_admin';
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  const secretValue = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
  const secret = JSON.parse(secretValue.SecretString);
  const password = secret.password || secret.Password || secret.secret || secret.Secret;
  if (!password) throw new Error('Password not found in secret');
  return new Pool({
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
}

function normaliseRoleName(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/\s+/g, '_').trim();
}

async function main() {
  console.log('🔍 Legacy role vendors analysis');
  console.log('================================\n');
  console.log('Canonical active roles:', CANONICAL_ACTIVE_ROLES.length);
  console.log('');

  const pool = await getPool();
  try {
    await pool.query('SELECT 1');
  } catch (e) {
    console.error('❌ Connection failed:', e.message);
    process.exit(1);
  }

  // 1) All roles in DB with vendor count and is_active
  const rolesResult = await pool.query(`
    SELECT r.id, r.name, r.display_name, r.is_active,
           (SELECT COUNT(*) FROM vendors v WHERE v.role_id = r.id) AS vendor_count
    FROM roles r
    ORDER BY r.is_active DESC, r.name
  `);

  const canonicalSet = new Set(CANONICAL_ACTIVE_ROLES.map(normaliseRoleName));
  const legacyRoles = rolesResult.rows.filter(r => !canonicalSet.has(normaliseRoleName(r.name)) || !r.is_active);
  const activeCanonicalRoles = rolesResult.rows.filter(r => r.is_active && canonicalSet.has(normaliseRoleName(r.name)));

  console.log('1) Roles in DB');
  console.log('─'.repeat(70));
  console.log('Active canonical roles:', activeCanonicalRoles.length);
  console.log('Legacy/inactive roles with vendors:', legacyRoles.filter(r => parseInt(r.vendor_count, 10) > 0).length);
  console.log('');

  // 2) Vendors whose role is NOT in canonical active list (or role is inactive)
  const canonicalLower = CANONICAL_ACTIVE_ROLES.map(n => n.toLowerCase());
  const vendorsLegacyResult = await pool.query(`
    SELECT v.id, v.business_name, v.phone, v.status, v.is_active,
           r.id AS role_id, r.name AS role_name, r.display_name AS role_display_name, r.is_active AS role_active
    FROM vendors v
    JOIN roles r ON r.id = v.role_id
    WHERE r.is_active = false
       OR LOWER(TRIM(REPLACE(COALESCE(r.name,''), ' ', '_'))) NOT IN (SELECT unnest($1::text[]))
    ORDER BY r.name, v.business_name
  `, [canonicalLower]);

  const vendorsLegacy = vendorsLegacyResult.rows;
  console.log('2) Vendors on legacy/inactive roles (to migrate)');
  console.log('─'.repeat(70));
  if (vendorsLegacy.length === 0) {
    console.log('(none)');
  } else {
    console.table(vendorsLegacy.map(v => ({
      business_name: v.business_name,
      status: v.status,
      role_name: v.role_name,
      role_active: v.role_active,
      suggested_canonical: LEGACY_TO_CANONICAL[normaliseRoleName(v.role_name)] || LEGACY_TO_CANONICAL[v.role_name] || '?',
    })));
  }
  console.log('');

  // 3) Summary by legacy role
  const byRole = {};
  for (const v of vendorsLegacy) {
    const key = v.role_name || 'NULL';
    if (!byRole[key]) byRole[key] = { count: 0, canonical: LEGACY_TO_CANONICAL[normaliseRoleName(v.role_name)] || LEGACY_TO_CANONICAL[v.role_name] || '?' };
    byRole[key].count++;
  }
  console.log('3) Count by legacy role → canonical');
  console.log('─'.repeat(70));
  Object.entries(byRole).forEach(([role, { count, canonical }]) => {
    console.log(`  ${role} (${count} vendors) → ${canonical}`);
  });
  console.log('');

  await pool.end();
  console.log('════════════════════════════════════════════════════════════');
  console.log('Run migration 522 to consolidate: node scripts/run-migration-rds-node.js 522_consolidate_legacy_role_vendors.sql');
  console.log('════════════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
