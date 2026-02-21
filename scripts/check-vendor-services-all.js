/**
 * Check all services for vendor_identity vendor
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

    // Check ALL services for this vendor
    const servicesQuery = `
      SELECT 
        vs.id, vs.service_name, vs.service_style, 
        vs.is_enabled, vs.publish_status, vs.vendor_id
      FROM vendor_services vs
      WHERE vs.vendor_id::text = :vendorId
      ORDER BY vs.service_style, vs.service_name
    `;
    
    const servicesResult = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: servicesQuery,
      parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
    }));
    
    console.log(`Found ${servicesResult.records.length} service(s) for vendor:\n`);
    servicesResult.records.forEach((s, i) => {
      console.log(`Service ${i + 1}:`);
      console.log(`  Name: ${s[1].stringValue}`);
      console.log(`  Style: ${s[2]?.stringValue || 'NOT SET'}`);
      console.log(`  Enabled: ${s[3].booleanValue}`);
      console.log(`  Publish Status: ${s[4]?.stringValue || 'NOT SET'}`);
      console.log('');
    });
    
    const atHomeServices = servicesResult.records.filter(s => 
      (s[2]?.stringValue === 'at_home' || s[2]?.stringValue === 'home_visit') &&
      s[3].booleanValue === true &&
      (s[4]?.stringValue === 'published' || s[4]?.stringValue === 'auto_published' || s[4]?.stringValue === null)
    );
    
    console.log(`\nAt_home services (enabled & published): ${atHomeServices.length}`);
    if (atHomeServices.length === 0) {
      console.log('⚠️  Vendor has NO at_home services!');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkServices().catch(console.error);
