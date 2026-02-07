#!/usr/bin/env node
/**
 * Seed policies, tax rules, HSN codes, banners, spotlight offers, promotions on AWS RDS.
 * Uses same RDS connection pattern as run-migration-rds-node.js / run-pharmacy-migrations.js.
 *
 * Usage:
 *   node scripts/run-seed-policies-tax-banners-rds.js
 *   ENVIRONMENT=dev node scripts/run-seed-policies-tax-banners-rds.js
 *
 * Connection: DATABASE_URL or RDS_CONNECTION, else AWS RDS (ENVIRONMENT, AWS CLI + Secrets Manager).
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

async function getRdsConfig() {
  const { execSync } = require('child_process');
  const { SecretsManagerClient, GetSecretValueCommand, ListSecretsCommand } = require('@aws-sdk/client-secrets-manager');

  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const endpoint = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
    { encoding: 'utf8' }
  ).trim();
  if (!endpoint || endpoint === 'None' || endpoint === 'null') {
    throw new Error(`RDS cluster not found: ${clusterId}`);
  }

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

  let secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  const sm = new SecretsManagerClient({ region: REGION });
  try {
    await sm.send(new GetSecretValueCommand({ SecretId: secretName }));
  } catch {
    const list = await sm.send(new ListSecretsCommand({}));
    const rds = list.SecretList?.find(s => s.Name?.includes('rds-master'));
    if (rds) secretName = rds.Name;
    else throw new Error('RDS master secret not found');
  }
  const secret = JSON.parse((await sm.send(new GetSecretValueCommand({ SecretId: secretName }))).SecretString || '{}');
  const password = secret.password || secret.Password;
  if (!password) throw new Error('No password in secret');

  return {
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  };
}

async function run() {
  console.log('Seed: policies, tax, banners, spotlight, promotions (RDS)\n');

  let poolConfig = process.env.DATABASE_URL || process.env.RDS_CONNECTION;
  if (poolConfig && typeof poolConfig === 'string') {
    poolConfig = { connectionString: poolConfig };
  } else {
    console.log(`Using AWS RDS (ENVIRONMENT=${ENVIRONMENT}, AWS_REGION=${REGION})...`);
    poolConfig = await getRdsConfig();
    console.log('RDS config resolved.\n');
  }

  const pool = new Pool(poolConfig);

  try {
    await pool.query('SELECT 1');
    console.log('Connected.\n');

    // 1) Migrations – promotions code, scheduling_policies, gst_rules (if missing)
    for (const name of ['510_promotions_code_column.sql', '511_scheduling_policies_table_only.sql', '512_gst_rules_table_only.sql']) {
      const migrationPath = path.join(__dirname, '..', 'db', 'migrations', name);
      if (fs.existsSync(migrationPath)) {
        console.log(`Running migration ${name}...`);
        const sql = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(sql);
        console.log('  OK');
      }
    }
    console.log('');

    // 2) Booking cancellation rule (platform default) – one row only
    console.log('Seeding booking_cancellation_rules...');
    const hasBcr = await pool.query(
      `SELECT 1 FROM booking_cancellation_rules WHERE vendor_id IS NULL AND service_id IS NULL LIMIT 1`
    ).then(r => (r.rows && r.rows.length > 0)).catch(() => false);
    if (!hasBcr) {
      await pool.query(`
        INSERT INTO booking_cancellation_rules (
          vendor_id, service_id, full_refund_before_hours, partial_refund_before_hours,
          partial_refund_percentage, cancellation_cutoff_hours, no_refund_before_hours,
          reschedule_allowed, reschedule_cutoff_hours, max_reschedules
        ) VALUES (NULL, NULL, 48, 24, 50, 6, 0, true, 12, 2)
      `);
    }
    console.log('  OK');

    // 3) Cancellation policy
    console.log('Seeding cancellation_policies...');
    await pool.query(`
      INSERT INTO cancellation_policies (policy_name, description, hours_before_booking, cancellation_fee_percentage, is_active)
      VALUES ('Standard Cancellation', 'Full refund 48h before, 50% 24h before, no refund within 6h', 2, 0, true)
      ON CONFLICT (policy_name) DO NOTHING
    `).catch(e => { if (!e.message.includes('unique') && !e.message.includes('duplicate')) throw e; });
    console.log('  OK');

    // 4) Scheduling policies (skip if table does not exist)
    console.log('Seeding scheduling_policies...');
    try {
      for (const { policy_name, policy_type, policy_config } of [
        { policy_name: 'Standard Buffer', policy_type: 'buffer_time', policy_config: { minBufferTime: 30, maxBufferTime: 240, maxConcurrentBookingsPerVendor: 1 } },
        { policy_name: 'Standard Slot Reservation', policy_type: 'slot_reservation', policy_config: { reservationTimeout: 15, slotDuration: 30, breakBetweenSlots: 15, maxReservationsPerCustomer: 3 } },
      ]) {
        await pool.query(
          `INSERT INTO scheduling_policies (policy_name, policy_type, policy_config, is_active)
           VALUES ($1, $2, $3::jsonb, true)
           ON CONFLICT (policy_name) DO UPDATE SET policy_type = EXCLUDED.policy_type, policy_config = EXCLUDED.policy_config`,
          [policy_name, policy_type, JSON.stringify(policy_config)]
        ).catch(e => { if (!e.message.includes('unique') && !e.message.includes('duplicate')) throw e; });
      }
      console.log('  OK');
    } catch (e) {
      if (e.message && e.message.includes('does not exist')) { console.log('  SKIP (table missing)'); } else { throw e; }
    }

    // 5) GST rules (skip if table does not exist)
    console.log('Seeding gst_rules...');
    try {
    const gstRules = [
      ['Standard 18%', 100, 18, 9, 9, 18, 'Default 18% for services'],
      ['At-Home 18%', 150, 18, 9, 9, 18, null],
      ['Tele 18%', 150, 18, 9, 9, 18, null],
      ['Pet Medicines 12%', 200, 12, 6, 6, 12, null],
      ['Pet Food 18%', 200, 18, 9, 9, 18, null],
    ];
    for (const [name, priority, gst, cgst, sgst, igst, desc] of gstRules) {
      await pool.query(`
        INSERT INTO gst_rules (rule_name, enabled, priority, gst_type, gst_rate, cgst_percentage, sgst_percentage, igst_percentage, description)
        VALUES ($1, true, $2, 'percentage', $3, $4, $5, $6, $7)
      `, [name, priority, gst, cgst, sgst, igst, desc]).catch(e => { if (!e.message.includes('unique') && !e.message.includes('duplicate')) throw e; });
    }
    console.log('  OK');
    } catch (e) {
      if (e.message && e.message.includes('does not exist')) { console.log('  SKIP (table missing)'); } else { throw e; }
    }

    // 6) HSN codes
    console.log('Seeding hsn_codes...');
    try {
    const hsnRows = [
      ['998351', 'Veterinary services for pet animals', 0],
      ['998612', 'Animal husbandry, grooming, boarding, training', 0],
      ['2309', 'Dog or cat food', 18],
      ['0106', 'Live animals (pets)', 0],
      ['3004', 'Veterinary medicines', 12],
      ['4201', 'Pet accessories (leather)', 12],
      ['6307', 'Pet accessories (textile)', 12],
      ['3926', 'Pet accessories (plastic)', 12],
      ['9609', 'Pet grooming tools and general goods', 18],
    ];
    for (const [code, description, rate] of hsnRows) {
      await pool.query(`
        INSERT INTO hsn_codes (hsn_code, description, gst_rate, is_active)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (hsn_code) DO UPDATE SET description = EXCLUDED.description, gst_rate = EXCLUDED.gst_rate
      `, [code, description, rate]).catch(e => { if (!e.message.includes('unique') && !e.message.includes('duplicate')) throw e; });
    }
    console.log('  OK');
    } catch (e) {
      if (e.message && e.message.includes('does not exist')) { console.log('  SKIP (table missing)'); } else { throw e; }
    }

    // 7) Banners (type = main for customer home)
    console.log('Seeding banners...');
    try {
    const banners = [
      ['main', 'Get 50% OFF', 'First Grooming Session', 'Claim Now', '/grooming', 1, { gradient_from: '#FF8C42', gradient_to: '#FF6B35', icon: '✂️' }],
      ['main', 'Free Health Checkup', 'Book Vet Appointment Today', 'Book Now', '/vet', 2, { gradient_from: '#4CAF50', gradient_to: '#2E7D32', icon: '🩺' }],
      ['main', 'Premium Pet Food', '20% OFF First Order', 'Shop Now', '/shop', 3, { gradient_from: '#FF6B9D', gradient_to: '#C44569', icon: '🦴' }],
    ];
    for (const [type, title, subtitle, cta_text, cta_link, display_order, metadata] of banners) {
      await pool.query(`
        INSERT INTO banners (type, title, subtitle, cta_text, cta_link, display_order, metadata, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, true)
      `, [type, title, subtitle, cta_text, cta_link, display_order, JSON.stringify(metadata || {})]).catch(e => { if (!e.message.includes('unique') && !e.message.includes('duplicate')) throw e; });
    }
    console.log('  OK');
    } catch (e) {
      if (e.message && e.message.includes('does not exist')) { console.log('  SKIP (table missing)'); } else { throw e; }
    }

    // 8) Spotlight offers
    console.log('Seeding spotlight_offers...');
    try {
    const spotlights = [
      ['veterinarian', 'vet', 'Free Health Check', 'First visit', 'percentage', 100, 'First Visit', '🩺', 'Book Now', '/vet', 1],
      ['groomer', 'grooming', '50% Off Grooming', 'First session', 'percentage', 50, 'Limited Time', '✂️', 'Claim', '/grooming', 1],
      ['trainer', 'training', '20% Off Training', 'First package', 'percentage', 20, 'New User', '🎓', 'Book', '/training', 1],
      ['boarder', 'boarding', '10% Off Boarding', 'Week stay', 'percentage', 10, 'Seasonal', '🏠', 'Book', '/boarding', 1],
    ];
    for (const [role_id, service_category, title, subtitle, discount_type, discount_value, badge_text, icon, cta_text, cta_link, display_order] of spotlights) {
      await pool.query(`
        INSERT INTO spotlight_offers (role_id, service_category, title, subtitle, discount_type, discount_value, badge_text, icon, cta_text, cta_link, display_order, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
      `, [role_id, service_category, title, subtitle, discount_type, discount_value, badge_text, icon, cta_text, cta_link, display_order]).catch(e => { if (!e.message.includes('unique') && !e.message.includes('duplicate')) throw e; });
    }
    console.log('  OK');
    } catch (e) {
      if (e.message && e.message.includes('does not exist')) { console.log('  SKIP (table missing)'); } else { throw e; }
    }

    // 9) Promotions (with code for validate; code column added by migration 510)
    console.log('Seeding promotions...');
    try {
    const startDate = '2025-01-01';
    const endDate = '2026-12-31';
    const promos = [
      ['First Grooming 50%', 'Half off first grooming', 'discount', 'percentage', 50, 0, null, '["grooming"]', 10, true, true, 'GROOM50'],
      ['Vet Check 100', 'Free first vet check', 'free_service', 'fixed', 0, 0, null, '["vet"]', 10, true, true, 'VET100'],
      ['Shop 20% Off', '20% off first order', 'discount', 'percentage', 20, 500, null, '["shop","ecom"]', 5, false, true, 'SAVE20'],
    ];
    for (const [name, description, promotion_type, discount_type, discount_value, min_order_amount, max_discount_amount, applicable_services, priority, is_spotlight, published, code] of promos) {
      await pool.query(`
        INSERT INTO promotions (name, description, promotion_type, discount_type, discount_value, min_order_amount, max_discount_amount, start_date, end_date, is_active, code)
        SELECT $1, $2, $3, $4, $5, $6, $7, $8::date, $9::date, true, $10
        WHERE NOT EXISTS (SELECT 1 FROM promotions WHERE code = $10)
      `, [name, description, promotion_type, discount_type, discount_value, min_order_amount || null, max_discount_amount, startDate, endDate, code]).catch(e => {
        if (e.message && (e.message.includes('column "code"') || e.message.includes('column "applicable_services"'))) {
          return pool.query(`
            INSERT INTO promotions (name, description, promotion_type, discount_type, discount_value, min_order_amount, max_discount_amount, start_date, end_date, is_active)
            SELECT $1, $2, $3, $4, $5, $6, $7, $8::date, $9::date, true
            WHERE NOT EXISTS (SELECT 1 FROM promotions WHERE name = $1)
          `, [name, description, promotion_type, discount_type, discount_value, min_order_amount || null, max_discount_amount, startDate, endDate]);
        }
        if (!e.message.includes('unique') && !e.message.includes('duplicate')) throw e;
      });
      // Update optional columns if they exist
      await pool.query(`
        UPDATE promotions SET applicable_services = $1::jsonb, priority = $2, is_spotlight = $3, published = $4, code = $5
        WHERE name = $6
      `, [applicable_services, priority, is_spotlight, published, code, name]).catch(() => {});
    }
    console.log('  OK');
    } catch (e) {
      if (e.message && e.message.includes('does not exist')) { console.log('  SKIP (table missing)'); } else { throw e; }
    }

    // Verification – row counts
    console.log('\n--- Verification (row counts) ---');
    const tables = [
      'booking_cancellation_rules',
      'cancellation_policies',
      'scheduling_policies',
      'gst_rules',
      'hsn_codes',
      'banners',
      'spotlight_offers',
      'promotions',
    ];
    for (const table of tables) {
      const r = await pool.query(`SELECT COUNT(*) as c FROM ${table}`).catch(() => ({ rows: [{ c: '?' }] }));
      console.log(`  ${table}: ${r.rows[0].c}`);
    }
    console.log('\nSeed complete. See scripts/SEED_VERIFICATION_RESULT.md for UI verification.');
  } catch (err) {
    console.error('\nSeed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
