/**
 * ============================================================================
 * TIER UPGRADE TESTS
 * ============================================================================
 * 
 * Comprehensive test suite for tier upgrade endpoints
 * Tests SQL-only implementation
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { assertEquals, assertExists, assert } from "jsr:@std/assert";

const TEST_VENDOR_ID = "test-vendor-123";

/**
 * Test tier creation
 */
export async function testTierCreation() {
  console.log("🧪 Testing tier creation...");
  
  const { getVendorTiersRepository } = await import("../lib/repositories/vendor-tiers.ts");
  const repo = getVendorTiersRepository();
  
  try {
    const tier = await repo.create({
      tier_name: "test_tier",
      tier_level: 1,
      display_name: "Test Tier",
      description: "Test tier description",
      commission_rate: 10.5,
      monthly_cost: 999,
      yearly_cost: 9990,
      is_active: true
    });
    
    assertExists(tier.id, "Tier ID should be generated");
    assertEquals(tier.tier_name, "test_tier");
    assertEquals(tier.tier_level, 1);
    assertEquals(tier.commission_rate, 10.5);
    assertEquals(tier.monthly_cost, 999);
    
    console.log("✅ Tier creation test passed");
    return true;
  } catch (error) {
    console.error("❌ Tier creation test failed:", error);
    return false;
  }
}

/**
 * Test subscription creation
 */
export async function testSubscriptionCreation() {
  console.log("🧪 Testing subscription creation...");
  
  const { getVendorTiersRepository } = await import("../lib/repositories/vendor-tiers.ts");
  const repo = getVendorTiersRepository();
  
  try {
    // Create tier first
    const tier = await repo.create({
      tier_name: "test_subscription_tier",
      tier_level: 2,
      display_name: "Test Subscription Tier",
      commission_rate: 8.0,
      monthly_cost: 1999,
      yearly_cost: 19990
    });
    
    // Create subscription
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    
    const subscription = await repo.createSubscription({
      vendor_id: TEST_VENDOR_ID,
      tier_id: tier.id,
      subscription_type: "monthly",
      payment_type: "upfront",
      total_amount: 1999,
      discount_amount: 0,
      final_amount: 1999,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0]
    });
    
    assertExists(subscription.id, "Subscription ID should be generated");
    assertEquals(subscription.vendor_id, TEST_VENDOR_ID);
    assertEquals(subscription.tier_id, tier.id);
    assertEquals(subscription.status, "active");
    
    console.log("✅ Subscription creation test passed");
    return true;
  } catch (error) {
    console.error("❌ Subscription creation test failed:", error);
    return false;
  }
}

/**
 * Test upgrade payment creation
 */
export async function testUpgradePaymentCreation() {
  console.log("🧪 Testing upgrade payment creation...");
  
  const { getVendorTiersRepository } = await import("../lib/repositories/vendor-tiers.ts");
  const repo = getVendorTiersRepository();
  
  try {
    // Create tiers
    const currentTier = await repo.create({
      tier_name: "current_tier",
      tier_level: 1,
      display_name: "Current Tier",
      commission_rate: 10.0,
      monthly_cost: 1000,
      yearly_cost: 10000
    });
    
    const targetTier = await repo.create({
      tier_name: "target_tier",
      tier_level: 2,
      display_name: "Target Tier",
      commission_rate: 8.0,
      monthly_cost: 2000,
      yearly_cost: 20000
    });
    
    // Create upgrade payment
    const payment = await repo.createUpgradePayment({
      vendor_id: TEST_VENDOR_ID,
      current_tier_id: currentTier.id,
      target_tier_id: targetTier.id,
      subscription_type: "monthly",
      payment_type: "upfront",
      total_amount: 2000,
      discount_amount: 0,
      final_amount: 2000
    });
    
    assertExists(payment.id, "Payment ID should be generated");
    assertEquals(payment.vendor_id, TEST_VENDOR_ID);
    assertEquals(payment.target_tier_id, targetTier.id);
    assertEquals(payment.payment_status, "pending");
    
    console.log("✅ Upgrade payment creation test passed");
    return true;
  } catch (error) {
    console.error("❌ Upgrade payment creation test failed:", error);
    return false;
  }
}

/**
 * Run all tier upgrade tests
 */
export async function runTierUpgradeTests() {
  console.log("🚀 Running tier upgrade tests...\n");
  
  const results = {
    tierCreation: await testTierCreation(),
    subscriptionCreation: await testSubscriptionCreation(),
    upgradePayment: await testUpgradePaymentCreation()
  };
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  console.log(`\n📊 Test Results: ${passed}/${total} passed`);
  
  return passed === total;
}

