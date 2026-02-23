/**
 * Check vendor_services with different vendor_id formats
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');

const VENDOR_ID = '4fee508b-5cd7-4c2e-9252-94e4bcd99af9';
const REGION = 'ap-south-1';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';

async function checkServices() {
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

    // Check vendor_identity
    console.log('1. VENDOR_IDENTITY:');
    const viQuery = `
      SELECT id, phone, selected_role_id, onboarding_status, vendor_type
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
      console.log('❌ Vendor not found in vendor_identity');
      return;
    }
    
    console.log(`✅ Vendor found: ${viResult.records[0][0].stringValue}`);
    console.log('');

    // Check ALL vendor_services with this vendor_id (as UUID)
    console.log('2. VENDOR_SERVICES (vendor_id as UUID):');
    const servicesQuery1 = `
      SELECT 
        vs.id, vs.service_name, vs.service_style, 
        vs.is_enabled, vs.publish_status, vs.vendor_id
      FROM vendor_services vs
      WHERE vs.vendor_id = CAST(:vendorId AS uuid)
      ORDER BY vs.service_style, vs.service_name
    `;
    
    const servicesResult1 = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: servicesQuery1,
      parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
    }));
    
    console.log(`Found ${servicesResult1.records.length} service(s) with vendor_id as UUID`);
    servicesResult1.records.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s[1].stringValue} (${s[2]?.stringValue || 'N/A'}) - ${s[4]?.stringValue || 'N/A'}`);
    });
    console.log('');

    // Check ALL vendor_services with this vendor_id (as TEXT)
    console.log('3. VENDOR_SERVICES (vendor_id as TEXT):');
    const servicesQuery2 = `
      SELECT 
        vs.id, vs.service_name, vs.service_style, 
        vs.is_enabled, vs.publish_status, vs.vendor_id
      FROM vendor_services vs
      WHERE vs.vendor_id::text = :vendorId
      ORDER BY vs.service_style, vs.service_name
    `;
    
    const servicesResult2 = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: servicesQuery2,
      parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
    }));
    
    console.log(`Found ${servicesResult2.records.length} service(s) with vendor_id as TEXT`);
    servicesResult2.records.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s[1].stringValue} (${s[2]?.stringValue || 'N/A'}) - ${s[4]?.stringValue || 'N/A'}`);
    });
    console.log('');

    // Check if vendor exists in vendors table
    console.log('4. CHECKING VENDORS TABLE:');
    const vendorsQuery = `
      SELECT id, business_name, phone FROM vendors WHERE id = CAST(:vendorId AS uuid) OR phone = (SELECT phone FROM vendor_identity WHERE id = CAST(:vendorId AS uuid))
    `;
    
    const vendorsResult = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: vendorsQuery,
      parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
    }));
    
    console.log(`Found ${vendorsResult.records.length} vendor(s) in vendors table`);
    if (vendorsResult.records.length > 0) {
      console.log(`  Vendor: ${vendorsResult.records[0][1]?.stringValue || 'N/A'}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkServices().catch(console.error);
