/**
 * Check if vendor exists in production RDS
 * Vendor: Friendly tails pet hospital (863d5f9f-2cec-4792-9ea8-64c98059061c)
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');

const VENDOR_ID = '863d5f9f-2cec-4792-9ea8-64c98059061c';
const REGION = 'ap-south-1';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';

async function checkVendor() {
  console.log('='.repeat(80));
  console.log('CHECKING VENDOR IN PRODUCTION RDS');
  console.log('='.repeat(80));
  console.log(`Vendor ID: ${VENDOR_ID}\n`);

  try {
    // Get cluster ARN
    const clusterInfo = JSON.parse(execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER_ID} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    ));
    
    if (!clusterInfo.DBClusters || clusterInfo.DBClusters.length === 0) {
      console.error(`❌ RDS cluster not found: ${CLUSTER_ID}`);
      process.exit(1);
    }
    
    const cluster = clusterInfo.DBClusters[0];
    const clusterArn = cluster.DBClusterArn;
    console.log(`✅ Cluster found: ${CLUSTER_ID}`);
    console.log(`   ARN: ${clusterArn}\n`);

    // Get secret ARN
    const secretsClient = new SecretsManagerClient({ region: REGION });
    const secretResponse = await secretsClient.send(new GetSecretValueCommand({
      SecretId: SECRET_NAME
    }));
    const secretArn = secretResponse.ARN;
    console.log(`✅ Secret found: ${SECRET_NAME}`);
    console.log(`   ARN: ${secretArn}\n`);

    // Connect via RDS Data API
    const rdsClient = new RDSDataClient({ region: REGION });

    // 1. Check vendor basic info
    console.log('1. VENDOR BASIC INFO:');
    console.log('-'.repeat(80));
    const vendorQuery = `
      SELECT 
        v.id, v.business_name, v.owner_name, v.phone, v.status, v.is_active,
        v.role_id, v.category, v.vendor_type, v.latitude, v.longitude,
        r.name as role_name, r.display_name as role_display_name, r.config as role_config
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
      console.log('❌ VENDOR NOT FOUND IN PRODUCTION RDS!');
      process.exit(1);
    }
    
    const vendor = vendorResult.records[0];
    console.log(JSON.stringify({
      id: vendor[0].stringValue,
      business_name: vendor[1].stringValue,
      status: vendor[4].stringValue,
      is_active: vendor[5].booleanValue,
      role_name: vendor[11]?.stringValue,
      category: vendor[8]?.stringValue
    }, null, 2));
    console.log('');

    // 2. Check vendor services
    console.log('2. VENDOR SERVICES:');
    console.log('-'.repeat(80));
    const servicesQuery = `
      SELECT 
        vs.id, vs.service_name, vs.service_style, 
        vs.is_enabled, vs.publish_status, vs.category
      FROM vendor_services vs
      WHERE vs.vendor_id = CAST(:vendorId AS uuid)
      ORDER BY vs.created_at DESC
    `;
    
    const servicesResult = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: servicesQuery,
      parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
    }));
    
    console.log(`Found ${servicesResult.records.length} service(s):`);
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

    // 3. Check at_center services
    console.log('3. AT_CENTER SERVICES:');
    console.log('-'.repeat(80));
    const atCenterQuery = `
      SELECT COUNT(*) as count
      FROM vendor_services vs
      WHERE vs.vendor_id = CAST(:vendorId AS uuid)
        AND vs.service_style IN ('at_center', 'at_vendor', 'at_clinic', 'center', 'clinic')
        AND vs.is_enabled = true
        AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
    `;
    
    const atCenterResult = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: atCenterQuery,
      parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
    }));
    
    const atCenterCount = atCenterResult.records[0][0].longValue;
    console.log(`At Center Services: ${atCenterCount}`);
    if (atCenterCount === 0) {
      console.log('❌ NO AT_CENTER SERVICES FOUND!');
    } else {
      console.log('✅ At Center Services Found');
    }
    console.log('');

    // 4. Test the discovery query
    console.log('4. TESTING DISCOVERY QUERY:');
    console.log('-'.repeat(80));
    const discoveryQuery = `
      SELECT DISTINCT v.id, v.business_name, r.name as role_name
      FROM vendors v
      INNER JOIN roles r ON v.role_id = r.id
      INNER JOIN vendor_services vs ON vs.vendor_id = v.id
      WHERE (v.status = 'approved' OR v.status = 'active') AND v.is_active = true
        AND v.business_name IS NOT NULL AND TRIM(COALESCE(v.business_name, '')) != ''
        AND LOWER(r.name) NOT LIKE '%solo%'
        AND vs.service_style = ANY(ARRAY['at_center', 'at_vendor', 'at_clinic']::text[])
        AND vs.is_enabled = true
        AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        AND vs.service_style != 'at_home'
        AND LOWER(r.name) = ANY(ARRAY['vet_clinic', 'veterinarian', 'vet']::text[])
        AND v.id = CAST(:vendorId AS uuid)
    `;
    
    const discoveryResult = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: discoveryQuery,
      parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
    }));
    
    if (discoveryResult.records.length > 0) {
      console.log('✅ VENDOR FOUND IN DISCOVERY QUERY!');
      console.log(JSON.stringify({
        id: discoveryResult.records[0][0].stringValue,
        business_name: discoveryResult.records[0][1].stringValue,
        role_name: discoveryResult.records[0][2].stringValue
      }, null, 2));
    } else {
      console.log('❌ VENDOR NOT FOUND IN DISCOVERY QUERY!');
      console.log('   This means the vendor is being filtered out by the SQL query.');
    }
    console.log('');

    console.log('='.repeat(80));
    console.log('SUMMARY:');
    console.log('='.repeat(80));
    console.log(`✅ Vendor exists: Yes`);
    console.log(`✅ Vendor status: ${vendor[4].stringValue}, active: ${vendor[5].booleanValue}`);
    console.log(`✅ Vendor role: ${vendor[11]?.stringValue || 'N/A'}`);
    console.log(`✅ At Center Services: ${atCenterCount}`);
    console.log(`✅ In Discovery Query: ${discoveryResult.records.length > 0 ? 'Yes' : 'No'}`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkVendor().catch(console.error);
