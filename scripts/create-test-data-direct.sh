#!/usr/bin/env node
/**
 * Create test data directly in database
 * Creates package purchase, training skills, and pet skill progress
 */

const { Client } = require('pg');
const { execSync } = require('child_process');

const ENVIRONMENT = process.argv[2] || 'dev';
const REGION = process.argv[3] || 'ap-south-1';

const CUSTOMER_ID = '0d64d12f-3f6a-4cf7-a0c9-47d0ab5d189b';
const PET_ID = '3bce30ad-350f-42ff-9ec0-c0e8643099ee';
const VENDOR_ID = '4dd488a2-54a9-4246-80b4-8b3e28636998';

async function getRdsEndpoint() {
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  const endpoint = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier "${clusterId}" --region "${REGION}" --query 'DBClusters[0].Endpoint' --output text`,
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim();
  return endpoint;
}

async function getDbCredentials() {
  const secretName = `warmpawz-${ENVIRONMENT}-rds-master`;
  const secretsOutput = execSync(
    `aws secretsmanager list-secrets --region "${REGION}" --query "SecretList[?starts_with(Name, '${secretName}')].ARN" --output text`,
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim();
  
  const secretArn = secretsOutput.split('\n')[0];
  const secretValue = execSync(
    `aws secretsmanager get-secret-value --secret-id "${secretArn}" --region "${REGION}" --query SecretString --output text`,
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim();
  
  const secret = JSON.parse(secretValue);
  return {
    username: secret.username || secret.Username,
    password: secret.password || secret.Password,
    database: secret.dbname || secret.dbname || `warmpawz_${ENVIRONMENT}`
  };
}

async function createTestData() {
  console.log('🧪 Creating Test Data');
  console.log('============================================================');
  
  try {
    const endpoint = await getRdsEndpoint();
    const credentials = await getDbCredentials();
    
    const client = new Client({
      host: endpoint,
      port: 5432,
      database: credentials.database,
      user: credentials.username,
      password: credentials.password,
      ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    console.log('✅ Connected to database');
    console.log('');
    
    // 1. Create package purchase
    console.log('📦 Creating package purchase...');
    const packageResult = await client.query(`
      INSERT INTO package_purchases (
        purchase_id, package_id, customer_id, vendor_id, package_name,
        package_type, package_price, amount, total_sessions, remaining_sessions,
        status, payment_status, expires_at, created_at, updated_at
      ) VALUES (
        'pur_test_' || extract(epoch from now())::text,
        gen_random_uuid(),
        $1, $2, '5 Session Vet Package',
        'appointment', 2499.00, 2499.00, 5, 3,
        'active', 'completed', NOW() + INTERVAL '30 days',
        NOW(), NOW()
      )
      ON CONFLICT (purchase_id) DO NOTHING
      RETURNING id, purchase_id;
    `, [CUSTOMER_ID, VENDOR_ID]);
    
    if (packageResult.rows.length > 0) {
      console.log(`✅ Package purchase created: ${packageResult.rows[0].purchase_id}`);
    } else {
      console.log('⚠️  Package purchase already exists');
    }
    console.log('');
    
    // 2. Create training skills (migration 070 seeds basic skills, check first)
    console.log('🎓 Checking training skills...');
    const existingSkills = await client.query('SELECT COUNT(*) FROM training_skills');
    if (existingSkills.rows[0].count === '0') {
      console.log('⚠️  No skills found, creating basic set...');
      await client.query(`
        INSERT INTO training_skills (skill_name, skill_code, skill_category, description, display_order) VALUES
          ('Sit', 'sit', 'basic', 'Dog sits on command', 1),
          ('Stay', 'stay', 'basic', 'Dog stays in position', 2),
          ('Come', 'come', 'basic', 'Dog comes when called', 3),
          ('Down', 'down', 'basic', 'Dog lies down on command', 4),
          ('Heel', 'heel', 'intermediate', 'Dog walks beside owner', 10)
        ON CONFLICT (skill_code) DO NOTHING;
      `);
      console.log('✅ Training skills created');
    } else {
      console.log(`✅ Training skills already exist (${existingSkills.rows[0].count} skills)`);
    }
    console.log('');
    
    // 3. Create pet skill progress
    console.log('📊 Creating pet skill progress...');
    await client.query(`
      INSERT INTO pet_skill_progress (
        pet_id, skill_id, current_level, proficiency_score, sessions_practiced,
        trainer_id, started_at, updated_at
      ) 
      SELECT 
        $1, ts.id,
        CASE 
          WHEN ts.skill_code = 'sit' THEN 'proficient'
          WHEN ts.skill_code = 'stay' THEN 'developing'
          WHEN ts.skill_code = 'come' THEN 'developing'
          ELSE 'learning'
        END,
        CASE 
          WHEN ts.skill_code = 'sit' THEN 75
          WHEN ts.skill_code = 'stay' THEN 50
          WHEN ts.skill_code = 'come' THEN 60
          ELSE 30
        END,
        CASE 
          WHEN ts.skill_code = 'sit' THEN 5
          WHEN ts.skill_code = 'stay' THEN 3
          ELSE 2
        END,
        $2,
        NOW() - INTERVAL '7 days',
        NOW()
      FROM training_skills ts
      WHERE ts.skill_code IN ('sit', 'stay', 'come')
      ON CONFLICT (pet_id, skill_id) DO UPDATE SET
        current_level = EXCLUDED.current_level,
        proficiency_score = EXCLUDED.proficiency_score,
        sessions_practiced = EXCLUDED.sessions_practiced,
        updated_at = NOW();
    `, [PET_ID, VENDOR_ID]);
    console.log('✅ Pet skill progress created');
    console.log('');
    
    // Verify
    console.log('📊 Verifying test data...');
    const packageCount = await client.query('SELECT COUNT(*) FROM package_purchases WHERE customer_id = $1', [CUSTOMER_ID]);
    const skillCount = await client.query('SELECT COUNT(*) FROM training_skills');
    const progressCount = await client.query('SELECT COUNT(*) FROM pet_skill_progress WHERE pet_id = $1', [PET_ID]);
    
    console.log(`   Packages: ${packageCount.rows[0].count}`);
    console.log(`   Training Skills: ${skillCount.rows[0].count}`);
    console.log(`   Pet Skill Progress: ${progressCount.rows[0].count}`);
    console.log('');
    
    await client.end();
    console.log('✅ Test data creation complete!');
    
  } catch (error) {
    console.error('❌ Failed to create test data!');
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

createTestData();
