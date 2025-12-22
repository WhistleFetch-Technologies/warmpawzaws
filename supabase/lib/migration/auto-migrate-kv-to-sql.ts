/**
 * ============================================================================
 * AUTOMATED KV TO SQL MIGRATION UTILITY
 * ============================================================================
 * 
 * This utility helps automate the migration of KV operations to SQL.
 * It provides patterns and helpers for common KV → SQL conversions.
 * 
 * Usage:
 * 1. Identify KV patterns in code
 * 2. Use migration helpers to convert to SQL
 * 3. Replace KV calls with SQL repository calls
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { getDbClient } from "../db.ts";

/**
 * Common KV to SQL migration patterns
 */
export const KV_TO_SQL_PATTERNS = {
  // Entity lookups
  'kv.get(`entity:${id}`)': 'repository.findById(id)',
  'kv.getByPrefix(`entity:`)': 'repository.findAll()',
  
  // Customer patterns
  'kv.get(`customer:phone:${phone}`)': 'customersRepo.findByPhone(phone)',
  'kv.get(`customer:${id}`)': 'customersRepo.findById(id)',
  
  // Vendor patterns
  'kv.get(`vendor:${id}`)': 'vendorsRepo.findById(id)',
  'kv.getByPrefix(`vendor:`)': 'vendorsRepo.findAll()',
  
  // Booking patterns
  'kv.get(`booking:${id}`)': 'bookingsRepo.findById(id)',
  'kv.get(`customer:${id}:bookings`)': 'bookingsRepo.findByCustomer(id)',
  'kv.get(`vendor:${id}:bookings`)': 'bookingsRepo.findByVendor(id)',
  
  // Payment patterns
  'kv.get(`payment:${id}`)': 'paymentsRepo.findById(id)',
  'kv.set(`payment:${id}`, data)': 'paymentsRepo.create(data) or paymentsRepo.update(id, data)',
  
  // Payout patterns
  'kv.get(`payout:${id}`)': 'payoutsRepo.findById(id)',
  'kv.get(`vendor:${id}:payouts:pending`)': 'payoutsRepo.findByVendor(id, { status: "pending" })',
};

/**
 * Migrate a KV get operation to SQL
 */
export async function migrateKVGet(key: string): Promise<any> {
  const client = getDbClient();
  
  // Pattern matching for common KV keys
  if (key.startsWith('payment:')) {
    const { getPaymentsRepository } = await import("../repositories/payments.ts");
    const repo = getPaymentsRepository();
    const id = key.replace('payment:', '');
    return await repo.findById(id);
  }
  
  if (key.startsWith('booking:')) {
    const { getBookingsRepository } = await import("../repositories/bookings.ts");
    const repo = getBookingsRepository();
    const id = key.replace('booking:', '');
    return await repo.findById(id);
  }
  
  if (key.startsWith('vendor:')) {
    const { getVendorsRepository } = await import("../repositories/vendors.ts");
    const repo = getVendorsRepository();
    const id = key.replace('vendor:', '');
    return await repo.findById(id);
  }
  
  if (key.startsWith('customer:phone:')) {
    const { getCustomersRepository } = await import("../repositories/customers.ts");
    const repo = getCustomersRepository();
    const phone = key.replace('customer:phone:', '');
    return await repo.findByPhone(phone);
  }
  
  if (key.startsWith('customer:')) {
    const { getCustomersRepository } = await import("../repositories/customers.ts");
    const repo = getCustomersRepository();
    const id = key.replace('customer:', '');
    return await repo.findById(id);
  }
  
  // Fallback: return null (data not yet migrated)
  return null;
}

/**
 * Migrate a KV set operation to SQL
 */
export async function migrateKVSet(key: string, value: any): Promise<void> {
  const client = getDbClient();
  
  if (key.startsWith('payment:')) {
    const { getPaymentsRepository } = await import("../repositories/payments.ts");
    const repo = getPaymentsRepository();
    const id = key.replace('payment:', '');
    const existing = await repo.findById(id);
    if (existing) {
      await repo.update(id, value);
    } else {
      await repo.create({ id, ...value });
    }
    return;
  }
  
  // Add more patterns as needed
  console.warn(`[AUTO-MIGRATE] KV set pattern not yet migrated: ${key}`);
}

/**
 * Generate SQL-based endpoint from KV-based endpoint
 * This is a helper for manual migration
 */
export function generateSQLEndpointTemplate(kvEndpointFile: string): string {
  return `
/**
 * SQL-BASED ENDPOINT
 * Migrated from: ${kvEndpointFile}
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All operations wrapped in transactions
 */

import { Hono } from "npm:hono";
import { getDbClient, withTransaction } from "../../lib/db.ts";
// Import repositories as needed
// import { getPaymentsRepository } from "../../lib/repositories/payments.ts";
// import { getBookingsRepository } from "../../lib/repositories/bookings.ts";

export function endpointNameSQL(app: Hono) {
  // Migrate endpoints here
  // Replace: await kv.get(...) → await repository.findById(...)
  // Replace: await kv.set(...) → await repository.create/update(...)
  // Wrap in: await withTransaction(async (client) => { ... })
}
`;
}

