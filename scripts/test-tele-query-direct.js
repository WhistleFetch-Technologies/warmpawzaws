/**
 * Test the tele discovery query directly against production RDS
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');

const VENDOR_ID = '1d1329e9-3241-40f2-a3ab-9b7f7108688b';
const REGION = 'ap-south-1';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';

async function testQuery() {
  console.log('Testing tele discovery query directly...\n');

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

    // Test the actual query
    const targetRoles = ['vet_solo', 'vet_clinic', 'veterinarian', 'vet'];
    const targetRolesLower = targetRoles.map(r => r.toLowerCase());
    const acceptableStyles = ['tele', 'online', 'video_consultation'];
    const vendorParams = [targetRolesLower, acceptableStyles];
    const styleParamIndex = '2';

    const query = `
      SELECT DISTINCT 
        v.id,
        v.business_name,
        v.owner_name,
        v.phone,
        v.vendor_type,
        r.name as role_name
      FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
      WHERE (v.status = 'approved' OR v.status = 'active')
        AND v.is_active = true
        AND v.business_name IS NOT NULL AND TRIM(COALESCE(v.business_name, '')) != ''
        AND EXISTS (
          SELECT 1 FROM vendor_availability_v2 va
          WHERE (va.vendor_id::text = v.id::text 
                 OR va.vendor_id IN (SELECT id FROM vendor_identity WHERE phone = v.phone))
            AND (va.is_available IS NULL OR va.is_available = true)
            AND (COALESCE(va.service_styles, ARRAY[]::text[]) && $${styleParamIndex}::text[])
        )
        AND (
          v.vendor_type = 'solo'
          OR LOWER(COALESCE(r.name, '')) LIKE '%_solo%'
          OR LOWER(COALESCE(r.name, '')) LIKE '%solo%'
        )
        AND r.id IS NOT NULL AND (LOWER(r.name) = ANY($1::text[]) OR LOWER(REPLACE(COALESCE(r.name, ''), ' ', '_')) = ANY($1::text[]))
        AND EXISTS (
          SELECT 1 FROM vendor_services vs
          WHERE vs.vendor_id = v.id
            AND vs.service_style = ANY($${styleParamIndex}::text[])
            AND vs.is_enabled = true
            AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        )
      LIMIT 200
    `;

    console.log('Executing query with params:', JSON.stringify(vendorParams));
    const result = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: query,
      parameters: [
        { name: '1', value: { arrayValue: { stringValues: targetRolesLower } } },
        { name: '2', value: { arrayValue: { stringValues: acceptableStyles } } }
      ]
    }));

    console.log(`\nFound ${result.records.length} vendor(s):\n`);
    result.records.forEach((row, i) => {
      console.log(`Vendor ${i + 1}:`);
      console.log(`  ID: ${row[0].stringValue}`);
      console.log(`  Name: ${row[1].stringValue}`);
      console.log(`  Role: ${row[5]?.stringValue || 'N/A'}`);
      console.log(`  Type: ${row[4]?.stringValue || 'N/A'}`);
      console.log('');
    });

    const vendorFound = result.records.some(r => r[0].stringValue === VENDOR_ID);
    if (vendorFound) {
      console.log('✅ VENDOR FOUND IN QUERY RESULTS!');
    } else {
      console.log('❌ VENDOR NOT FOUND IN QUERY RESULTS');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

testQuery().catch(console.error);
