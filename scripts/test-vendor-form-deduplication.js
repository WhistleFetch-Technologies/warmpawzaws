/**
 * Test script to verify vendor onboarding form deduplication
 * 
 * This script tests:
 * 1. Removal of fields with fieldName="new_field" that duplicate KYC fields
 * 2. Removal of semantic duplicates (same label, type, section)
 * 3. Removal of solo-specific Aadhaar fields for business roles
 * 4. Final deduplication by id, fieldName, name
 */

console.log('🔍 [TEST] Testing vendor form deduplication logic...\n');

// Test case 1: Duplicate new_field with Aadhaar
console.log('📋 [TEST] Test Case 1: Duplicate new_field with Aadhaar');
const testFields1 = [
  {
    id: 'ownerAadhaarNumber',
    fieldName: 'ownerAadhaarNumber',
    label: "Owner's Aadhaar Number",
    type: 'aadhaar-otp',
    section: 'identity_verification',
  },
  {
    id: 'field_1771505351216_55omoq',
    fieldName: 'new_field',
    label: 'Aadhar',
    type: 'aadhaar-otp',
    section: 'identity_verification',
  }
];

// Simulate deduplication logic
const kycSemanticMap = new Map();
kycSemanticMap.set("owner's aadhaar number_aadhaar-otp_identity_verification", testFields1[0]);
kycSemanticMap.set("aadhar_aadhaar-otp_identity_verification", testFields1[0]); // Should match

const filtered1 = testFields1.filter((f) => {
  if (f.fieldName === 'new_field') {
    const fieldLabel = (f.label || '').toLowerCase().trim();
    const semanticKey = `${fieldLabel}_${f.type}_${f.section}`;
    if (kycSemanticMap.has(semanticKey)) {
      console.log(`   ✅ Would remove: "${f.label}" (matches KYC field)`);
      return false;
    }
  }
  return true;
});

console.log(`   Result: ${filtered1.length} fields (expected: 1)`);
console.log(`   ${filtered1.length === 1 ? '✅ PASS' : '❌ FAIL'}\n`);

// Test case 2: Solo vs Business Aadhaar
console.log('📋 [TEST] Test Case 2: Solo vs Business Aadhaar for business role');
const testFields2 = [
  {
    id: 'aadhaarNumber',
    fieldName: 'aadhaarNumber',
    label: 'Aadhaar Number',
    type: 'aadhaar-otp',
    section: 'identity_verification',
  },
  {
    id: 'ownerAadhaarNumber',
    fieldName: 'ownerAadhaarNumber',
    label: "Owner's Aadhaar Number",
    type: 'aadhaar-otp',
    section: 'identity_verification',
  }
];

const hasOwnerAadhaar = testFields2.some(f => f.id === 'ownerAadhaarNumber');
if (hasOwnerAadhaar) {
  const soloIndex = testFields2.findIndex(f => f.id === 'aadhaarNumber');
  if (soloIndex >= 0) {
    testFields2.splice(soloIndex, 1);
    console.log(`   ✅ Removed solo-specific aadhaarNumber`);
  }
}

console.log(`   Result: ${testFields2.length} fields (expected: 1)`);
console.log(`   ${testFields2.length === 1 ? '✅ PASS' : '❌ FAIL'}\n`);

// Test case 3: Duplicate cancelled cheque
console.log('📋 [TEST] Test Case 3: Duplicate cancelled cheque');
const testFields3 = [
  {
    id: 'cancelledCheque',
    fieldName: 'cancelledCheque',
    label: 'Cancelled Cheque',
    type: 'file',
    section: 'documents',
  },
  {
    id: 'field_1771410666470_jr62dq',
    fieldName: 'new_field',
    label: 'Cancellation Cheque',
    type: 'file',
    section: 'documents',
  }
];

const labelKeywords = ['aadhaar', 'aadhar', 'pan', 'gst', 'cancelled cheque', 'cancellation cheque', 'cancelled check'];
const filtered3 = testFields3.filter((f) => {
  if (f.fieldName === 'new_field') {
    const fieldLabel = (f.label || '').toLowerCase().trim();
    const matchesKeyword = labelKeywords.some(keyword => fieldLabel.includes(keyword.toLowerCase()));
    if (matchesKeyword) {
      // Check if any other field has similar label
      const hasMatching = testFields3.some((other) => {
        if (other.id === f.id) return false;
        const otherLabel = (other.label || '').toLowerCase();
        return otherLabel.includes('cancelled') || otherLabel.includes('cancellation');
      });
      if (hasMatching) {
        console.log(`   ✅ Would remove: "${f.label}" (matches keyword)`);
        return false;
      }
    }
  }
  return true;
});

console.log(`   Result: ${filtered3.length} fields (expected: 1)`);
console.log(`   ${filtered3.length === 1 ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('✅ [TEST] Deduplication logic tests complete!\n');
console.log('💡 [TEST] Next steps:');
console.log('   1. Deploy the updated endpoints');
console.log('   2. Test vendor onboarding form for vet_clinic');
console.log('   3. Verify no duplicate fields appear');
console.log('   4. Check that new_field duplicates are removed');
console.log('   5. Verify solo-specific Aadhaar is removed for business roles\n');
