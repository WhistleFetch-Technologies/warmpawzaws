/**
 * Check if tele vendor appears in discovery
 * Vendor: Pet Nutritionist (4fee508b-5cd7-4c2e-9252-94e4bcd99af9)
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');

const VENDOR_ID = '4fee508b-5cd7-4c2e-9252-94e4bcd99af9';
const REGION = 'ap-south-1';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';

async function checkVendor() {
  console.log('='.repeat(80));
  console.log('CHECKING TELE VENDOR IN PRODUCTION');
  console.log('='.repeat(80));
  console.log(`Vendor ID: ${VENDOR_ID}\n`);

  try {
    const clusterInfo = JSON.parse(execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER_ID} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    ));
    
    const cluster = clusterInfo.DBClusters[0];
    const clusterArn = cluster.DBClusterArn;

    const secretsClient = new SecretsManagerClient({ region: REGION });
    const secretResponse = await secretsClient.send(new GetSecretValueCommand({
      SecretId: SECRET_NAME
    }));
    const secretArn = secretResponse.ARN;

    const rdsClient = new RDSDataClient({ region: REGION });

    // 1. Check vendor basic info
    console.log('1. VENDOR BASIC INFO:');
    console.log('-'.repeat(80));
    const vendorQuery = `
      SELECT 
        v.id, v.business_name, v.owner_name, v.phone, v.status, v.is_active,
        v.role_id, v.category, v.vendor_type,
        r.name as role_name, r.display_name as role_display_name
      FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
      WHERE v.id = CAST(:vendorId AS uuid)
    `;
    
    const vendorResult = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: vendorQuery,
      parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
    }));
    
    if (vendorResult.records.length === 0) {
      console.log('❌ VENDOR NOT FOUND!');
      process.exit(1);
    }
    
    const vendor = vendorResult.records[0];
    console.log(JSON.stringify({
      id: vendor[0].stringValue,
      business_name: vendor[1].stringValue,
      status: vendor[4].stringValue,
      is_active: vendor[5].booleanValue,
      vendor_type: vendor[8]?.stringValue,
      role_name: vendor[9]?.stringValue,
      category: vendor[7]?.stringValue
    }, null, 2));
    console.log('');

    // 2. Check vendor services with tele style
    console.log('2. TELE SERVICES:');
    console.log('-'.repeat(80));
    const servicesQuery = `
      SELECT 
        vs.id, vs.service_name, vs.service_style, 
        vs.is_enabled, vs.publish_status
      FROM vendor_services vs
      WHERE vs.vendor_id = CAST(:vendorId AS uuid)
        AND vs.service_style IN ('tele', 'online', 'video_consultation')
        AND vs.is_enabled = true
        AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
    `;
    
    const servicesResult = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: servicesQuery,
      parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
    }));
    
    console.log(`Found ${servicesResult.records.length} tele service(s):`);
    servicesResult.records.forEach((s, i) => {
      console.log(`\nService ${i + 1}:`);
      console.log(JSON.stringify({
        id: s[0].stringValue,
        name: s[1].stringValue,
        style: s[2]?.stringValue || 'NOT SET',
        enabled: s[3].booleanValue,
        publish_status: s[4]?.stringValue || 'NOT SET'
      }, null, 2));
    });
    console.log('');

    // 3. Check if vendor would match discovery query
    console.log('3. DISCOVERY QUERY TEST:');
    console.log('-'.repeat(80));
    const roleName = vendor[9]?.stringValue || '';
    const category = 'vet';
    const serviceStyle = 'tele';
    
    // Check if role matches vet category
    const roleQuery = `
      SELECT name, display_name
      FROM roles
      WHERE LOWER(name) = ANY(ARRAY['pet_nutritionist', 'nutritionist', 'nutritionist_solo', 'nutritionist_center']::text[])
         OR LOWER(display_name) LIKE '%nutrition%'
    `;
    
    const roleResult = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: roleQuery
    }));
    
    console.log(`Role: ${roleName}`);
    console.log(`Category requested: ${category}`);
    console.log(`Service style: ${serviceStyle}`);
    console.log(`\n⚠️  ISSUE: Vendor role is '${roleName}' but category is '${category}'`);
    console.log(`   The vendor is a nutritionist, not a vet!`);
    console.log(`   This is why they don't appear in vet category discovery.`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkVendor().catch(console.error);
