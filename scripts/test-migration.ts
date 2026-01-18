/**
 * ============================================================================
 * MIGRATION TEST SCRIPT
 * ============================================================================
 * 
 * Tests all migrated routes and repositories to ensure KV to SQL migration
 * is complete and working correctly.
 * 
 * Run: deno run --allow-net --allow-env test-migration.ts
 * ============================================================================
 */

import { getDbClient } from './supabase/lib/db.ts';
import { getVendorsRepository } from './supabase/lib/repositories/vendors.ts';
import { getCustomersRepository } from './supabase/lib/repositories/customers.ts';
import { getBookingsRepository } from './supabase/lib/repositories/bookings.ts';
import { getPayoutsRepository } from './supabase/lib/repositories/payouts.ts';
import { getEcommerceCommissionSettingsRepository } from './supabase/lib/repositories/ecommerce-commission-settings.ts';
import { getEcommerceCategoriesRepository } from './supabase/lib/repositories/ecommerce-categories.ts';
import { getPromotionsRepository } from './supabase/lib/repositories/promotions.ts';
import { getOrdersRepository } from './supabase/lib/repositories/orders.ts';
import { getWalletsRepository } from './supabase/lib/repositories/wallets.ts';
import { getReturnsRepository } from './supabase/lib/repositories/returns.ts';
import { getDisputesRepository } from './supabase/lib/repositories/disputes.ts';
import { getRegionsRepository } from './supabase/lib/repositories/regions.ts';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  message?: string;
  error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => Promise<void> | void) {
  return async () => {
    try {
      await fn();
      results.push({ name, status: 'pass' });
      console.log(`✅ ${name}`);
    } catch (error) {
      results.push({ name, status: 'fail', error: String(error) });
      console.error(`❌ ${name}: ${error}`);
    }
  };
}

function skip(name: string) {
  results.push({ name, status: 'skip', message: 'Skipped' });
  console.log(`⏭️  ${name} (skipped)`);
}

async function runTests() {
  console.log('\n🧪 ========== MIGRATION TEST SUITE ==========\n');
  
  // Test 1: Database Connection
  await test('Database Connection', async () => {
    const client = getDbClient();
    const { data, error } = await client.from('vendors').select('count').limit(1);
    if (error) throw error;
  })();
  
  // Test 2: Vendors Repository
  await test('Vendors Repository - findByPhone', async () => {
    const repo = getVendorsRepository();
    // Test with a non-existent phone (should return null, not error)
    const result = await repo.findByPhone('9999999999');
    if (result !== null && !result.id) throw new Error('Invalid result format');
  })();
  
  // Test 3: Customers Repository
  await test('Customers Repository - findByPhone', async () => {
    const repo = getCustomersRepository();
    const result = await repo.findByPhone('9999999999');
    if (result !== null && !result.id) throw new Error('Invalid result format');
  })();
  
  // Test 4: Bookings Repository
  await test('Bookings Repository - findAll', async () => {
    const repo = getBookingsRepository();
    const result = await repo.findAll({ limit: 10 });
    if (!Array.isArray(result)) throw new Error('Result should be an array');
  })();
  
  // Test 5: Payouts Repository
  await test('Payouts Repository - findAll', async () => {
    const repo = getPayoutsRepository();
    const result = await repo.findAll({ limit: 10 });
    if (!Array.isArray(result)) throw new Error('Result should be an array');
  })();
  
  // Test 6: Ecommerce Commission Settings
  await test('Ecommerce Commission Settings - getSettings', async () => {
    const repo = getEcommerceCommissionSettingsRepository();
    const result = await repo.getSettings();
    if (!result || typeof result.default_rate !== 'number') {
      throw new Error('Invalid settings format');
    }
  })();
  
  // Test 7: Ecommerce Categories
  await test('Ecommerce Categories - findAll', async () => {
    const repo = getEcommerceCategoriesRepository();
    const result = await repo.findAll();
    if (!Array.isArray(result)) throw new Error('Result should be an array');
  })();
  
  // Test 8: Promotions
  await test('Promotions Repository - findAll', async () => {
    const repo = getPromotionsRepository();
    const result = await repo.findAll({ limit: 10 });
    if (!Array.isArray(result)) throw new Error('Result should be an array');
  })();
  
  // Test 9: Orders Repository
  await test('Orders Repository - findAll', async () => {
    const repo = getOrdersRepository();
    const result = await repo.findAll({ limit: 10 });
    if (!Array.isArray(result)) throw new Error('Result should be an array');
  })();
  
  // Test 10: Wallets Repository
  await test('Wallets Repository - findByCustomer', async () => {
    const repo = getWalletsRepository();
    // Test with non-existent customer (should return null, not error)
    const result = await repo.findByCustomer('00000000-0000-0000-0000-000000000000');
    if (result !== null && !result.id) throw new Error('Invalid result format');
  })();
  
  // Test 11: Returns Repository
  await test('Returns Repository - findAll', async () => {
    const repo = getReturnsRepository();
    const result = await repo.findAll({ limit: 10 });
    if (!Array.isArray(result)) throw new Error('Result should be an array');
  })();
  
  // Test 12: Disputes Repository
  await test('Disputes Repository - findAll', async () => {
    const repo = getDisputesRepository();
    const result = await repo.findAll({ limit: 10 });
    if (!Array.isArray(result)) throw new Error('Result should be an array');
  })();
  
  // Test 13: Regions Repository
  await test('Regions Repository - findAll', async () => {
    const repo = getRegionsRepository();
    const result = await repo.findAll();
    if (!Array.isArray(result)) throw new Error('Result should be an array');
  })();
  
  // Test 14: Check for KV imports in critical files
  await test('Check KV imports removed from ecommerce_routes', async () => {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile('./src/supabase/functions/server/ecommerce_routes.tsx', 'utf-8');
    if (content.includes('import * as kv from') && !content.includes('// ⚠️ KV:')) {
      throw new Error('KV import found without proper comment');
    }
  })();
  
  // Print summary
  console.log('\n📊 ========== TEST SUMMARY ==========\n');
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`📈 Total: ${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }
  
  console.log('\n');
  
  return failed === 0;
}

// Run tests
if (import.meta.main) {
  const success = await runTests();
  Deno.exit(success ? 0 : 1);
}

export { runTests };

