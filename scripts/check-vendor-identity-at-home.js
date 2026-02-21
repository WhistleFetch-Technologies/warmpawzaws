/**
 * Check vendor_identity vendor for at_home services
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');

const VENDOR_ID = '4fee508b-5cd7-4c2e-9252-94e4bcd99af9';
const REGION = 'ap-south-1';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';

async function checkVendor() {
  console.log('Checking vendor_identity vendor for at_home services...\n');

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

    // 1. Check vendor_identity
    console.log('1. VENDOR_IDENTITY:');
    const viQuery = `
      SELECT id, phone, selected_role_id, onboarding_status, vendor_type, full_name, metadata
      FROM vendor_identity
      WHERE id = CAST(:vendorId AS uuid)
    `;
    
    const viResult = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: viQuery,
      parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
    }));
    
    if (viResult.records.length === 0) {
      console.log('❌ VENDOR NOT FOUND IN VENDOR_IDENTITY');
      return;
    }
    
    const vi = viResult.records[0];
    const metadata = vi[6]?.stringValue ? JSON.parse(vi[6].stringValue) : {};
    console.log(JSON.stringify({
      id: vi[0].stringValue,
      phone: vi[1].stringValue,
      role_id: vi[2]?.stringValue,
      status: vi[3]?.stringValue,
      vendor_type: vi[4]?.stringValue,
      full_name: vi[5]?.stringValue,
      business_name: metadata.businessName || metadata.business_name || null
    }, null, 2));
    console.log('');

    // 2. Check role
    console.log('2. ROLE:');
    const roleQuery = `
      SELECT r.name, r.display_name, r.config
      FROM roles r
      WHERE r.id = CAST(:roleId AS uuid)
    `;
    
    const roleResult = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: roleQuery,
      parameters: [{ name: 'roleId', value: { stringValue: vi[2].stringValue } }]
    }));
    
    if (roleResult.records.length > 0) {
      console.log(`Role: ${roleResult.records[0][0].stringValue} (${roleResult.records[0][1]?.stringValue})`);
    }
    console.log('');

    // 3. Check at_home services
    console.log('3. AT_HOME SERVICES:');
    const servicesQuery = `
      SELECT 
        vs.id, vs.service_name, vs.service_style, 
        vs.is_enabled, vs.publish_status, vs.vendor_id
      FROM vendor_services vs
      WHERE vs.vendor_id::text = :vendorId
        AND vs.service_style IN ('at_home', 'home_visit')
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
    
    console.log(`Found ${servicesResult.records.length} at_home service(s):`);
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

    // 4. Test the exact query from by-style endpoint
    console.log('4. TESTING BY-STYLE QUERY:');
    const targetRoles = ['veterinarian', 'Veterinarian', 'vet', 'vet_clinic', 'vet_solo', 'Veterinarian (Solo)', 'Vet Solo', 'Veterinary Clinic'];
    const targetRolesLower = targetRoles.map(r => r.toLowerCase());
    const acceptableStyles = ['at_home', 'home_visit'];
    
    const byStyleQuery = `
      SELECT DISTINCT
        vi.id as vendor_id,
        COALESCE(vi.metadata->>'businessName', vi.metadata->>'business_name', vi.full_name) as business_name,
        vi.full_name as owner_name,
        vi.phone,
        r.name as role_name,
        r.display_name as role_display_name
      FROM vendor_identity vi
      LEFT JOIN roles r ON vi.selected_role_id = r.id
      WHERE vi.onboarding_status IN ('APPROVED', 'ACTIVATED')
        AND (vi.vendor_type = 'solo' OR vi.vendor_type IS NULL)
        AND NOT EXISTS (SELECT 1 FROM vendors v WHERE v.id = vi.id OR v.phone = vi.phone)
        AND COALESCE(vi.metadata->>'businessName', vi.metadata->>'business_name', vi.full_name) IS NOT NULL
        AND TRIM(COALESCE(vi.metadata->>'businessName', vi.metadata->>'business_name', vi.full_name, '')) != ''
        AND EXISTS (
          SELECT 1 FROM vendor_services vs
          WHERE vs.vendor_id::text = vi.id::text
            AND vs.service_style = ANY(ARRAY['at_home', 'home_visit']::text[])
            AND vs.is_enabled = true
            AND (vs.publish_status IN ('published','auto_published') OR vs.publish_status IS NULL)
        )
        AND (
          LOWER(r.name) = ANY(ARRAY['veterinarian', 'veterinarian', 'vet', 'vet_clinic', 'vet_solo', 'veterinarian (solo)', 'vet solo', 'veterinary clinic']::text[])
          OR LOWER(r.display_name) = ANY(ARRAY['veterinarian', 'veterinarian', 'vet', 'vet_clinic', 'vet_solo', 'veterinarian (solo)', 'vet solo', 'veterinary clinic']::text[])
        )
      LIMIT 100
    `;
    
    const byStyleResult = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: byStyleQuery
    }));
    
    console.log(`Found ${byStyleResult.records.length} vendor(s) in by-style query:`);
    byStyleResult.records.forEach((row, i) => {
      console.log(`\nVendor ${i + 1}:`);
      console.log(`  ID: ${row[0].stringValue}`);
      console.log(`  Name: ${row[1].stringValue}`);
      console.log(`  Role: ${row[4]?.stringValue || 'N/A'}`);
    });
    
    const vendorFound = byStyleResult.records.some(r => r[0].stringValue === VENDOR_ID);
    if (vendorFound) {
      console.log('\n✅ VENDOR FOUND IN BY-STYLE QUERY!');
    } else {
      console.log('\n❌ VENDOR NOT FOUND IN BY-STYLE QUERY');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

checkVendor().catch(console.error);
