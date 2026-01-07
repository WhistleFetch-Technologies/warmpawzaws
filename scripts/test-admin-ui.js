#!/usr/bin/env node

/**
 * Admin UI Testing Script
 * Tests all CRUD operations for Banners, Loyalty, and Promotions
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Test configuration
const TEST_CONFIG = {
  banners: {
    create: {
      title: 'Test Banner',
      description: 'Test banner description',
      image_url: 'https://via.placeholder.com/800x200',
      link_url: 'https://example.com',
      position: 'home_top',
      is_active: true,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
  },
  loyalty: {
    create: {
      name: 'Test Loyalty Rule',
      description: 'Test loyalty rule description',
      points_per_rupee: 1,
      redemption_rate: 100,
      min_points_to_redeem: 100,
      is_active: true,
    },
  },
  promotions: {
    create: {
      code: 'TEST2025',
      name: 'Test Promotion',
      description: 'Test promotion description',
      discount_type: 'percentage',
      discount_value: '10',
      min_order_value: 100,
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      is_active: true,
    },
  },
};

// Test results
const results = {
  banners: { passed: 0, failed: 0, errors: [] },
  loyalty: { passed: 0, failed: 0, errors: [] },
  promotions: { passed: 0, failed: 0, errors: [] },
};

// Helper function to make API calls
async function apiCall(method, endpoint, data = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const result = await response.json();
    
    return {
      ok: response.ok,
      status: response.status,
      data: result,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message,
    };
  }
}

// Test Banner Management
async function testBanners() {
  console.log('\n📋 Testing Banner Management...\n');
  
  let createdBannerId = null;

  // Test 1: Create Banner
  console.log('  [1] Creating banner...');
  const createResult = await apiCall('POST', '/admin/banners', TEST_CONFIG.banners.create);
  if (createResult.ok && createResult.data.banner) {
    createdBannerId = createResult.data.banner.id;
    console.log('      ✅ Banner created:', createdBannerId);
    results.banners.passed++;
  } else {
    console.log('      ❌ Failed to create banner:', createResult.error || createResult.data.error);
    results.banners.failed++;
    results.banners.errors.push('Create failed: ' + (createResult.error || createResult.data.error));
    return; // Can't continue without created banner
  }

  // Test 2: Get All Banners
  console.log('  [2] Getting all banners...');
  const getAllResult = await apiCall('GET', '/admin/banners');
  if (getAllResult.ok) {
    console.log('      ✅ Retrieved banners:', getAllResult.data.banners?.length || 0);
    results.banners.passed++;
  } else {
    console.log('      ❌ Failed to get banners:', getAllResult.error || getAllResult.data.error);
    results.banners.failed++;
    results.banners.errors.push('Get all failed: ' + (getAllResult.error || getAllResult.data.error));
  }

  // Test 3: Update Banner
  console.log('  [3] Updating banner...');
  const updateData = { ...TEST_CONFIG.banners.create, title: 'Updated Test Banner' };
  const updateResult = await apiCall('PUT', `/admin/banners/${createdBannerId}`, updateData);
  if (updateResult.ok && updateResult.data.banner) {
    console.log('      ✅ Banner updated');
    results.banners.passed++;
  } else {
    console.log('      ❌ Failed to update banner:', updateResult.error || updateResult.data.error);
    results.banners.failed++;
    results.banners.errors.push('Update failed: ' + (updateResult.error || updateResult.data.error));
  }

  // Test 4: Delete Banner
  console.log('  [4] Deleting banner...');
  const deleteResult = await apiCall('DELETE', `/admin/banners/${createdBannerId}`);
  if (deleteResult.ok) {
    console.log('      ✅ Banner deleted');
    results.banners.passed++;
  } else {
    console.log('      ❌ Failed to delete banner:', deleteResult.error || deleteResult.data.error);
    results.banners.failed++;
    results.banners.errors.push('Delete failed: ' + (deleteResult.error || deleteResult.data.error));
  }
}

// Test Loyalty Management
async function testLoyalty() {
  console.log('\n🎁 Testing Loyalty & Rewards Management...\n');
  
  let createdRuleId = null;

  // Test 1: Create Loyalty Rule
  console.log('  [1] Creating loyalty rule...');
  const createResult = await apiCall('POST', '/admin/loyalty/rules', TEST_CONFIG.loyalty.create);
  if (createResult.ok && createResult.data.rule) {
    createdRuleId = createResult.data.rule.id;
    console.log('      ✅ Loyalty rule created:', createdRuleId);
    results.loyalty.passed++;
  } else {
    console.log('      ❌ Failed to create loyalty rule:', createResult.error || createResult.data.error);
    results.loyalty.failed++;
    results.loyalty.errors.push('Create failed: ' + (createResult.error || createResult.data.error));
    return; // Can't continue without created rule
  }

  // Test 2: Get All Rules
  console.log('  [2] Getting all loyalty rules...');
  const getAllResult = await apiCall('GET', '/admin/loyalty/rules');
  if (getAllResult.ok) {
    console.log('      ✅ Retrieved rules:', getAllResult.data.rules?.length || 0);
    results.loyalty.passed++;
  } else {
    console.log('      ❌ Failed to get rules:', getAllResult.error || getAllResult.data.error);
    results.loyalty.failed++;
    results.loyalty.errors.push('Get all failed: ' + (getAllResult.error || getAllResult.data.error));
  }

  // Test 3: Get Stats
  console.log('  [3] Getting loyalty stats...');
  const statsResult = await apiCall('GET', '/admin/loyalty/stats');
  if (statsResult.ok && statsResult.data.stats) {
    console.log('      ✅ Retrieved stats:', JSON.stringify(statsResult.data.stats));
    results.loyalty.passed++;
  } else {
    console.log('      ❌ Failed to get stats:', statsResult.error || statsResult.data.error);
    results.loyalty.failed++;
    results.loyalty.errors.push('Stats failed: ' + (statsResult.error || statsResult.data.error));
  }

  // Test 4: Get Transactions
  console.log('  [4] Getting loyalty transactions...');
  const transactionsResult = await apiCall('GET', '/admin/loyalty/transactions?limit=10');
  if (transactionsResult.ok) {
    console.log('      ✅ Retrieved transactions:', transactionsResult.data.transactions?.length || 0);
    results.loyalty.passed++;
  } else {
    console.log('      ❌ Failed to get transactions:', transactionsResult.error || transactionsResult.data.error);
    results.loyalty.failed++;
    results.loyalty.errors.push('Transactions failed: ' + (transactionsResult.error || transactionsResult.data.error));
  }

  // Test 5: Update Rule
  console.log('  [5] Updating loyalty rule...');
  const updateData = { ...TEST_CONFIG.loyalty.create, name: 'Updated Test Rule' };
  const updateResult = await apiCall('PUT', `/admin/loyalty/rules/${createdRuleId}`, updateData);
  if (updateResult.ok && updateResult.data.rule) {
    console.log('      ✅ Rule updated');
    results.loyalty.passed++;
  } else {
    console.log('      ❌ Failed to update rule:', updateResult.error || updateResult.data.error);
    results.loyalty.failed++;
    results.loyalty.errors.push('Update failed: ' + (updateResult.error || updateResult.data.error));
  }

  // Test 6: Delete Rule
  console.log('  [6] Deleting loyalty rule...');
  const deleteResult = await apiCall('DELETE', `/admin/loyalty/rules/${createdRuleId}`);
  if (deleteResult.ok) {
    console.log('      ✅ Rule deleted');
    results.loyalty.passed++;
  } else {
    console.log('      ❌ Failed to delete rule:', deleteResult.error || deleteResult.data.error);
    results.loyalty.failed++;
    results.loyalty.errors.push('Delete failed: ' + (deleteResult.error || deleteResult.data.error));
  }
}

// Test Promotions Management
async function testPromotions() {
  console.log('\n🎉 Testing Promotions Management...\n');
  
  let createdPromotionId = null;

  // Test 1: Create Promotion
  console.log('  [1] Creating promotion...');
  const createResult = await apiCall('POST', '/admin/promotions', TEST_CONFIG.promotions.create);
  if (createResult.ok && createResult.data.promotion) {
    createdPromotionId = createResult.data.promotion.id;
    console.log('      ✅ Promotion created:', createdPromotionId);
    results.promotions.passed++;
  } else {
    console.log('      ❌ Failed to create promotion:', createResult.error || createResult.data.error);
    results.promotions.failed++;
    results.promotions.errors.push('Create failed: ' + (createResult.error || createResult.data.error));
    return; // Can't continue without created promotion
  }

  // Test 2: Get All Promotions
  console.log('  [2] Getting all promotions...');
  const getAllResult = await apiCall('GET', '/admin/promotions');
  if (getAllResult.ok) {
    console.log('      ✅ Retrieved promotions:', getAllResult.data.promotions?.length || 0);
    results.promotions.passed++;
  } else {
    console.log('      ❌ Failed to get promotions:', getAllResult.error || getAllResult.data.error);
    results.promotions.failed++;
    results.promotions.errors.push('Get all failed: ' + (getAllResult.error || getAllResult.data.error));
  }

  // Test 3: Update Promotion
  console.log('  [3] Updating promotion...');
  const updateData = { ...TEST_CONFIG.promotions.create, name: 'Updated Test Promotion' };
  const updateResult = await apiCall('PUT', `/admin/promotions/${createdPromotionId}`, updateData);
  if (updateResult.ok && updateResult.data.promotion) {
    console.log('      ✅ Promotion updated');
    results.promotions.passed++;
  } else {
    console.log('      ❌ Failed to update promotion:', updateResult.error || updateResult.data.error);
    results.promotions.failed++;
    results.promotions.errors.push('Update failed: ' + (updateResult.error || updateResult.data.error));
  }

  // Test 4: Delete Promotion
  console.log('  [4] Deleting promotion...');
  const deleteResult = await apiCall('DELETE', `/admin/promotions/${createdPromotionId}`);
  if (deleteResult.ok) {
    console.log('      ✅ Promotion deleted');
    results.promotions.passed++;
  } else {
    console.log('      ❌ Failed to delete promotion:', deleteResult.error || deleteResult.data.error);
    results.promotions.failed++;
    results.promotions.errors.push('Delete failed: ' + (deleteResult.error || deleteResult.data.error));
  }
}

// Print summary
function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const totalPassed = results.banners.passed + results.loyalty.passed + results.promotions.passed;
  const totalFailed = results.banners.failed + results.loyalty.failed + results.promotions.failed;
  
  console.log('\n📋 Banners:');
  console.log(`   ✅ Passed: ${results.banners.passed}`);
  console.log(`   ❌ Failed: ${results.banners.failed}`);
  if (results.banners.errors.length > 0) {
    console.log('   Errors:');
    results.banners.errors.forEach(err => console.log(`      - ${err}`));
  }
  
  console.log('\n🎁 Loyalty:');
  console.log(`   ✅ Passed: ${results.loyalty.passed}`);
  console.log(`   ❌ Failed: ${results.loyalty.failed}`);
  if (results.loyalty.errors.length > 0) {
    console.log('   Errors:');
    results.loyalty.errors.forEach(err => console.log(`      - ${err}`));
  }
  
  console.log('\n🎉 Promotions:');
  console.log(`   ✅ Passed: ${results.promotions.passed}`);
  console.log(`   ❌ Failed: ${results.promotions.failed}`);
  if (results.promotions.errors.length > 0) {
    console.log('   Errors:');
    results.promotions.errors.forEach(err => console.log(`      - ${err}`));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${totalPassed} passed, ${totalFailed} failed`);
  console.log('='.repeat(60) + '\n');
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Admin UI API Tests...');
  console.log(`📍 Base URL: ${BASE_URL}`);
  
  try {
    await testBanners();
    await testLoyalty();
    await testPromotions();
  } catch (error) {
    console.error('\n❌ Test execution error:', error);
  }
  
  printSummary();
  
  // Exit with appropriate code
  const totalFailed = results.banners.failed + results.loyalty.failed + results.promotions.failed;
  process.exit(totalFailed > 0 ? 1 : 0);
}

// Run tests
runTests();

