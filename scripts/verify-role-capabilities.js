#!/usr/bin/env node
/**
 * Verify role capabilities are correctly assigned
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { execSync } = require('child_process');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

// Define expected capabilities per role
const EXPECTED_CAPABILITIES = {
  // VET ROLES
  vet_solo: {
    mustHave: ['prescription_create', 'prescriptions', 'medical_records', 'diagnostic_results', 'patient_monitoring', 'tele', 'vet_summary', 'professional_profile', 'gps_tracking', 'live_location'],
    mustNotHave: ['staff_management', 'staff_create', 'center_profile', 'facility_management', 'inventory']
  },
  vet_clinic: {
    mustHave: ['prescription_create', 'prescriptions', 'medical_records', 'diagnostic_results', 'patient_monitoring', 'staff_management', 'staff_create', 'cctv_access', 'gps_tracking', 'live_location'],
    mustNotHave: ['professional_profile']
  },
  diagnostics_center: {
    mustHave: ['diagnostic_results', 'diagnostics', 'diagnostic_lab', 'staff_management'],
    mustNotHave: ['prescription_create', 'prescriptions', 'medical_records', 'professional_profile']
  },
  
  // GROOMING ROLES
  groomer_solo: {
    mustHave: ['gallery', 'portfolio', 'professional_profile', 'bookings', 'gps_tracking', 'live_location'],
    mustNotHave: ['prescription_create', 'prescriptions', 'medical_records', 'staff_management', 'staff_create', 'patient_monitoring']
  },
  groomer_center: {
    mustHave: ['gallery', 'portfolio', 'staff_management', 'staff_create', 'facility_management', 'gps_tracking', 'live_location'],
    mustNotHave: ['prescription_create', 'prescriptions', 'medical_records', 'professional_profile', 'patient_monitoring']
  },
  
  // TRAINING ROLES
  trainer_solo: {
    mustHave: ['training_programs', 'progress_tracking', 'professional_profile', 'gps_tracking', 'live_location'],
    mustNotHave: ['prescription_create', 'medical_records', 'staff_management']
  },
  trainer_center: {
    mustHave: ['training_programs', 'progress_tracking', 'staff_management', 'gps_tracking', 'live_location'],
    mustNotHave: ['prescription_create', 'medical_records', 'professional_profile']
  },
  
  // PHARMACY
  pharmacy: {
    mustHave: ['inventory', 'catalog', 'orders', 'delivery', 'prescription_verification', 'controlled_substances', 'expiry_management', 'staff_management'],
    mustNotHave: ['prescription_create', 'medical_records', 'professional_profile']
  },
  
  // SELLER
  seller: {
    mustHave: ['inventory', 'catalog', 'orders', 'delivery', 'staff_management'],
    mustNotHave: ['prescription_create', 'prescription_verification', 'medical_records', 'controlled_substances']
  },
  
  // WALKER/SITTER
  walker: {
    mustHave: ['gps_tracking', 'live_location', 'photo_updates', 'walking', 'professional_profile'],
    mustNotHave: ['prescription_create', 'staff_management', 'inventory']
  },
  sitter: {
    mustHave: ['gps_tracking', 'live_location', 'photo_updates', 'professional_profile'],
    mustNotHave: ['prescription_create', 'staff_management', 'walking']
  },
  
  // BOARDING/RESORT/HOLIDAY
  boarding: {
    mustHave: ['rooms', 'room_management', 'cctv_access', 'occupancy_tracking', 'staff_management'],
    mustNotHave: ['prescription_create', 'professional_profile', 'events']
  },
  resort: {
    mustHave: ['rooms', 'room_management', 'cctv_access', 'events', 'staff_management'],
    mustNotHave: ['prescription_create', 'professional_profile']
  },
  
  // CAFE
  cafe: {
    mustHave: ['cafe_tables', 'table_management', 'menu', 'pax_management', 'staff_management'],
    mustNotHave: ['prescription_create', 'medical_records', 'professional_profile']
  },
  
  // NUTRITIONIST
  nutritionist: {
    mustHave: ['meal_plans', 'diet_charts', 'progress_tracking', 'tele', 'professional_profile'],
    mustNotHave: ['prescription_create', 'staff_management', 'inventory']
  },
  nutritionist_center: {
    mustHave: ['meal_plans', 'diet_charts', 'progress_tracking', 'staff_management'],
    mustNotHave: ['professional_profile']
  },
  
  // OTHERS
  ambulance: {
    mustHave: ['gps_tracking', 'live_location', 'emergency', 'emergency_protocols', 'ambulance', 'staff_management'],
    mustNotHave: ['prescription_create', 'professional_profile']
  },
  insurance: {
    mustHave: ['insurance_plans', 'policy_management', 'claims_management', 'tele', 'staff_management'],
    mustNotHave: ['prescription_create', 'professional_profile']
  },
  adoption_center: {
    mustHave: ['adoption', 'pet_profiles', 'donation', 'events', 'staff_management'],
    mustNotHave: ['prescription_create', 'professional_profile']
  },
  sunset: {
    mustHave: ['memorial', 'counseling', 'staff_management'],
    mustNotHave: ['prescription_create', 'professional_profile']
  },
  photographer: {
    mustHave: ['gallery', 'portfolio', 'professional_profile'],
    mustNotHave: ['prescription_create', 'staff_management', 'medical_records']
  }
};

async function verifyCapabilities() {
  console.log('🔍 Verifying Role Capabilities...');
  console.log('========================================\n');
  
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;
  
  const endpoint = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
    { encoding: 'utf8' }
  ).trim();
  
  const port = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Port' --output text`,
    { encoding: 'utf8' }
  ).trim() || '5432';
  
  const dbName = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].DatabaseName' --output text`,
    { encoding: 'utf8' }
  ).trim() || 'warmpawz';
  
  const username = execSync(
    `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text`,
    { encoding: 'utf8' }
  ).trim() || 'warmpawz_admin';
  
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  
  const secretValue = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  
  const secret = JSON.parse(secretValue.SecretString);
  const password = secret.password || secret.Password;
  
  const pool = new Pool({
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password: password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  
  // Get all active roles with their capabilities
  const rolesResult = await pool.query(`
    SELECT 
      r.name AS role_name,
      r.config->>'vendorConfiguration' AS vendor_config,
      array_agg(rp.permission_name) FILTER (WHERE rp.permission_name IS NOT NULL) AS capabilities
    FROM roles r
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    WHERE r.is_active = true
    GROUP BY r.id, r.name, r.config
    ORDER BY r.name
  `);
  
  let totalIssues = 0;
  let rolesChecked = 0;
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('CAPABILITY VERIFICATION RESULTS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  for (const role of rolesResult.rows) {
    const roleName = role.role_name;
    const capabilities = role.capabilities || [];
    const expected = EXPECTED_CAPABILITIES[roleName];
    
    if (!expected) {
      // console.log(`⏭️  ${roleName}: No verification rules defined`);
      continue;
    }
    
    rolesChecked++;
    const issues = [];
    
    // Check mustHave
    for (const cap of expected.mustHave) {
      if (!capabilities.includes(cap)) {
        issues.push(`MISSING: ${cap}`);
      }
    }
    
    // Check mustNotHave
    for (const cap of expected.mustNotHave) {
      if (capabilities.includes(cap)) {
        issues.push(`SHOULD NOT HAVE: ${cap}`);
      }
    }
    
    if (issues.length === 0) {
      console.log(`✅ ${roleName} (${role.vendor_config}): All capabilities correct`);
    } else {
      console.log(`❌ ${roleName} (${role.vendor_config}): ${issues.length} issues`);
      issues.forEach(issue => console.log(`   ⚠️ ${issue}`));
      totalIssues += issues.length;
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('PRESCRIPTION CHECK: Which roles have prescription capabilities?');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const prescriptionCheck = await pool.query(`
    SELECT 
      r.name AS role_name,
      r.customer_service,
      array_agg(rp.permission_name) FILTER (WHERE rp.permission_name LIKE '%prescription%') AS prescription_caps
    FROM roles r
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    WHERE r.is_active = true
    GROUP BY r.id, r.name, r.customer_service
    HAVING COUNT(*) FILTER (WHERE rp.permission_name LIKE '%prescription%') > 0
    ORDER BY r.name
  `);
  
  for (const row of prescriptionCheck.rows) {
    const isAllowed = ['vet_solo', 'vet_clinic', 'pharmacy'].includes(row.role_name);
    const status = isAllowed ? '✅' : '❌ WRONG';
    console.log(`${status} ${row.role_name}: ${row.prescription_caps.join(', ')}`);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Roles Checked: ${rolesChecked}`);
  console.log(`Total Issues: ${totalIssues}`);
  console.log(totalIssues === 0 ? '✅ All capabilities correctly assigned!' : `⚠️ ${totalIssues} issues need attention`);
  
  await pool.end();
}

verifyCapabilities().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
