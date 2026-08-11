#!/usr/bin/env node
/**
 * Detect and repair customer profile photos corrupted by pet photo migration
 * (GET /customer/profile used resolveCustomerPhotoForDisplay on pet rows).
 *
 * Corruption signal: image_migration_log.legacy_key LIKE 'media/pet/%'
 * AND image_migration_log.webp_key = customers.profile_photo_url
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/repair-customer-pet-photo-corruption.js
 *   ENVIRONMENT=dev node scripts/repair-customer-pet-photo-corruption.js --apply
 *   ENVIRONMENT=dev node scripts/repair-customer-pet-photo-corruption.js --phone=9876543210
 *   ENVIRONMENT=prod node scripts/repair-customer-pet-photo-corruption.js --apply --yes
 *
 * Read-only by default. --apply writes:
 *   - customers.profile_photo_url -> NULL when it holds a pet-derived migrated key
 *   - pets.profile_photo_url -> iml.webp_key when pet still has iml.legacy_key (restores display)
 *
 * Manual step: affected users may need to re-upload their human profile photo if no
 * legacy/media/customer/... recovery key exists in image_migration_log.
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const FORCE_YES = args.includes('--yes');
const phoneArg = args.find((a) => a.startsWith('--phone='));
const PHONE_FILTER = phoneArg ? phoneArg.split('=')[1].replace(/\D/g, '').slice(-10) : null;

async function getDbConfig() {
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const clusterInfo = JSON.parse(
    execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
      { encoding: 'utf8' },
    ),
  );
  const cluster = clusterInfo.DBClusters?.[0];
  if (!cluster) throw new Error(`RDS cluster not found: ${clusterId}`);

  let endpoint = cluster.Endpoint;
  if (ENVIRONMENT === 'prod') {
    endpoint =
      process.env.DB_HOST ||
      'warmpawz-prod-proxy.proxy-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
  }

  const secretArn =
    process.env.DB_SECRET_ARN ||
    (ENVIRONMENT === 'prod'
      ? process.env.PROD_DB_SECRET_ARN
      : 'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI');

  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secret = JSON.parse(
    (await secretsClient.send(new GetSecretValueCommand({ SecretId: secretArn }))).SecretString,
  );

  return {
    host: endpoint,
    port: cluster.Port || 5432,
    database: cluster.DatabaseName || 'warmpawz',
    user: secret.username || secret.user || cluster.MasterUsername,
    password: secret.password,
    ssl: { rejectUnauthorized: false },
  };
}

const DETECT_SQL = `
  SELECT
    c.id AS customer_id,
    c.phone,
    c.full_name,
    c.profile_photo_url AS customer_photo_key,
    iml.legacy_key AS pet_legacy_key,
    iml.webp_key AS migrated_webp_key,
    iml.migrated_at,
    p.id AS pet_id,
    p.name AS pet_name,
    p.profile_photo_url AS pet_photo_key
  FROM customers c
  INNER JOIN image_migration_log iml
    ON iml.webp_key = c.profile_photo_url
  LEFT JOIN pets p
    ON p.customer_id = c.id
   AND (p.profile_photo_url = iml.legacy_key OR p.profile_photo_url IS NULL)
  WHERE iml.legacy_key LIKE 'media/pet/%'
    AND c.profile_photo_url IS NOT NULL
    AND TRIM(c.profile_photo_url) <> ''
    ${PHONE_FILTER ? 'AND RIGHT(REGEXP_REPLACE(c.phone, \'\\\\D\', \'\', \'g\'), 10) = $1' : ''}
  ORDER BY c.phone, iml.migrated_at DESC
`;

const RECOVER_HUMAN_SQL = `
  SELECT iml.webp_key, iml.legacy_key, iml.migrated_at
  FROM image_migration_log iml
  WHERE iml.legacy_key LIKE $1
     OR iml.legacy_key LIKE $2
  ORDER BY iml.migrated_at DESC
  LIMIT 5
`;

async function main() {
  console.log('=== Customer / pet profile photo corruption repair ===');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Mode: ${APPLY ? 'APPLY (writes enabled)' : 'READ-ONLY (dry run)'}`);
  if (PHONE_FILTER) console.log(`Phone filter: ${PHONE_FILTER}`);
  console.log('');

  if (APPLY && ENVIRONMENT === 'prod' && !FORCE_YES) {
    console.error('Refusing prod --apply without --yes');
    process.exit(1);
  }

  const pool = new Pool(await getDbConfig());
  try {
    const params = PHONE_FILTER ? [PHONE_FILTER] : [];
    const { rows } = await pool.query(DETECT_SQL, params);

    if (rows.length === 0) {
      console.log('No corrupted customer profile photos detected.');
      return;
    }

    const byCustomer = new Map();
    for (const row of rows) {
      if (!byCustomer.has(row.customer_id)) byCustomer.set(row.customer_id, []);
      byCustomer.get(row.customer_id).push(row);
    }

    console.log(`Found ${byCustomer.size} affected customer(s), ${rows.length} log row(s):\n`);

    for (const [customerId, entries] of byCustomer) {
      const head = entries[0];
      console.log(`Customer: ${head.full_name || '(no name)'} | phone: ${head.phone} | id: ${customerId}`);
      console.log(`  Corrupted customer profile_photo_url: ${head.customer_photo_key}`);

      for (const e of entries) {
        console.log(
          `  Pet migration: legacy=${e.pet_legacy_key} -> webp=${e.migrated_webp_key}` +
            (e.pet_id ? ` | pet=${e.pet_name} (${e.pet_id}) current=${e.pet_photo_key || 'NULL'}` : ''),
        );
      }

      const customerIdPrefix = `media/customer/${customerId}/%`;
      const legacyCustomerPrefix = `legacy/media/customer/${customerId}/%`;
      const recovery = await pool.query(RECOVER_HUMAN_SQL, [customerIdPrefix, legacyCustomerPrefix]);
      if (recovery.rows.length > 0) {
        console.log('  Possible human photo recovery keys:');
        for (const r of recovery.rows) {
          console.log(`    legacy=${r.legacy_key} -> webp=${r.webp_key}`);
        }
      } else {
        console.log('  No human photo recovery key in image_migration_log — user must re-upload profile photo.');
      }
      console.log('');
    }

    if (!APPLY) {
      console.log('Dry run complete. Re-run with --apply to fix database rows.');
      return;
    }

    let clearedCustomers = 0;
    let fixedPets = 0;

    for (const [customerId, entries] of byCustomer) {
      const head = entries[0];
      const recovery = await pool.query(RECOVER_HUMAN_SQL, [
        `media/customer/${customerId}/%`,
        `legacy/media/customer/${customerId}/%`,
      ]);
      const humanKey =
        recovery.rows.find((r) => !String(r.legacy_key).startsWith('media/pet/'))?.webp_key || null;

      if (humanKey && humanKey !== head.customer_photo_key) {
        await pool.query(
          `UPDATE customers SET profile_photo_url = $2, updated_at = NOW() WHERE id = $1::uuid`,
          [customerId, humanKey],
        );
        console.log(`Restored human photo for ${head.phone}: ${humanKey}`);
      } else {
        await pool.query(
          `UPDATE customers SET profile_photo_url = NULL, updated_at = NOW() WHERE id = $1::uuid`,
          [customerId],
        );
        clearedCustomers += 1;
        console.log(`Cleared corrupted customer photo for ${head.phone} (re-upload required).`);
      }

      const seenPets = new Set();
      for (const e of entries) {
        if (!e.pet_id || seenPets.has(e.pet_id)) continue;
        seenPets.add(e.pet_id);
        if (e.pet_legacy_key && e.migrated_webp_key) {
          await pool.query(
            `UPDATE pets SET profile_photo_url = $2, updated_at = NOW()
             WHERE id = $1::uuid AND (profile_photo_url = $3 OR profile_photo_url IS NULL OR profile_photo_url = '')`,
            [e.pet_id, e.migrated_webp_key, e.pet_legacy_key],
          );
          fixedPets += 1;
          console.log(`  Pet ${e.pet_name}: set profile_photo_url -> ${e.migrated_webp_key}`);
        }
      }
    }

    console.log('');
    console.log(`Apply complete. Customers cleared/restored: ${byCustomer.size}, pets updated: ${fixedPets}.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
