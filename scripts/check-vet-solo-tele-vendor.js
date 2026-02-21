/**
 * Check vet_solo vendor with tele services in production RDS
 * Vendor: Pet Nutritionist (1d1329e9-3241-40f2-a3ab-9b7f7108688b)
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');

const VENDOR_ID = '1d1329e9-3241-40f2-a3ab-9b7f7108688b';
const REGION = 'ap-south-1';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';

async function checkVendor() {
  console.log('='.repeat(80));
  console.log('CHECKING VET_SOLO VENDOR IN PRODUCTION RDS');
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

    // 1. Check vendor in vendors table
    console.log('1. VENDOR IN VENDORS TABLE:');
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
      console.log('❌ VENDOR NOT FOUND IN VENDORS TABLE');
    } else {
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
    }
    console.log('');

    // 2. Check vendor_identity (skip if vendor exists in vendors table)
    console.log('2. VENDOR_IDENTITY:');
    console.log('-'.repeat(80));
    if (vendorResult.records.length > 0) {
      console.log('⚠️  Vendor exists in vendors table, skipping vendor_identity check');
    } else {
      console.log('Checking vendor_identity...');
    }
    console.log('');

    // 3. Check tele services
    console.log('3. TELE SERVICES:');
    console.log('-'.repeat(80));
    const servicesQuery = `
      SELECT 
        vs.id, vs.service_name, vs.service_style, 
        vs.is_enabled, vs.publish_status, vs.vendor_id
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
        publish_status: s[4]?.stringValue || 'NOT SET',
        vendor_id: s[5]?.stringValue
      }, null, 2));
    });
    console.log('');

    // 4. Check availability
    console.log('4. AVAILABILITY (vendor_availability_v2):');
    console.log('-'.repeat(80));
    const availQuery = `
      SELECT 
        vendor_id, day_of_week, 
        COALESCE(service_styles, ARRAY[]::text[]) as service_styles,
        service_style, is_available, is_enabled
      FROM vendor_availability_v2
      WHERE vendor_id = CAST(:vendorId AS uuid)
         OR vendor_id IN (SELECT id FROM vendor_identity WHERE id = CAST(:vendorId AS uuid))
      ORDER BY day_of_week
    `;
    
    const availResult = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: availQuery,
      parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
    }));
    
    if (availResult.records.length === 0) {
      console.log('❌ NO AVAILABILITY RECORDS FOUND');
    } else {
      console.log(`Found ${availResult.records.length} availability record(s):`);
      availResult.records.forEach((row, i) => {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeek = row[1].longValue;
        console.log(`\nRecord ${i + 1}:`);
        console.log(`  Day: ${dayNames[dayOfWeek]} (${dayOfWeek})`);
        console.log(`  Service Styles: ${JSON.stringify(row[2]?.arrayValue?.stringValues || [])}`);
        console.log(`  Service Style: ${row[3]?.stringValue || 'N/A'}`);
        console.log(`  Available: ${row[4]?.booleanValue !== false ? 'Yes' : 'No'}`);
        console.log(`  Enabled: ${row[5]?.booleanValue !== false ? 'Yes' : 'No'}`);
      });
    }
    console.log('');

    // 5. Test discovery query
    console.log('5. TESTING DISCOVERY QUERY LOGIC:');
    console.log('-'.repeat(80));
    const roleName = vendorResult.records.length > 0 ? vendorResult.records[0][9]?.stringValue : 
                     (viResult.records.length > 0 ? 'vet_solo' : 'unknown');
    console.log(`Role: ${roleName}`);
    console.log(`Category requested: vet`);
    console.log(`Service style: tele`);
    console.log(`\nChecking if role matches vet category...`);
    
    // Check if vet_solo is in vet category roles
    const categoryRolesQuery = `
      SELECT name FROM roles
      WHERE LOWER(name) = ANY(ARRAY['vet_solo', 'veterinarian', 'vet_clinic', 'vet']::text[])
    `;
    
    const categoryRolesResult = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: categoryRolesQuery
    }));
    
    console.log(`Vet category roles: ${categoryRolesResult.records.map(r => r[0].stringValue).join(', ')}`);
    console.log(`Vendor role '${roleName}' ${categoryRolesResult.records.some(r => r[0].stringValue.toLowerCase() === roleName?.toLowerCase()) ? 'MATCHES' : 'DOES NOT MATCH'} vet category`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkVendor().catch(console.error);
