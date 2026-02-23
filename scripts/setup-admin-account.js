#!/usr/bin/env node
/**
 * Setup Admin Account Script
 * Creates or updates admin@warmpawz.com with password Admin123!
 * 
 * Usage: node scripts/setup-admin-account.js [--env=prod|dev]
 */

const { Pool } = require('pg');
const crypto = require('crypto');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

// Password hashing function (matches backend implementation)
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// Get database config from environment or use defaults
const env = process.argv.find(arg => arg.startsWith('--env='))?.split('=')[1] || 'dev';
const REGION = 'ap-south-1';

async function getDbConfig() {
  if (env === 'dev') {
    return {
      host: process.env.DB_HOST || 'warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
      port: 5432,
      database: 'warmpawz',
      user: process.env.DB_USER || 'warmpawz_admin',
      password: process.env.DB_PASSWORD || 'Warmpawz2026',
      ssl: { rejectUnauthorized: false }
    };
  } else if (env === 'prod') {
    // Try to get from environment first
    if (process.env.DB_PASSWORD) {
      return {
        host: process.env.DB_HOST || 'warmpawz-prod-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
        port: 5432,
        database: 'warmpawz',
        user: process.env.DB_USER || 'warmpawz_admin',
        password: process.env.DB_PASSWORD,
        ssl: { rejectUnauthorized: false }
      };
    }
    
    // Try to fetch from Secrets Manager
    try {
      console.log('🔐 Fetching database credentials from AWS Secrets Manager...');
      const clusterId = 'warmpawz-prod-cluster';
      const clusterInfo = JSON.parse(execSync(
        `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --output json`,
        { encoding: 'utf8' }
      ));
      
      if (!clusterInfo.DBClusters || clusterInfo.DBClusters.length === 0) {
        throw new Error(`RDS cluster not found: ${clusterId}`);
      }
      
      const cluster = clusterInfo.DBClusters[0];
      const dbName = cluster.DatabaseName || 'warmpawz';
      const username = cluster.MasterUsername || 'warmpawz_admin';
      const secretName = 'warmpawz-prod-rds-master-20260207201049162400000001';
      
      const secretsClient = new SecretsManagerClient({ region: REGION });
      const secretValue = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretName }));
      const secret = JSON.parse(secretValue.SecretString);
      const password = secret.password || secret.Password || secret.secret || secret.Secret;
      
      if (!password) {
        throw new Error('Password not found in secret');
      }
      
      console.log('✅ Credentials fetched from Secrets Manager');
      
      return {
        host: cluster.Endpoint,
        port: parseInt(cluster.Port || '5432', 10),
        database: dbName,
        user: username,
        password,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
      };
    } catch (error) {
      console.error('❌ Failed to fetch credentials from Secrets Manager:', error.message);
      console.error('');
      console.error('💡 Alternative: Set DB_PASSWORD environment variable:');
      console.error('   $env:DB_PASSWORD="<your-password>"');
      console.error('   node scripts/setup-admin-account.js --env=prod');
      throw error;
    }
  } else {
    throw new Error('Invalid environment. Use --env=dev or --env=prod');
  }
}

let pool;

async function setupAdminAccount() {
  const email = 'admin@warmpawz.com';
  const password = 'Admin123!';
  const name = 'System Administrator';
  const role = 'super-admin';

  try {
    // Get database config
    const config = await getDbConfig();
    pool = new Pool(config);
    console.log(`🔍 Checking admin account: ${email} (${env} environment)...`);
    
    // Check if admin exists
    const checkResult = await pool.query(
      'SELECT id, email, name, role, password_hash, is_active FROM admins WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (checkResult.rows.length === 0) {
      // Create new admin account
      console.log('📝 Creating new admin account...');
      const passwordHash = hashPassword(password);
      
      const insertResult = await pool.query(
        `INSERT INTO admins (email, name, role, password_hash, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id, email, name, role, is_active`,
        [email, name, role, passwordHash, true]
      );
      
      console.log('✅ Admin account created successfully!');
      console.log('   ID:', insertResult.rows[0].id);
      console.log('   Email:', insertResult.rows[0].email);
      console.log('   Name:', insertResult.rows[0].name);
      console.log('   Role:', insertResult.rows[0].role);
    } else {
      const admin = checkResult.rows[0];
      console.log('✅ Admin account found:');
      console.log('   ID:', admin.id);
      console.log('   Email:', admin.email);
      console.log('   Name:', admin.name);
      console.log('   Role:', admin.role);
      console.log('   Active:', admin.is_active);
      console.log('   Has Password:', !!admin.password_hash);
      
      if (!admin.password_hash) {
        // Update password
        console.log('🔐 Setting password for existing admin account...');
        const passwordHash = hashPassword(password);
        
        await pool.query(
          'UPDATE admins SET password_hash = $1, updated_at = NOW() WHERE id = $2',
          [passwordHash, admin.id]
        );
        
        console.log('✅ Password set successfully!');
      } else {
        // Update password anyway (in case it needs to be reset)
        console.log('🔐 Updating password hash...');
        const passwordHash = hashPassword(password);
        
        await pool.query(
          'UPDATE admins SET password_hash = $1, updated_at = NOW() WHERE id = $2',
          [passwordHash, admin.id]
        );
        
        console.log('✅ Password updated successfully!');
      }
    }
    
    console.log('');
    console.log('📋 Login Credentials:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('');
    console.log('✅ Setup complete!');
    
  } catch (error) {
    console.error('❌ Error setting up admin account:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupAdminAccount();
