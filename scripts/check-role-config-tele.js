/**
 * Check role_config for vet_solo to see if it allows tele
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');

const VENDOR_ID = '1d1329e9-3241-40f2-a3ab-9b7f7108688b';
const REGION = 'ap-south-1';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';

async function checkRoleConfig() {
  console.log('Checking role_config for vendor...\n');

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

    // Get role_config
    const query = `
      SELECT r.config as role_config, r.name as role_name
      FROM vendors v
      LEFT JOIN roles r ON v.role_id = r.id
      WHERE v.id = CAST(:vendorId AS uuid)
    `;
    
    const result = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: query,
      parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
    }));

    if (result.records.length > 0) {
      const roleConfig = result.records[0][0]?.stringValue;
      const roleName = result.records[0][1]?.stringValue;
      
      console.log(`Role: ${roleName}`);
      console.log(`Role Config: ${roleConfig || 'NULL'}`);
      
      if (roleConfig) {
        try {
          const config = JSON.parse(roleConfig);
          console.log('\nParsed Config:');
          console.log(JSON.stringify(config, null, 2));
          
          const allowedStyles = config.allowed_service_styles || [];
          console.log(`\nAllowed Service Styles: ${JSON.stringify(allowedStyles)}`);
          console.log(`Tele in allowed styles: ${allowedStyles.includes('tele') || allowedStyles.includes('online') || allowedStyles.includes('video_consultation')}`);
          
          // Check if tele is explicitly blocked
          const blockedStyles = config.blocked_service_styles || [];
          console.log(`Blocked Service Styles: ${JSON.stringify(blockedStyles)}`);
          console.log(`Tele in blocked styles: ${blockedStyles.includes('tele') || blockedStyles.includes('online') || blockedStyles.includes('video_consultation')}`);
        } catch (e) {
          console.log('Error parsing role_config:', e.message);
        }
      } else {
        console.log('\n⚠️  role_config is NULL - this might cause filtering!');
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkRoleConfig().catch(console.error);
