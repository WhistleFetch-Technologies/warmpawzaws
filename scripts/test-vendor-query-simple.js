/**
 * Test a simplified query to see if vendor matches
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');

const VENDOR_ID = '1d1329e9-3241-40f2-a3ab-9b7f7108688b';
const REGION = 'ap-south-1';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';

async function testQuery() {
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

    // Test 1: Basic vendor check
    console.log('Test 1: Basic vendor check');
    const test1 = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: `
        SELECT v.id, v.business_name, v.status, v.is_active, v.vendor_type, r.name as role_name
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE v.id = CAST(:vendorId AS uuid)
      `,
      parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
    }));
    console.log(`Found: ${test1.records.length}`);
    if (test1.records.length > 0) {
      console.log(`  Role: ${test1.records[0][5]?.stringValue}`);
    }
    console.log('');

    // Test 2: Check if role matches vet
    console.log('Test 2: Role matches vet?');
    const test2 = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: `
        SELECT v.id, r.name as role_name
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE v.id = CAST(:vendorId AS uuid)
          AND (LOWER(r.name) LIKE '%vet%' OR LOWER(r.name) = ANY(ARRAY['vet_solo', 'vet_clinic', 'veterinarian', 'vet']::text[]))
      `,
      parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
    }));
    console.log(`Found: ${test2.records.length}`);
    console.log('');

    // Test 3: Check availability array overlap
    console.log('Test 3: Availability array overlap');
    const test3 = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: `
        SELECT COUNT(*) as count
        FROM vendor_availability_v2 va
        WHERE va.vendor_id = CAST(:vendorId AS uuid)
          AND (va.is_available IS NULL OR va.is_available = true)
          AND (COALESCE(va.service_styles, ARRAY[]::text[]) && ARRAY['tele', 'online', 'video_consultation']::text[])
      `,
      parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
    }));
    console.log(`Availability records: ${test3.records[0][0].longValue}`);
    console.log('');

    // Test 4: Check services
    console.log('Test 4: Tele services');
    const test4 = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: `
        SELECT COUNT(*) as count
        FROM vendor_services vs
        WHERE vs.vendor_id = CAST(:vendorId AS uuid)
          AND vs.service_style = ANY(ARRAY['tele', 'online', 'video_consultation']::text[])
          AND vs.is_enabled = true
          AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
      `,
      parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
    }));
    console.log(`Tele services: ${test4.records[0][0].longValue}`);
    console.log('');

    // Test 5: Combined query (simplified)
    console.log('Test 5: Combined query');
    const test5 = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: `
        SELECT v.id, v.business_name, r.name as role_name
        FROM vendors v
        LEFT JOIN roles r ON v.role_id = r.id
        WHERE (v.status = 'approved' OR v.status = 'active')
          AND v.is_active = true
          AND v.business_name IS NOT NULL
          AND v.vendor_type = 'solo'
          AND LOWER(r.name) LIKE '%vet%'
          AND EXISTS (
            SELECT 1 FROM vendor_services vs
            WHERE vs.vendor_id = v.id
              AND vs.service_style IN ('tele', 'online', 'video_consultation')
              AND vs.is_enabled = true
              AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
          )
          AND v.id = CAST(:vendorId AS uuid)
      `,
      parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
    }));
    console.log(`Found: ${test5.records.length}`);
    if (test5.records.length > 0) {
      console.log(`  ✅ VENDOR MATCHES SIMPLIFIED QUERY!`);
    } else {
      console.log(`  ❌ Vendor does not match simplified query`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testQuery().catch(console.error);
