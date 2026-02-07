#!/usr/bin/env node
/**
 * Diagnostic script to check vendor data in database
 * This will help identify if data was actually deleted or if it's a query/filter issue
 */

const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const REGION = 'ap-south-1';
const DB_CLUSTER_ARN = process.env.DB_CLUSTER_ARN || 'arn:aws:rds:ap-south-1:YOUR_ACCOUNT:cluster:warmpawz-dev-db';
const SECRET_ARN = process.env.DB_SECRET_ARN || 'arn:aws:secretsmanager:ap-south-1:YOUR_ACCOUNT:secret:warmpawz-dev-db-secret';

const rdsClient = new RDSDataClient({ region: REGION });
const secretsClient = new SecretsManagerClient({ region: REGION });

async function getDbCredentials() {
  try {
    const response = await secretsClient.send(new GetSecretValueCommand({ SecretId: SECRET_ARN }));
    return JSON.parse(response.SecretString);
  } catch (error) {
    console.error('Error fetching DB credentials:', error);
    throw error;
  }
}

async function executeQuery(sql, parameters = []) {
  const credentials = await getDbCredentials();
  
  const command = new ExecuteStatementCommand({
    resourceArn: DB_CLUSTER_ARN,
    secretArn: SECRET_ARN,
    database: credentials.dbname || 'warmpawz_dev',
    sql,
    parameters: parameters.map(p => ({ value: { stringValue: String(p) } })),
  });

  const response = await rdsClient.send(command);
  return response.records.map(record => {
    const row = {};
    record.forEach((field, index) => {
      const columnName = response.columnMetadata[index].name;
      row[columnName] = field.stringValue || field.longValue || field.doubleValue || field.booleanValue || null;
    });
    return row;
  });
}

async function checkVendorData() {
  console.log('🔍 Checking vendor data in database...\n');

  try {
    // Check vendors table
    console.log('1️⃣ Checking vendors table:');
    const vendors = await executeQuery(`
      SELECT 
        id, 
        business_name, 
        owner_name, 
        phone, 
        email, 
        status, 
        is_active,
        created_at
      FROM vendors
      ORDER BY created_at DESC
      LIMIT 20
    `);
    console.log(`   Found ${vendors.length} vendors in vendors table`);
    if (vendors.length > 0) {
      console.log('   Sample vendors:');
      vendors.slice(0, 5).forEach(v => {
        console.log(`   - ${v.business_name || v.owner_name} (${v.status}) - ${v.phone}`);
      });
    }
    console.log('');

    // Check vendor_onboarding_applications table
    console.log('2️⃣ Checking vendor_onboarding_applications table:');
    const applications = await executeQuery(`
      SELECT 
        id, 
        vendor_identity_id,
        status, 
        submitted_at,
        created_at
      FROM vendor_onboarding_applications
      ORDER BY submitted_at DESC, created_at DESC
      LIMIT 20
    `);
    console.log(`   Found ${applications.length} applications in vendor_onboarding_applications table`);
    if (applications.length > 0) {
      console.log('   Sample applications:');
      applications.slice(0, 5).forEach(a => {
        console.log(`   - Application ${a.id} (${a.status}) - Submitted: ${a.submitted_at || a.created_at}`);
      });
    }
    console.log('');

    // Check status distribution
    console.log('3️⃣ Status distribution in vendors table:');
    const vendorStatusCounts = await executeQuery(`
      SELECT status, COUNT(*) as count
      FROM vendors
      GROUP BY status
      ORDER BY count DESC
    `);
    vendorStatusCounts.forEach(s => {
      console.log(`   ${s.status}: ${s.count}`);
    });
    console.log('');

    // Check status distribution in applications
    console.log('4️⃣ Status distribution in vendor_onboarding_applications table:');
    const appStatusCounts = await executeQuery(`
      SELECT status, COUNT(*) as count
      FROM vendor_onboarding_applications
      GROUP BY status
      ORDER BY count DESC
    `);
    appStatusCounts.forEach(s => {
      console.log(`   ${s.status}: ${s.count}`);
    });
    console.log('');

    // Check vendor_identity table
    console.log('5️⃣ Checking vendor_identity table:');
    const identities = await executeQuery(`
      SELECT 
        id, 
        phone, 
        onboarding_status,
        selected_role_id,
        created_at
      FROM vendor_identity
      ORDER BY created_at DESC
      LIMIT 20
    `);
    console.log(`   Found ${identities.length} identities in vendor_identity table`);
    if (identities.length > 0) {
      console.log('   Sample identities:');
      identities.slice(0, 5).forEach(i => {
        console.log(`   - ${i.phone} (${i.onboarding_status})`);
      });
    }
    console.log('');

    // Summary
    console.log('📊 SUMMARY:');
    console.log(`   Total vendors: ${vendors.length}`);
    console.log(`   Total applications: ${applications.length}`);
    console.log(`   Total identities: ${identities.length}`);
    
    const pendingApps = applications.filter(a => 
      ['SUBMITTED', 'PENDING', 'UNDER_REVIEW'].includes(a.status)
    );
    const approvedVendors = vendors.filter(v => 
      v.status === 'approved' && v.is_active
    );
    
    console.log(`   Pending applications: ${pendingApps.length}`);
    console.log(`   Approved active vendors: ${approvedVendors.length}`);

  } catch (error) {
    console.error('❌ Error checking vendor data:', error);
    console.error('\n💡 Make sure you have:');
    console.error('   1. AWS credentials configured');
    console.error('   2. DB_CLUSTER_ARN and DB_SECRET_ARN environment variables set');
    console.error('   3. Proper IAM permissions to access RDS Data API');
  }
}

checkVendorData();
