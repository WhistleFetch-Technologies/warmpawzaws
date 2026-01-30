#!/usr/bin/env node
/**
 * Seed KYC Fields Directly to Database
 * This script directly populates the onboarding_forms table with KYC fields
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

// KYC Sections definition
const KYC_SECTIONS = [
  { id: 'basic', name: 'Basic Information', order: 1 },
  { id: 'identity_verification', name: 'Identity Verification', order: 2 },
  { id: 'professional', name: 'Professional Details', order: 3 },
  { id: 'business_registration', name: 'Business Registration', order: 4 },
  { id: 'documents', name: 'Documents', order: 5 },
  { id: 'declarations', name: 'Declarations & Consent', order: 6 },
  { id: 'location', name: 'Location & Service Area', order: 7 },
  { id: 'banking', name: 'Banking Details', order: 8 },
];

// Universal KYC Fields (for all roles)
const UNIVERSAL_KYC_FIELDS = [
  {
    id: 'aadhaarNumber',
    fieldName: 'aadhaarNumber',
    label: 'Aadhaar Number',
    type: 'aadhaar-otp',
    section: 'identity_verification',
    required: true,
    isMandatory: true,
    placeholder: 'Enter 12-digit Aadhaar number',
    helpText: 'Your Aadhaar number will be verified via OTP sent to your registered mobile',
    displayOrder: 1,
  },
  {
    id: 'panNumber',
    fieldName: 'panNumber',
    label: 'PAN Number',
    type: 'pan-verify',
    section: 'identity_verification',
    required: true,
    isMandatory: true,
    placeholder: 'ABCDE1234F',
    helpText: 'PAN will be verified automatically',
    displayOrder: 2,
  },
  {
    id: 'profilePhoto',
    fieldName: 'profilePhoto',
    label: 'Profile Photo',
    type: 'file',
    section: 'documents',
    required: true,
    isMandatory: true,
    helpText: 'Clear photo of your face (passport size)',
    displayOrder: 10,
  },
];

// Doorstep service fields (for walkers, groomers, trainers)
const DOORSTEP_SERVICE_FIELDS = [
  {
    id: 'policeVerificationDoc',
    fieldName: 'policeVerificationDoc',
    label: 'Police Verification Certificate',
    type: 'file',
    section: 'documents',
    required: false,
    isMandatory: false,
    softBlock: true,
    helpText: 'Police verification certificate (if available)',
    displayOrder: 11,
  },
  {
    id: 'noCriminalRecordDeclaration',
    fieldName: 'noCriminalRecordDeclaration',
    label: 'No Criminal Record Declaration',
    type: 'declaration',
    section: 'declarations',
    required: true,
    isMandatory: true,
    declarationText: 'I hereby declare that I have no criminal record and have not been convicted of any offense.',
    displayOrder: 20,
  },
];

// Business registration fields
const BUSINESS_REGISTRATION_FIELDS = [
  {
    id: 'gstNumber',
    fieldName: 'gstNumber',
    label: 'GST Number',
    type: 'gst-verify',
    section: 'business_registration',
    required: false,
    isMandatory: false,
    placeholder: 'Enter GST number',
    helpText: 'Optional - GST will be auto-verified if provided',
    displayOrder: 5,
  },
  {
    id: 'shopActLicenseNumber',
    fieldName: 'shopActLicenseNumber',
    label: 'Shop Act License Number',
    type: 'text',
    section: 'business_registration',
    required: false,
    isMandatory: false,
    placeholder: 'Enter license number',
    displayOrder: 6,
  },
];

// Veterinarian specific fields
const VET_FIELDS = [
  {
    id: 'vciRegistrationNumber',
    fieldName: 'vciRegistrationNumber',
    label: 'VCI Registration Number',
    type: 'text',
    section: 'professional',
    required: true,
    isMandatory: true,
    placeholder: 'Enter VCI registration number',
    helpText: 'Veterinary Council of India registration',
    displayOrder: 3,
  },
  {
    id: 'stateCouncilRegistration',
    fieldName: 'stateCouncilRegistration',
    label: 'State Council Registration',
    type: 'text',
    section: 'professional',
    required: true,
    isMandatory: true,
    placeholder: 'Enter state council registration',
    displayOrder: 4,
  },
  {
    id: 'degreeDoc',
    fieldName: 'degreeDoc',
    label: 'Veterinary Degree Certificate',
    type: 'file',
    section: 'documents',
    required: true,
    isMandatory: true,
    helpText: 'Upload your BVSc/MVSc degree certificate',
    displayOrder: 12,
  },
];

// Breeder specific fields
const BREEDER_FIELDS = [
  {
    id: 'awbiRegistration',
    fieldName: 'awbiRegistration',
    label: 'AWBI Registration Number',
    type: 'text',
    section: 'professional',
    required: true,
    isMandatory: true,
    placeholder: 'Enter AWBI registration',
    helpText: 'Animal Welfare Board of India registration',
    displayOrder: 3,
  },
  {
    id: 'breedingLimitsDeclaration',
    fieldName: 'breedingLimitsDeclaration',
    label: 'Ethical Breeding Limits Declaration',
    type: 'declaration',
    section: 'declarations',
    required: true,
    isMandatory: true,
    declarationText: 'I agree to follow ethical breeding limits as per platform guidelines and AWBI recommendations.',
    displayOrder: 21,
  },
  {
    id: 'noThirdPartySalesDeclaration',
    fieldName: 'noThirdPartySalesDeclaration',
    label: 'No Third-Party Sales Declaration',
    type: 'declaration',
    section: 'declarations',
    required: true,
    isMandatory: true,
    declarationText: 'I declare that I will not engage in third-party reselling or brokering of pets.',
    displayOrder: 22,
  },
];

// Role to KYC fields mapping
const ROLE_KYC_MAPPING = {
  'pet_walker': {
    fields: [...UNIVERSAL_KYC_FIELDS, ...DOORSTEP_SERVICE_FIELDS],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'documents', 'declarations', 'location', 'banking'].includes(s.id)),
  },
  'walker': {
    fields: [...UNIVERSAL_KYC_FIELDS, ...DOORSTEP_SERVICE_FIELDS],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'documents', 'declarations', 'location', 'banking'].includes(s.id)),
  },
  'pet_groomer': {
    fields: [...UNIVERSAL_KYC_FIELDS, ...DOORSTEP_SERVICE_FIELDS],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'documents', 'declarations', 'location', 'banking'].includes(s.id)),
  },
  'groomer_solo': {
    fields: [...UNIVERSAL_KYC_FIELDS, ...DOORSTEP_SERVICE_FIELDS],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'documents', 'declarations', 'location', 'banking'].includes(s.id)),
  },
  'groomer_center': {
    fields: [...UNIVERSAL_KYC_FIELDS, ...BUSINESS_REGISTRATION_FIELDS],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'business_registration', 'documents', 'location', 'banking'].includes(s.id)),
  },
  'veterinarian': {
    fields: [...UNIVERSAL_KYC_FIELDS, ...VET_FIELDS],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'professional', 'documents', 'location', 'banking'].includes(s.id)),
  },
  'vet_solo': {
    fields: [...UNIVERSAL_KYC_FIELDS, ...VET_FIELDS],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'professional', 'documents', 'location', 'banking'].includes(s.id)),
  },
  'vet_clinic': {
    fields: [...UNIVERSAL_KYC_FIELDS, ...VET_FIELDS, ...BUSINESS_REGISTRATION_FIELDS],
    sections: KYC_SECTIONS,
  },
  'pet_trainer': {
    fields: [...UNIVERSAL_KYC_FIELDS, ...DOORSTEP_SERVICE_FIELDS],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'documents', 'declarations', 'location', 'banking'].includes(s.id)),
  },
  'trainer_solo': {
    fields: [...UNIVERSAL_KYC_FIELDS, ...DOORSTEP_SERVICE_FIELDS],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'documents', 'declarations', 'location', 'banking'].includes(s.id)),
  },
  'trainer_center': {
    fields: [...UNIVERSAL_KYC_FIELDS, ...BUSINESS_REGISTRATION_FIELDS],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'business_registration', 'documents', 'location', 'banking'].includes(s.id)),
  },
  'breeder': {
    fields: [...UNIVERSAL_KYC_FIELDS, ...BREEDER_FIELDS],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'professional', 'documents', 'declarations', 'location', 'banking'].includes(s.id)),
  },
  'pet_boarder': {
    fields: [...UNIVERSAL_KYC_FIELDS, ...BUSINESS_REGISTRATION_FIELDS],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'business_registration', 'documents', 'location', 'banking'].includes(s.id)),
  },
  'boarding': {
    fields: [...UNIVERSAL_KYC_FIELDS, ...BUSINESS_REGISTRATION_FIELDS],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'business_registration', 'documents', 'location', 'banking'].includes(s.id)),
  },
  'pharmacy': {
    fields: [...UNIVERSAL_KYC_FIELDS, ...BUSINESS_REGISTRATION_FIELDS],
    sections: KYC_SECTIONS,
  },
  'nutritionist': {
    fields: [...UNIVERSAL_KYC_FIELDS],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'documents', 'location', 'banking'].includes(s.id)),
  },
  'sitter': {
    fields: [...UNIVERSAL_KYC_FIELDS, ...DOORSTEP_SERVICE_FIELDS],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'documents', 'declarations', 'location', 'banking'].includes(s.id)),
  },
  'sunset': {
    fields: [...UNIVERSAL_KYC_FIELDS, ...BUSINESS_REGISTRATION_FIELDS],
    sections: KYC_SECTIONS.filter(s => ['basic', 'identity_verification', 'business_registration', 'documents', 'location', 'banking'].includes(s.id)),
  },
};

async function seedKYCFields() {
  console.log('🚀 Seeding KYC Fields Directly to Database');
  console.log('==========================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Region: ${REGION}`);
  console.log('');

  const { execSync } = require('child_process');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

  console.log('📊 Getting RDS cluster information...');
  
  let endpoint, port, dbName, username;
  
  try {
    endpoint = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
      { encoding: 'utf8' }
    ).trim();

    port = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Port' --output text`,
      { encoding: 'utf8' }
    ).trim() || '5432';

    dbName = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].DatabaseName' --output text`,
      { encoding: 'utf8' }
    ).trim() || 'warmpawz';

    username = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].MasterUsername' --output text`,
      { encoding: 'utf8' }
    ).trim() || 'warmpawz_admin';
  } catch (err) {
    console.error('❌ ERROR: Failed to get RDS cluster info:', err.message);
    process.exit(1);
  }

  console.log(`   Endpoint: ${endpoint}:${port}/${dbName}`);

  // Get password from Secrets Manager
  console.log('🔐 Getting credentials...');
  const secretsClient = new SecretsManagerClient({ region: REGION });
  const secretName = `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002`;
  
  let password;
  try {
    const secretValue = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    const secret = JSON.parse(secretValue.SecretString);
    password = secret.password || secret.Password;
  } catch (err) {
    console.error('❌ ERROR: Could not get password:', err.message);
    process.exit(1);
  }

  console.log('✅ Credentials retrieved');

  // Connect to database
  const pool = new Pool({
    host: endpoint,
    port: parseInt(port, 10),
    database: dbName,
    user: username,
    password: password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  try {
    await pool.query('SELECT 1');
    console.log('✅ Connected to database');
    console.log('');

    // Ensure onboarding_forms table exists with sections column
    console.log('🔧 Ensuring onboarding_forms table has sections column...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS onboarding_forms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role_id VARCHAR(255) UNIQUE NOT NULL,
        fields JSONB NOT NULL,
        sections JSONB,
        status VARCHAR(50) DEFAULT 'active',
        version INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE onboarding_forms ADD COLUMN IF NOT EXISTS sections JSONB`);
    console.log('   ✅ Table ready');
    console.log('');

    // Get all active roles
    console.log('📋 Fetching active roles...');
    const rolesResult = await pool.query(`SELECT * FROM roles WHERE is_active = true ORDER BY name`);
    const roles = rolesResult.rows;
    console.log(`   Found ${roles.length} active roles`);
    console.log('');

    let created = 0;
    let updated = 0;
    let skipped = 0;

    console.log('🔧 Seeding KYC fields for each role...');
    
    for (const role of roles) {
      const roleName = role.name;
      const kycConfig = ROLE_KYC_MAPPING[roleName];
      
      if (!kycConfig) {
        console.log(`   ⏭️  ${roleName}: No KYC config defined, skipping`);
        skipped++;
        continue;
      }

      // Convert KYC fields to form field format
      const formFields = kycConfig.fields.map((f, idx) => ({
        id: f.id,
        fieldName: f.fieldName,
        name: f.fieldName,
        label: f.label,
        type: f.type,
        section: f.section,
        isMandatory: f.isMandatory,
        required: f.required,
        requiresVerification: f.type.includes('-otp') || f.type.includes('-verify'),
        placeholder: f.placeholder || '',
        helpText: f.helpText || '',
        options: f.options || [],
        validation: f.validation || {},
        displayOrder: f.displayOrder || idx,
        order: f.displayOrder || idx,
        isActive: true,
        softBlock: f.softBlock || false,
        declarationText: f.declarationText || null,
        declarationType: f.id,
      }));

      // Check if form exists
      const existingResult = await pool.query(
        `SELECT * FROM onboarding_forms WHERE role_id = $1`,
        [roleName]
      );

      if (existingResult.rows.length > 0) {
        // Merge KYC fields with existing fields
        const existingForm = existingResult.rows[0];
        const existingFields = typeof existingForm.fields === 'string'
          ? JSON.parse(existingForm.fields)
          : existingForm.fields || [];

        const kycFieldIds = new Set(formFields.map(f => f.id));
        const nonKycFields = existingFields.filter(f => !kycFieldIds.has(f.id));
        const mergedFields = [...nonKycFields, ...formFields];

        await pool.query(
          `UPDATE onboarding_forms 
           SET fields = $1, sections = $2, version = version + 1, updated_at = NOW()
           WHERE role_id = $3`,
          [JSON.stringify(mergedFields), JSON.stringify(kycConfig.sections), roleName]
        );
        
        console.log(`   🔄 ${roleName}: Updated (${formFields.length} KYC fields, ${mergedFields.length} total)`);
        updated++;
      } else {
        // Create new form
        await pool.query(
          `INSERT INTO onboarding_forms (role_id, fields, sections, status, version)
           VALUES ($1, $2, $3, 'active', 1)`,
          [roleName, JSON.stringify(formFields), JSON.stringify(kycConfig.sections)]
        );
        
        console.log(`   ✅ ${roleName}: Created (${formFields.length} KYC fields)`);
        created++;
      }
    }

    console.log('');
    console.log('📊 Summary:');
    console.log(`   ✅ Created: ${created}`);
    console.log(`   🔄 Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log('');
    console.log('✅ KYC Fields Seeding Complete!');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedKYCFields().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
