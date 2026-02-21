/**
 * Test the EXACT query that Lambda would execute
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');

const VENDOR_ID = '1d1329e9-3241-40f2-a3ab-9b7f7108688b';
const REGION = 'ap-south-1';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';

async function testExactQuery() {
  console.log('Testing EXACT Lambda query...\n');

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

    // This is the EXACT query from Lambda with useSimplifiedQuery = true
    const query = `
      SELECT DISTINCT 
        v.id,
        v.business_name,
        v.owner_name,
        v.phone,
        v.city,
        v.state,
        v.latitude,
        v.longitude,
        r.name as role_name, r.display_name as role_display_name,
        COALESCE(v.languages, ARRAY[]::text[]) as languages,
        COALESCE(v.is_verified, false) as is_verified,
        v.profile_photo_url,
        v.profile_image,
        v.logo_url as logo_url,
        COALESCE(v.specializations, ARRAY[]::text[]) as specializations,
        COALESCE(v.is_online, true) as is_online,
        v.vendor_type,
        v.metadata,
        r.config as role_config,
        v.service_radius,
        (SELECT MIN(vs.service_radius_km) FROM vendor_services vs
         WHERE vs.vendor_id = v.id AND vs.is_enabled = true
           AND vs.service_style = 'at_home') AS service_radius_km_min_home
      FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
      WHERE (v.status = 'approved' OR v.status = 'active')
        AND v.is_active = true
        AND v.business_name IS NOT NULL AND TRIM(COALESCE(v.business_name, '')) != ''
        AND v.vendor_type = 'solo' AND LOWER(r.name) LIKE '%vet%'
        AND EXISTS (
          SELECT 1 FROM vendor_services vs
          WHERE vs.vendor_id = v.id
            AND vs.service_style IN ('tele', 'online', 'video_consultation')
            AND vs.is_enabled = true
            AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        )
      LIMIT 200
    `;

    console.log('Executing query...');
    const result = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: query
    }));

    console.log(`\nFound ${result.records.length} vendor(s):\n`);
    result.records.forEach((row, i) => {
      console.log(`Vendor ${i + 1}:`);
      console.log(`  ID: ${row[0].stringValue}`);
      console.log(`  Name: ${row[1].stringValue}`);
      console.log(`  Role: ${row[8]?.stringValue || 'N/A'}`);
      console.log(`  Type: ${row[16]?.stringValue || 'N/A'}`);
      console.log(`  Is Online: ${row[15]?.booleanValue !== false ? 'Yes' : 'No'}`);
      console.log(`  Role Config: ${row[18]?.stringValue ? 'Present' : 'NULL'}`);
      console.log('');
    });

    const vendorFound = result.records.some(r => r[0].stringValue === VENDOR_ID);
    if (vendorFound) {
      console.log('✅ VENDOR FOUND IN QUERY RESULTS!');
      
      // Check role_config
      const vendorRow = result.records.find(r => r[0].stringValue === VENDOR_ID);
      if (vendorRow && vendorRow[18]) {
        console.log('\nChecking role_config...');
        const roleConfig = JSON.parse(vendorRow[18].stringValue);
        console.log('Role config:', JSON.stringify(roleConfig, null, 2));
        console.log('Allowed service styles:', roleConfig?.allowed_service_styles || 'N/A');
      }
    } else {
      console.log('❌ VENDOR NOT FOUND IN QUERY RESULTS');
      console.log('\nDebugging why...');
      
      // Check each condition
      console.log('\n1. Checking vendor status...');
      const statusCheck = await rdsClient.send(new ExecuteStatementCommand({
        resourceArn: clusterArn,
        secretArn: secretArn,
        database: 'warmpawz',
        sql: `SELECT id, status, is_active, vendor_type FROM vendors WHERE id = CAST(:vendorId AS uuid)`,
        parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
      }));
      if (statusCheck.records.length > 0) {
        const v = statusCheck.records[0];
        console.log(`  Status: ${v[1].stringValue}, Active: ${v[2].booleanValue}, Type: ${v[3].stringValue}`);
      }
      
      console.log('\n2. Checking role...');
      const roleCheck = await rdsClient.send(new ExecuteStatementCommand({
        resourceArn: clusterArn,
        secretArn: secretArn,
        database: 'warmpawz',
        sql: `SELECT v.id, r.name FROM vendors v LEFT JOIN roles r ON v.role_id = r.id WHERE v.id = CAST(:vendorId AS uuid)`,
        parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
      }));
      if (roleCheck.records.length > 0) {
        console.log(`  Role: ${roleCheck.records[0][1]?.stringValue || 'NULL'}`);
        console.log(`  Role LIKE '%vet%': ${roleCheck.records[0][1]?.stringValue?.toLowerCase().includes('vet') ? 'YES' : 'NO'}`);
      }
      
      console.log('\n3. Checking tele services...');
      const servicesCheck = await rdsClient.send(new ExecuteStatementCommand({
        resourceArn: clusterArn,
        secretArn: secretArn,
        database: 'warmpawz',
        sql: `SELECT COUNT(*) FROM vendor_services WHERE vendor_id = CAST(:vendorId AS uuid) AND service_style IN ('tele', 'online', 'video_consultation') AND is_enabled = true AND (publish_status IN ('published','auto_published') OR publish_status IS NULL)`,
        parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
      }));
      console.log(`  Tele services: ${servicesCheck.records[0][0].longValue}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

testExactQuery().catch(console.error);
