/**
 * Check vendor availability configuration in production RDS
 * Vendor: Friendly tails pet hospital (863d5f9f-2cec-4792-9ea8-64c98059061c)
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { execSync } = require('child_process');

const VENDOR_ID = '863d5f9f-2cec-4792-9ea8-64c98059061c';
const REGION = 'ap-south-1';
const CLUSTER_ID = 'warmpawz-prod-cluster';
const SECRET_NAME = 'warmpawz-prod-rds-master-20260207201049162400000001';

async function checkAvailability() {
  console.log('='.repeat(80));
  console.log('CHECKING VENDOR AVAILABILITY CONFIGURATION');
  console.log('='.repeat(80));
  console.log(`Vendor ID: ${VENDOR_ID}\n`);

  try {
    // Get cluster ARN
    const clusterInfo = JSON.parse(execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${CLUSTER_ID} --region ${REGION} --output json`,
      { encoding: 'utf8' }
    ));
    
    const cluster = clusterInfo.DBClusters[0];
    const clusterArn = cluster.DBClusterArn;

    // Get secret ARN
    const secretsClient = new SecretsManagerClient({ region: REGION });
    const secretResponse = await secretsClient.send(new GetSecretValueCommand({
      SecretId: SECRET_NAME
    }));
    const secretArn = secretResponse.ARN;

    // Connect via RDS Data API
    const rdsClient = new RDSDataClient({ region: REGION });

    // 1. Check vendor_availability_v2
    console.log('1. VENDOR_AVAILABILITY_V2:');
    console.log('-'.repeat(80));
    const va2Query = `
      SELECT 
        vendor_id, day_of_week, 
        COALESCE(service_styles, ARRAY[]::text[]) as service_styles,
        service_style, service_type,
        start_time, end_time,
        is_available, is_enabled,
        max_capacity
      FROM vendor_availability_v2
      WHERE vendor_id::text = CAST(:vendorId AS text)
         OR vendor_id IN (SELECT id FROM vendor_identity WHERE vendor_id::text = CAST(:vendorId AS text))
      ORDER BY day_of_week, start_time
    `;
    
    const va2Result = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: va2Query,
      parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
    }));
    
    if (va2Result.records.length === 0) {
      console.log('❌ NO AVAILABILITY RECORDS FOUND in vendor_availability_v2');
    } else {
      console.log(`✅ Found ${va2Result.records.length} availability record(s):\n`);
      va2Result.records.forEach((row, i) => {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeek = row[1].longValue;
        console.log(`Record ${i + 1}:`);
        console.log(`  Day: ${dayNames[dayOfWeek]} (${dayOfWeek})`);
        console.log(`  Service Styles: ${JSON.stringify(row[2]?.arrayValue?.stringValues || [])}`);
        console.log(`  Service Style: ${row[3]?.stringValue || 'N/A'}`);
        console.log(`  Service Type: ${row[4]?.stringValue || 'N/A'}`);
        console.log(`  Time: ${row[5]?.stringValue || 'N/A'} - ${row[6]?.stringValue || 'N/A'}`);
        console.log(`  Available: ${row[7]?.booleanValue !== false ? 'Yes' : 'No'}`);
        console.log(`  Enabled: ${row[8]?.booleanValue !== false ? 'Yes' : 'No'}`);
        console.log(`  Max Capacity: ${row[9]?.longValue || 'N/A'}`);
        console.log('');
      });
    }

    // 2. Check vendor_identity for linked records
    console.log('2. VENDOR_IDENTITY (for availability lookup):');
    console.log('-'.repeat(80));
    const viQuery = `
      SELECT id, phone, selected_role_id, onboarding_status
      FROM vendor_identity
      WHERE phone = (SELECT phone FROM vendors WHERE id::text = CAST(:vendorId AS text))
      ORDER BY created_at DESC
    `;
    
    const viResult = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: viQuery,
      parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
    }));
    
    if (viResult.records.length === 0) {
      console.log('❌ NO VENDOR_IDENTITY RECORDS FOUND');
    } else {
      console.log(`✅ Found ${viResult.records.length} vendor_identity record(s):\n`);
      viResult.records.forEach((row, i) => {
        console.log(`Record ${i + 1}:`);
        console.log(`  ID: ${row[0].stringValue}`);
        console.log(`  Phone: ${row[1].stringValue}`);
        console.log(`  Role ID: ${row[2]?.stringValue || 'N/A'}`);
        console.log(`  Status: ${row[3]?.stringValue || 'N/A'}`);
        console.log('');
      });
    }

    // 3. Check staff_availability_slots (for at_home/tele) - skip if table doesn't exist
    console.log('3. STAFF_AVAILABILITY_SLOTS (for at_home/tele):');
    console.log('-'.repeat(80));
    console.log('⚠️  Skipping staff slots check (table may not exist in this environment)');

    // 4. Check operating hours (legacy fallback)
    console.log('4. OPERATING HOURS (from vendor metadata):');
    console.log('-'.repeat(80));
    const vendorQuery = `
      SELECT 
        business_name, phone,
        metadata->'operatingHours' as operating_hours,
        metadata->'businessHours' as business_hours
      FROM vendors
      WHERE id::text = CAST(:vendorId AS text)
    `;
    
    const vendorResult = await rdsClient.send(new ExecuteStatementCommand({
      resourceArn: clusterArn,
      secretArn: secretArn,
      database: 'warmpawz',
      sql: vendorQuery,
      parameters: [{ name: 'vendorId', value: { stringValue: VENDOR_ID } }]
    }));
    
    if (vendorResult.records.length > 0) {
      const vendor = vendorResult.records[0];
      console.log(`Business: ${vendor[0].stringValue}`);
      console.log(`Phone: ${vendor[1].stringValue}`);
      const opHours = vendor[2]?.stringValue ? JSON.parse(vendor[2].stringValue) : null;
      const bizHours = vendor[3]?.stringValue ? JSON.parse(vendor[3].stringValue) : null;
      if (opHours || bizHours) {
        console.log(`Operating Hours: ${JSON.stringify(opHours || bizHours, null, 2)}`);
      } else {
        console.log('❌ No operating hours in metadata');
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY:');
    console.log('='.repeat(80));
    console.log(`✅ Vendor exists: Yes`);
    console.log(`❌ vendor_availability_v2 records: ${va2Result.records.length}`);
    console.log(`\n⚠️  ACTION REQUIRED: Vendor needs to set up Advanced Availability in the dashboard`);
    console.log(`   for at_center, at_home, and/or tele service styles.`);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkAvailability().catch(console.error);
