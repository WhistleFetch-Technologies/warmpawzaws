#!/usr/bin/env node
/**
 * Create Vet Solo and Vet Clinic Vendors via Admin API
 * 
 * Usage: 
 *   node scripts/create-vet-vendors-api.js
 * 
 * Environment Variables:
 *   API_BASE_URL - Base URL for the API (default: http://localhost:3000)
 *   ADMIN_TOKEN - Admin authentication token (if required)
 */

const { Pool } = require('pg');

// Database connection (for getting role IDs)
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/warmpawz';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function getRoleIds() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const result = await pool.query(`
      SELECT id, name, display_name 
      FROM roles 
      WHERE name IN ('veterinarian', 'vet_clinic')
      ORDER BY name
    `);
    
    const roles = {};
    result.rows.forEach(row => {
      roles[row.name] = row.id;
    });
    
    return roles;
  } finally {
    await pool.end();
  }
}

async function createVendor(vendorData) {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/vendors/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add admin auth token if required
        // 'Authorization': `Bearer ${process.env.ADMIN_TOKEN}`
      },
      body: JSON.stringify(vendorData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating vendor:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Creating Vet Solo and Vet Clinic Vendors');
  console.log('='.repeat(60));
  console.log(`🔌 API: ${API_BASE_URL}`);
  console.log('');

  // Get role IDs
  console.log('📋 Fetching role IDs...');
  const roles = await getRoleIds();
  
  if (!roles.veterinarian || !roles.vet_clinic) {
    console.error('❌ Error: Could not find role IDs');
    console.error('   Make sure migrations 047_seed_roles.sql has been run');
    process.exit(1);
  }
  
  console.log(`✅ Found roles:`);
  console.log(`   - Veterinarian: ${roles.veterinarian}`);
  console.log(`   - Vet Clinic: ${roles.vet_clinic}`);
  console.log('');

  // Create Vet Solo (Veterinarian)
  console.log('👨‍⚕️ Creating Veterinarian (Solo) vendor...');
  const vetSoloData = {
    businessName: 'Dr. John Pet Clinic',
    ownerName: 'Dr. John Doe',
    email: 'vet.solo@example.com',
    phone: '9876543210',
    alternatePhone: '',
    roleId: roles.veterinarian,
    category: 'healthcare',
    vendorType: 'solo',  // ✅ Important: solo for individual vet
    address: '123 Main Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    landmark: '',
    experience: '10',
    specialization: 'General Practice, Surgery',
    registrationNumber: 'VET-12345',
    gstNumber: '',
    panNumber: 'ABCDE1234F',
    tier: 'Bronze',
    commission: '15',
    status: 'active',
    operatingHours: '09:00-18:00',
    capacity: '1',
    serviceAreas: ['Mumbai', 'Thane'],
    certifications: ['BVSc', 'MVSc'],
    bankName: 'State Bank of India',
    accountNumber: '1234567890',
    ifscCode: 'SBIN0001234',
    accountHolderName: 'Dr. John Doe',
    services: [],
    uploadedDocuments: {},
    createdBy: 'admin_1',
    createdAt: new Date().toISOString()
  };

  try {
    const vetSoloResult = await createVendor(vetSoloData);
    console.log('✅ Veterinarian (Solo) created successfully');
    console.log(`   Vendor ID: ${vetSoloResult.vendorId || vetSoloResult.id}`);
    console.log('');
  } catch (error) {
    console.error('❌ Failed to create Veterinarian (Solo):', error.message);
    console.log('');
  }

  // Create Vet Clinic (Business)
  console.log('🏥 Creating Veterinary Clinic (Business) vendor...');
  const vetClinicData = {
    businessName: 'Paws & Claws Veterinary Clinic',
    ownerName: 'Dr. Jane Smith',
    email: 'vet.clinic@example.com',
    phone: '9876543211',
    alternatePhone: '9876543212',
    roleId: roles.vet_clinic,
    category: 'healthcare',
    vendorType: 'business',  // ✅ Important: business for clinic
    address: '456 Park Avenue',
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110001',
    landmark: 'Near Metro Station',
    experience: '15',
    specialization: 'Surgery, Emergency Care, Diagnostics',
    registrationNumber: 'CLINIC-67890',
    gstNumber: '27ABCDE1234F1Z5',
    panNumber: 'FGHIJ5678K',
    tier: 'Silver',
    commission: '15',
    status: 'active',
    operatingHours: '08:00-20:00',
    capacity: '10',  // Clinic can handle more pets
    serviceAreas: ['Delhi', 'Noida', 'Gurgaon'],
    certifications: ['ISO Certified', 'NABL Accredited'],
    bankName: 'HDFC Bank',
    accountNumber: '0987654321',
    ifscCode: 'HDFC0000987',
    accountHolderName: 'Paws & Claws Veterinary Clinic',
    services: [],
    uploadedDocuments: {},
    createdBy: 'admin_1',
    createdAt: new Date().toISOString()
  };

  try {
    const vetClinicResult = await createVendor(vetClinicData);
    console.log('✅ Veterinary Clinic (Business) created successfully');
    console.log(`   Vendor ID: ${vetClinicResult.vendorId || vetClinicResult.id}`);
    console.log('');
  } catch (error) {
    console.error('❌ Failed to create Veterinary Clinic:', error.message);
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('✅ Vendor creation process completed');
  console.log('');
  console.log('📝 Next Steps:');
  console.log('   1. Verify vendors in admin dashboard');
  console.log('   2. Add services for each vendor');
  console.log('   3. Set up staff (for clinic)');
  console.log('   4. Configure availability/schedule');
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
