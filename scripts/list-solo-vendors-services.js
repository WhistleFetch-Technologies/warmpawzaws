#!/usr/bin/env node
/**
 * List Solo Vendors and Their Enabled Services
 * Uses AWS RDS Data API to query the database
 */

const { RDSDataClient, ExecuteStatementCommand } = require('@aws-sdk/client-rds-data');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const REGION = process.env.AWS_REGION || 'ap-south-1';
// Update these ARNs with your actual RDS cluster and Secrets Manager ARNs
// You can also set them via environment variables: DB_CLUSTER_ARN and DB_SECRET_ARN
const DB_CLUSTER_ARN = process.env.DB_CLUSTER_ARN || 'arn:aws:rds:ap-south-1:YOUR_ACCOUNT:cluster:warmpawz-dev-db';
const SECRET_ARN = process.env.DB_SECRET_ARN || 'arn:aws:secretsmanager:ap-south-1:YOUR_ACCOUNT:secret:warmpawz-dev-db-secret';

const rdsClient = new RDSDataClient({ region: REGION });
const secretsClient = new SecretsManagerClient({ region: REGION });

async function getDbCredentials() {
  try {
    const response = await secretsClient.send(new GetSecretValueCommand({ SecretId: SECRET_ARN }));
    return JSON.parse(response.SecretString);
  } catch (error) {
    console.error('Error fetching DB credentials:', error);
    throw error;
  }
}

function convertRDSField(field) {
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.longValue !== undefined) return field.longValue;
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.isNull) return null;
  return null;
}

async function executeQuery(sql, parameters = []) {
  const credentials = await getDbCredentials();
  
  const command = new ExecuteStatementCommand({
    resourceArn: DB_CLUSTER_ARN,
    secretArn: SECRET_ARN,
    database: credentials.dbname || 'warmpawz_dev',
    sql,
    parameters: parameters.map(p => ({ value: { stringValue: String(p) } })),
  });

  const response = await rdsClient.send(command);
  const rows = [];
  
  if (response.records) {
    response.records.forEach(record => {
      const row = {};
      record.forEach((field, index) => {
        const columnName = response.columnMetadata[index].name;
        row[columnName] = convertRDSField(field);
      });
      rows.push(row);
    });
  }
  
  return rows;
}

async function listSoloVendorsServices() {
  console.log('📊 Fetching solo vendors and their enabled services from RDS...\n');

  try {
    const query = `
      SELECT 
        v.id as vendor_id,
        v.business_name,
        v.owner_name,
        v.phone,
        v.email,
        v.status as vendor_status,
        v.is_active,
        vi.vendor_type,
        r.name as role_name,
        r.display_name as role_display_name,
        vs.service_id,
        s.name as service_name,
        s.category as service_category,
        vs.service_style,
        vs.is_enabled,
        vs.custom_price,
        vs.custom_duration,
        vs.publish_status,
        vs.created_at as service_enabled_at
      FROM vendors v
      LEFT JOIN vendor_identity vi ON v.id = vi.vendor_id
      LEFT JOIN roles r ON vi.selected_role_id = r.id
      INNER JOIN vendor_services vs ON v.id = vs.vendor_id
      LEFT JOIN service_catalog s ON vs.service_id = s.id
      WHERE 
        (vi.vendor_type = 'solo' OR v.vendor_configuration = 'solo')
        AND vs.is_enabled = true
      ORDER BY 
        v.business_name, 
        vs.service_style,
        s.name;
    `;

    const rows = await executeQuery(query);

    if (rows.length === 0) {
      console.log('❌ No solo vendors with enabled services found.\n');
      return;
    }

    console.log(`✅ Found ${rows.length} enabled services for solo vendors:\n`);
    console.log('═'.repeat(120));
    
    // Group by vendor
    const vendorsMap = new Map();
    rows.forEach(row => {
      const vendorId = row.vendor_id;
      if (!vendorsMap.has(vendorId)) {
        vendorsMap.set(vendorId, {
          vendor_id: vendorId,
          business_name: row.business_name || 'N/A',
          owner_name: row.owner_name || 'N/A',
          phone: row.phone || 'N/A',
          email: row.email || 'N/A',
          vendor_status: row.vendor_status || 'N/A',
          vendor_type: row.vendor_type || 'N/A',
          role_name: row.role_name || 'N/A',
          role_display_name: row.role_display_name || 'N/A',
          services: []
        });
      }
      vendorsMap.get(vendorId).services.push({
        service_id: row.service_id,
        service_name: row.service_name || 'N/A',
        service_category: row.service_category || 'N/A',
        service_style: row.service_style || 'N/A',
        is_enabled: row.is_enabled,
        custom_price: row.custom_price,
        custom_duration: row.custom_duration,
        publish_status: row.publish_status || 'N/A',
        service_enabled_at: row.service_enabled_at
      });
    });

    // Display results
    let vendorIndex = 1;
    vendorsMap.forEach((vendor, vendorId) => {
      console.log(`\n${vendorIndex}. VENDOR: ${vendor.business_name} (${vendor.owner_name})`);
      console.log(`   ID: ${vendor.vendor_id}`);
      console.log(`   Phone: ${vendor.phone} | Email: ${vendor.email}`);
      console.log(`   Status: ${vendor.vendor_status} | Type: ${vendor.vendor_type}`);
      console.log(`   Role: ${vendor.role_display_name} (${vendor.role_name})`);
      console.log(`   Enabled Services: ${vendor.services.length}`);
      console.log('   ' + '─'.repeat(110));
      
      // Group services by style
      const servicesByStyle = new Map();
      vendor.services.forEach(service => {
        const style = service.service_style || 'unknown';
        if (!servicesByStyle.has(style)) {
          servicesByStyle.set(style, []);
        }
        servicesByStyle.get(style).push(service);
      });

      servicesByStyle.forEach((services, style) => {
        console.log(`\n   📋 Service Style: ${style.toUpperCase()} (${services.length} service(s))`);
        services.forEach((service, idx) => {
          console.log(`      ${idx + 1}. ${service.service_name}`);
          console.log(`         Category: ${service.service_category}`);
          console.log(`         Price: ${service.custom_price ? `₹${service.custom_price}` : 'Default'}`);
          console.log(`         Duration: ${service.custom_duration ? `${service.custom_duration} min` : 'Default'}`);
          console.log(`         Status: ${service.publish_status} | Enabled: ${service.is_enabled}`);
          console.log(`         Service ID: ${service.service_id}`);
        });
      });
      
      console.log('   ' + '─'.repeat(110));
      vendorIndex++;
    });

    console.log(`\n\n📊 SUMMARY:`);
    console.log(`   Total Solo Vendors: ${vendorsMap.size}`);
    console.log(`   Total Enabled Services: ${rows.length}`);
    
    // Count by service style
    const styleCounts = new Map();
    rows.forEach(row => {
      const style = row.service_style || 'unknown';
      styleCounts.set(style, (styleCounts.get(style) || 0) + 1);
    });
    
    console.log(`\n   Services by Style:`);
    styleCounts.forEach((count, style) => {
      console.log(`      ${style}: ${count} service(s)`);
    });

  } catch (error) {
    console.error('❌ Error executing query:', error);
    console.error('\n💡 Make sure you have:');
    console.error('   1. AWS credentials configured');
    console.error('   2. DB_CLUSTER_ARN and DB_SECRET_ARN environment variables set (or defaults will be used)');
    console.error('   3. Proper IAM permissions to access RDS Data API');
  }
}

listSoloVendorsServices();
