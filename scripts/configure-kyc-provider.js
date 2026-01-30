#!/usr/bin/env node
/**
 * Configure KYC Provider Settings
 * 
 * Usage:
 *   node scripts/configure-kyc-provider.js --provider sandbox --enable
 *   node scripts/configure-kyc-provider.js --provider signzy --api-key xxx --api-secret yyy --enable
 *   node scripts/configure-kyc-provider.js --status
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand, CreateSecretCommand, UpdateSecretCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

// Provider base URLs
const PROVIDER_URLS = {
  sandbox: 'https://api.sandbox.co.in',
  signzy: 'https://preproduction.signzy.tech',
  idfy: 'https://eve.idfy.com',
  karza: 'https://api.karza.in',
};

async function getDBConnection() {
  const { execSync } = require('child_process');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  
  const endpoint = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
    { encoding: 'utf8' }
  ).trim();
  
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretValue = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002` })
  );
  const secret = JSON.parse(secretValue.SecretString);
  
  return new Pool({
    host: endpoint,
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: secret.password,
    ssl: { rejectUnauthorized: false },
  });
}

async function getKYCStatus() {
  console.log('📊 KYC Provider Status');
  console.log('======================');
  
  const pool = await getDBConnection();
  
  try {
    // Check platform_settings
    const settingsResult = await pool.query(`
      SELECT setting_value 
      FROM platform_settings 
      WHERE setting_key = 'platform:integrations:kyc'
    `);
    
    if (settingsResult.rows.length > 0) {
      const config = typeof settingsResult.rows[0].setting_value === 'string'
        ? JSON.parse(settingsResult.rows[0].setting_value)
        : settingsResult.rows[0].setting_value;
      
      console.log('');
      console.log('Current Configuration (from platform_settings):');
      console.log(`   Provider: ${config.provider || 'not set'}`);
      console.log(`   Enabled: ${config.enabled ? 'YES' : 'NO'}`);
      console.log(`   Base URL: ${config.baseUrl || 'default'}`);
      console.log(`   API Key: ${config.apiKey ? '***configured***' : 'not set'}`);
      console.log(`   API Secret: ${config.apiSecret ? '***configured***' : 'not set'}`);
    } else {
      console.log('');
      console.log('No KYC configuration found in platform_settings.');
      console.log('Using default sandbox mock mode.');
    }
    
    // Check AWS Secrets Manager
    console.log('');
    console.log('Checking AWS Secrets Manager...');
    
    const secretsClient = new SecretsManagerClient({ region: REGION });
    try {
      const secretName = `warmpawz/${ENVIRONMENT}/kyc-provider`;
      const secretValue = await secretsClient.send(
        new GetSecretValueCommand({ SecretId: secretName })
      );
      const secret = JSON.parse(secretValue.SecretString);
      console.log(`   Found secret: ${secretName}`);
      console.log(`   Provider: ${secret.provider || 'not set'}`);
      console.log(`   API Key: ${secret.apiKey ? '***configured***' : 'not set'}`);
    } catch (e) {
      console.log('   No KYC secret found in Secrets Manager');
    }
    
  } finally {
    await pool.end();
  }
}

async function configureKYCProvider(options) {
  const { provider, apiKey, apiSecret, baseUrl, enable } = options;
  
  console.log('🔧 Configuring KYC Provider');
  console.log('===========================');
  console.log(`   Provider: ${provider}`);
  console.log(`   Enable: ${enable}`);
  console.log(`   Base URL: ${baseUrl || PROVIDER_URLS[provider] || 'default'}`);
  console.log('');
  
  const pool = await getDBConnection();
  
  try {
    const config = {
      provider,
      apiKey: apiKey || '',
      apiSecret: apiSecret || '',
      baseUrl: baseUrl || PROVIDER_URLS[provider] || '',
      enabled: enable,
    };
    
    // Check if setting exists
    const existing = await pool.query(`
      SELECT id FROM platform_settings WHERE setting_key = 'platform:integrations:kyc'
    `);
    
    if (existing.rows.length > 0) {
      // Update existing
      await pool.query(`
        UPDATE platform_settings 
        SET setting_value = $1, updated_at = NOW()
        WHERE setting_key = 'platform:integrations:kyc'
      `, [JSON.stringify(config)]);
      console.log('✅ Updated existing KYC configuration');
    } else {
      // Insert new
      await pool.query(`
        INSERT INTO platform_settings (setting_key, setting_value, setting_type, is_public, created_at, updated_at)
        VALUES ('platform:integrations:kyc', $1, 'object', false, NOW(), NOW())
      `, [JSON.stringify(config)]);
      console.log('✅ Created new KYC configuration');
    }
    
    // Optionally store in AWS Secrets Manager if API key provided
    if (apiKey) {
      console.log('');
      console.log('Storing credentials in AWS Secrets Manager...');
      
      const secretsClient = new SecretsManagerClient({ region: REGION });
      const secretName = `warmpawz/${ENVIRONMENT}/kyc-provider`;
      
      try {
        await secretsClient.send(new UpdateSecretCommand({
          SecretId: secretName,
          SecretString: JSON.stringify(config),
        }));
        console.log('✅ Updated secret in Secrets Manager');
      } catch (e) {
        if (e.name === 'ResourceNotFoundException') {
          await secretsClient.send(new CreateSecretCommand({
            Name: secretName,
            SecretString: JSON.stringify(config),
            Description: 'KYC verification provider credentials',
          }));
          console.log('✅ Created secret in Secrets Manager');
        } else {
          console.log(`⚠️  Could not update Secrets Manager: ${e.message}`);
        }
      }
    }
    
    console.log('');
    console.log('✅ KYC Provider configuration complete!');
    
  } finally {
    await pool.end();
  }
}

// Parse arguments
const args = process.argv.slice(2);

if (args.includes('--status') || args.length === 0) {
  getKYCStatus().catch(console.error);
} else {
  const options = {
    provider: 'sandbox',
    apiKey: null,
    apiSecret: null,
    baseUrl: null,
    enable: false,
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--provider':
        options.provider = args[++i];
        break;
      case '--api-key':
        options.apiKey = args[++i];
        break;
      case '--api-secret':
        options.apiSecret = args[++i];
        break;
      case '--base-url':
        options.baseUrl = args[++i];
        break;
      case '--enable':
        options.enable = true;
        break;
      case '--disable':
        options.enable = false;
        break;
    }
  }
  
  configureKYCProvider(options).catch(console.error);
}
