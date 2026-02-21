/**
 * Check vendor in vendors table and its services
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');

const VENDOR_ID = '4fee508b-5cd7-4c2e-9252-94e4bcd99af9';
const REGION = 'ap-south-1';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';

async function checkVendor() {
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

    // Get vendor from vendors table
    console.log('1. VENDOR IN VENDORS TABLE:');
    const vendorQuery = `
      SELECT v.id, v.business_name, v.phone, v.status, v.is_active, v.vendor_type, r.name as role_name
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
      console.log('❌ Vendor not found in vendors table');
      return;
    }
    
    const vendor = vendorResult.records[0];
    console.log(JSON.stringify({
      id: vendor[0].stringValue,
      business_name: vendor[1]?.stringValue,
      phone: vendor[2]?.stringValue,
      status: vendor[3]?.stringValue,
      is_active: vendor[4]?.booleanValue,
      vendor_type: vendor[5]?.stringValue,
      role_name: vendor[6]?.stringValue
    }, null, 2));
    console.log('');

    // Get ALL services for this vendor
    console.log('2. ALL SERVICES FOR VENDOR:');
    const servicesQuery = `
      SELECT 
        vs.id, vs.service_name, vs.service_style, 
        vs.is_enabled, vs.publish_status
      FROM vendor_services vs
      WHERE vs.vendor_id = CAST(:vendorId AS uuid)
      ORDER BY vs.service_style, vs.service_name
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
      console.log(`  Name: ${s[1].stringValue}`);
      console.log(`  Style: ${s[2]?.stringValue || 'NOT SET'}`);
      console.log(`  Enabled: ${s[3].booleanValue}`);
      console.log(`  Publish Status: ${s[4]?.stringValue || 'NOT SET'}`);
    });
    
    if (servicesResult.records.length === 0) {
      console.log('\n⚠️  Vendor has NO services in vendor_services table!');
      console.log('This is why the vendor is not appearing in by-style endpoint.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkVendor().catch(console.error);
