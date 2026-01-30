#!/usr/bin/env node
const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

async function check() {
  const endpoint = execSync('aws rds describe-db-clusters --db-cluster-identifier warmpawz-dev-cluster --region ap-south-1 --query DBClusters[0].Endpoint --output text', { encoding: 'utf8' }).trim();
  const secretsClient = new SecretsManagerClient({ region: 'ap-south-1' });
  const secretValue = await secretsClient.send(new GetSecretValueCommand({ SecretId: 'warmpawz-dev-rds-master-20260106164510791100000002' }));
  const secret = JSON.parse(secretValue.SecretString);
  
  const pool = new Pool({
    host: endpoint,
    port: 5432,
    database: 'warmpawz',
    user: 'warmpawz_admin',
    password: secret.password,
    ssl: { rejectUnauthorized: false }
  });

  // Check all role names
  const roles = await pool.query('SELECT name, display_name FROM roles WHERE is_active = true ORDER BY name');
  console.log('Active roles in database:');
  roles.rows.forEach(r => console.log('  -', r.name, '(' + r.display_name + ')'));

  // Check onboarding_forms
  const forms = await pool.query('SELECT role_id FROM onboarding_forms ORDER BY role_id');
  console.log('\nRoles with onboarding forms:');
  forms.rows.forEach(r => console.log('  -', r.role_id));

  // Check if 'veterinarian' exists
  const vetCheck = await pool.query("SELECT name FROM roles WHERE name LIKE '%vet%' OR name LIKE '%Vet%'");
  console.log('\nRoles containing "vet":');
  vetCheck.rows.forEach(r => console.log('  -', r.name));

  await pool.end();
}
check().catch(console.error);
