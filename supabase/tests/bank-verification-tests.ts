/**
 * ============================================================================
 * BANK VERIFICATION TESTS
 * ============================================================================
 * 
 * Comprehensive test suite for bank verification endpoints
 * Tests SQL-only implementation
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { assertEquals, assertExists, assert } from "jsr:@std/assert";

// Mock test data
const TEST_VENDOR_ID = "test-vendor-123";
const TEST_ACCOUNT_NUMBER = "1234567890";
const TEST_IFSC = "SBIN0001234";
const TEST_ACCOUNT_HOLDER = "Test Account Holder";

/**
 * Test bank account creation
 */
export async function testCreateBankAccount() {
  console.log("🧪 Testing bank account creation...");
  
  // This would call the actual endpoint
  // For now, we'll test the repository directly
  const { getBankAccountsRepository } = await import("../lib/repositories/bank-accounts.ts");
  const repo = getBankAccountsRepository();
  
  try {
    const account = await repo.create({
      vendor_id: TEST_VENDOR_ID,
      account_holder_name: TEST_ACCOUNT_HOLDER,
      account_number: TEST_ACCOUNT_NUMBER,
      ifsc_code: TEST_IFSC,
      bank_name: "State Bank of India",
      branch_name: "Test Branch",
      account_type: "savings",
      is_primary: true
    });
    
    assertExists(account.id, "Account ID should be generated");
    assertEquals(account.vendor_id, TEST_VENDOR_ID);
    assertEquals(account.account_holder_name, TEST_ACCOUNT_HOLDER);
    assertEquals(account.ifsc_code, TEST_IFSC.toUpperCase());
    assertEquals(account.is_primary, true);
    assertEquals(account.verification_status, "pending");
    
    console.log("✅ Bank account creation test passed");
    return true;
  } catch (error) {
    console.error("❌ Bank account creation test failed:", error);
    return false;
  }
}

/**
 * Test bank account verification
 */
export async function testBankAccountVerification() {
  console.log("🧪 Testing bank account verification...");
  
  const { getBankAccountsRepository } = await import("../lib/repositories/bank-accounts.ts");
  const repo = getBankAccountsRepository();
  
  try {
    // Create account first
    const account = await repo.create({
      vendor_id: TEST_VENDOR_ID,
      account_holder_name: TEST_ACCOUNT_HOLDER,
      account_number: TEST_ACCOUNT_NUMBER,
      ifsc_code: TEST_IFSC,
      bank_name: "State Bank of India",
      account_type: "savings"
    });
    
    // Create verification record
    const verification = await repo.createVerification({
      vendor_id: TEST_VENDOR_ID,
      bank_detail_id: account.id,
      verification_method: "penny_drop"
    });
    
    assertExists(verification.id, "Verification ID should be generated");
    assertEquals(verification.verification_status, "pending");
    
    // Update verification status
    const updated = await repo.updateVerification(verification.id, {
      verification_status: "verified",
      verification_data: {
        verifiedName: TEST_ACCOUNT_HOLDER,
        matchScore: 100
      }
    });
    
    assertEquals(updated.verification_status, "verified");
    assertExists(updated.verified_at);
    
    console.log("✅ Bank account verification test passed");
    return true;
  } catch (error) {
    console.error("❌ Bank account verification test failed:", error);
    return false;
  }
}

/**
 * Test primary account management
 */
export async function testPrimaryAccountManagement() {
  console.log("🧪 Testing primary account management...");
  
  const { getBankAccountsRepository } = await import("../lib/repositories/bank-accounts.ts");
  const repo = getBankAccountsRepository();
  
  try {
    // Create first account as primary
    const account1 = await repo.create({
      vendor_id: TEST_VENDOR_ID,
      account_holder_name: TEST_ACCOUNT_HOLDER,
      account_number: TEST_ACCOUNT_NUMBER,
      ifsc_code: TEST_IFSC,
      bank_name: "State Bank of India",
      is_primary: true
    });
    
    assertEquals(account1.is_primary, true);
    
    // Create second account and set as primary
    const account2 = await repo.create({
      vendor_id: TEST_VENDOR_ID,
      account_holder_name: "Second Account",
      account_number: "0987654321",
      ifsc_code: "HDFC0000123",
      bank_name: "HDFC Bank",
      is_primary: true
    });
    
    assertEquals(account2.is_primary, true);
    
    // Verify first account is no longer primary
    const updatedAccount1 = await repo.findById(account1.id);
    assertEquals(updatedAccount1?.is_primary, false);
    
    console.log("✅ Primary account management test passed");
    return true;
  } catch (error) {
    console.error("❌ Primary account management test failed:", error);
    return false;
  }
}

/**
 * Run all bank verification tests
 */
export async function runBankVerificationTests() {
  console.log("🚀 Running bank verification tests...\n");
  
  const results = {
    create: await testCreateBankAccount(),
    verification: await testBankAccountVerification(),
    primary: await testPrimaryAccountManagement()
  };
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  console.log(`\n📊 Test Results: ${passed}/${total} passed`);
  
  return passed === total;
}

