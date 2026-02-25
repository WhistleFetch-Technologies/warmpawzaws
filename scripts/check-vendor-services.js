const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');

(async () => {
  const REGION = 'ap-south-1';
  const clusterInfo = JSON.parse(execSync(
    `aws rds describe-db-clusters --db-cluster-identifier warmpawz-prod-cluster --region ${REGION} --output json`,
    { encoding: 'utf8' }
  ));
  const CLUSTER_ARN = clusterInfo.DBClusters[0].DBClusterArn;
  const DB_NAME = clusterInfo.DBClusters[0].DatabaseName || 'warmpawz';
  const describeSecret = JSON.parse(execSync(
    `aws secretsmanager describe-secret --secret-id "warmpawz-prod-rds-master-20260207201049162400000001" --region ${REGION} --output json`,
    { encoding: 'utf8' }
  ));
  const SECRET_ARN = describeSecret.ARN;
  const client = new RDSDataClient({ region: REGION });

  async function qSelect(sql) {
    const r = await client.send(new ExecuteStatementCommand({
      resourceArn: CLUSTER_ARN, secretArn: SECRET_ARN, database: DB_NAME,
      sql, includeResultMetadata: true
    }));
    const cols = r.columnMetadata.map(c => c.name);
    return r.records.map(row => {
      const obj = {};
      row.forEach((v, i) => {
        if (v.stringValue !== undefined) obj[cols[i]] = v.stringValue;
        else if (v.longValue !== undefined) obj[cols[i]] = v.longValue;
        else if (v.booleanValue !== undefined) obj[cols[i]] = v.booleanValue;
        else if (v.isNull) obj[cols[i]] = null;
        else obj[cols[i]] = JSON.stringify(v);
      });
      return obj;
    });
  }

  console.log('=== Vendor services for "Veterinarian" business ===');
  const services = await qSelect(`
    SELECT 
      v.id, v.business_name, v.vendor_type, v.status, v.is_active,
      vs.service_name, vs.service_style, vs.is_enabled, vs.publish_status
    FROM vendors v
    JOIN vendor_services vs ON vs.vendor_id = v.id
    WHERE v.business_name = 'Veterinarian' AND v.vendor_type = 'business'
    ORDER BY vs.service_name
  `);
  console.log(`Found ${services.length} services:`);
  services.forEach(s => {
    console.log(`  Service: ${s.service_name} | style: ${s.service_style} | enabled: ${s.is_enabled} | publish: ${s.publish_status}`);
  });
})().catch(console.error);
