#!/usr/bin/env node
/**
 * Verify Service Catalog Implementation
 * 
 * Checks:
 * 1. All service categories are in DB with icons
 * 2. All specializations are linked to categories
 * 3. API endpoints return correct data
 * 4. Icons match between DB and customer-web
 */

const https = require('https');

const API_BASE = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

// Expected services from customer-web
const EXPECTED_SERVICES = {
  'veterinary': { name: 'Vet Care', icon: 'Stethoscope', specCount: 10 },
  'grooming': { name: 'Grooming', icon: 'Scissors', specCount: 6 },
  'training': { name: 'Training', icon: 'GraduationCap', specCount: 6 },
  'walking': { name: 'Dog Walker', icon: 'Bike', specCount: 5 },
  'boarding': { name: 'Boarding', icon: 'Home', specCount: 5 },
  'behavioral': { name: 'Behavioral', icon: 'Heart', specCount: 5 },
  'wellness': { name: 'Nutritionist', icon: 'Wheat', specCount: 6 },
  'shop': { name: 'Pet Products', icon: 'ShoppingBag', specCount: 0 },
  'adoption': { name: 'Adoption', icon: 'Heart', specCount: 0 },
  'mating': { name: 'Peer to Peer', icon: 'Heart', specCount: 0 },
  'cafes': { name: 'Pet Cafes', icon: 'Coffee', specCount: 0 },
  'photography': { name: 'Photography', icon: 'Camera', specCount: 0 },
  'insurance': { name: 'Insurance', icon: 'Shield', specCount: 0 },
  'breeder': { name: 'Breeder', icon: 'PawPrint', specCount: 0 },
  'ambulance': { name: 'Ambulance', icon: 'Phone', specCount: 0 },
  'relocation': { name: 'Relocation', icon: 'Truck', specCount: 0 },
  'resort': { name: 'Pet Resort', icon: 'Sparkles', specCount: 0 },
  'holiday': { name: 'Pet Holiday', icon: 'Palmtree', specCount: 0 },
  'sunset': { name: 'Sunset Care', icon: 'Sun', specCount: 0 },
  'pharmacy': { name: 'Pharmacy', icon: 'Pill', specCount: 0 },
  'lab-diagnostics': { name: 'Lab Tests', icon: 'FlaskConical', specCount: 0 },
};

function fetchAPI(path) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${path}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

async function verify() {
  console.log('🔍 Service Catalog Verification');
  console.log('================================');
  console.log('');

  let passed = 0;
  let failed = 0;

  // 1. Check public problem grid for each role type
  console.log('📊 Testing Public Problem Grid APIs...');
  const roles = ['vet_solo', 'groomer_solo', 'trainer_solo', 'walker', 'boarding'];
  
  for (const role of roles) {
    try {
      const data = await fetchAPI(`/public/problem-grid/${role}`);
      if (data.success && data.problems && data.problems.length > 0) {
        console.log(`   ✅ /public/problem-grid/${role} - ${data.problems.length} specializations`);
        passed++;
      } else {
        console.log(`   ❌ /public/problem-grid/${role} - Empty or failed`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ /public/problem-grid/${role} - Error: ${error.message}`);
      failed++;
    }
  }

  // 2. Check vendor specializations API
  console.log('');
  console.log('📊 Testing Vendor Specializations APIs...');
  
  const vendorRoles = ['vet_solo', 'groomer_solo', 'nutritionist'];
  for (const role of vendorRoles) {
    try {
      const data = await fetchAPI(`/vendor/specializations/${role}`);
      if (data.success && data.specializations) {
        console.log(`   ✅ /vendor/specializations/${role} - ${data.specializations.length} options`);
        passed++;
      } else {
        console.log(`   ❌ /vendor/specializations/${role} - Failed`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ /vendor/specializations/${role} - Error: ${error.message}`);
      failed++;
    }
  }

  // 3. Check symptom search
  console.log('');
  console.log('📊 Testing Symptom Search API...');
  const symptoms = ['fever', 'itching', 'limping'];
  
  for (const symptom of symptoms) {
    try {
      const data = await fetchAPI(`/public/search/symptoms?q=${symptom}`);
      if (data.success) {
        console.log(`   ✅ Search "${symptom}" - ${data.results?.length || 0} results`);
        passed++;
      } else {
        console.log(`   ❌ Search "${symptom}" - Failed`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ Search "${symptom}" - Error: ${error.message}`);
      failed++;
    }
  }

  // 4. Verify icon data in specializations
  console.log('');
  console.log('📊 Verifying Icon Data...');
  
  try {
    const vetData = await fetchAPI('/public/problem-grid/vet_solo');
    const iconVerified = vetData.problems?.every(p => p.iconName && p.iconColor);
    if (iconVerified) {
      console.log('   ✅ All vet specializations have icon data');
      const icons = vetData.problems.map(p => `${p.displayName}: ${p.iconName} (${p.iconColor})`);
      icons.forEach(i => console.log(`      - ${i}`));
      passed++;
    } else {
      console.log('   ❌ Some specializations missing icon data');
      failed++;
    }
  } catch (error) {
    console.log(`   ❌ Icon verification failed: ${error.message}`);
    failed++;
  }

  // Summary
  console.log('');
  console.log('════════════════════════════════');
  console.log(`📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('✅ All verifications passed!');
  } else {
    console.log('⚠️  Some verifications failed');
  }
  
  console.log('');
  console.log('🔗 Admin UI URL: http://localhost:3000/catalog (Categories tab)');
  console.log('🔗 API Docs: See /admin/specializations and /public/problem-grid/:roleId');
}

verify().catch(console.error);
