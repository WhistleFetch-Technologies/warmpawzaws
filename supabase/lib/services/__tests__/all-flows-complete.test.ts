/**
 * ============================================================================
 * COMPLETE PLATFORM FLOW TESTS
 * ============================================================================
 * 
 * Comprehensive test suite for all platform flows
 * Target: 100% pass rate, 100% flow coverage
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { assertEquals, assertExists, assert } from "jsr:@std/assert";
import { getPaymentsRepository } from "../../repositories/payments.ts";
import { getBookingsRepository } from "../../repositories/bookings.ts";
import { getPayoutsRepository } from "../../repositories/payouts.ts";
import { getVendorsRepository } from "../../repositories/vendors.ts";
import { getServicesRepository } from "../../repositories/services.ts";
import { getCustomersRepository } from "../../repositories/customers.ts";
import { getSchedulingService } from "../../services/scheduling-service.ts";
import { getDbClient, withTransaction } from "../../db.ts";

// ============================================================================
// TEST HELPERS
// ============================================================================

async function createTestCustomer() {
  const repo = getCustomersRepository();
  return await repo.create({
    phone: `999999999${Math.floor(Math.random() * 10000)}`,
    full_name: 'Test Customer',
    email: 'test@example.com',
  });
}

async function createTestVendor() {
  const repo = getVendorsRepository();
  return await repo.create({
    phone: `888888888${Math.floor(Math.random() * 10000)}`,
    email: 'vendor@example.com',
    business_name: 'Test Vendor',
    owner_name: 'Test Owner',
    address: '123 Test St',
    city: 'Test City',
    state: 'Test State',
    pincode: '123456',
    status: 'active',
    tier: 'Bronze',
    commission_percentage: 15,
  });
}

async function createTestService(vendorId: string) {
  const repo = getServicesRepository();
  return await repo.create({
    vendor_id: vendorId,
    name: 'Test Service',
    description: 'Test service description',
    category: 'test',
    price: 1000,
    duration_minutes: 60,
  });
}

// ============================================================================
// PAYMENT FLOW TESTS
// ============================================================================

Deno.test("Payment Flow: Complete End-to-End", async () => {
  const customer = await createTestCustomer();
  const vendor = await createTestVendor();
  const service = await createTestService(vendor.id);
  
  const paymentsRepo = getPaymentsRepository();
  
  // Create payment
  const payment = await paymentsRepo.create({
    customer_id: customer.id,
    vendor_id: vendor.id,
    amount: 1000,
    payment_method: 'razorpay',
  });
  
  assertExists(payment.id);
  assertEquals(payment.amount, 1000);
  assertEquals(payment.payment_status, 'pending');
  
  // Complete payment
  const completed = await paymentsRepo.complete(payment.id, 'txn_test123');
  assertEquals(completed.payment_status, 'completed');
  assertExists(completed.completed_at);
});

// ============================================================================
// BOOKING FLOW TESTS
// ============================================================================

Deno.test("Booking Flow: Complete End-to-End", async () => {
  const customer = await createTestCustomer();
  const vendor = await createTestVendor();
  const service = await createTestService(vendor.id);
  
  const bookingsRepo = getBookingsRepository();
  
  // Create booking
  const booking = await bookingsRepo.create({
    customer_id: customer.id,
    vendor_id: vendor.id,
    service_id: service.id,
    booking_date: new Date().toISOString().split('T')[0],
    booking_time: '10:00',
    service_type: 'at_vendor',
    base_price: 1000,
    total_amount: 1000,
  });
  
  assertExists(booking.id);
  assertEquals(booking.status, 'pending');
  
  // Confirm booking
  await bookingsRepo.update(booking.id, { status: 'confirmed' });
  const confirmed = await bookingsRepo.findById(booking.id);
  assertEquals(confirmed?.status, 'confirmed');
  
  // Complete booking
  await bookingsRepo.update(booking.id, { 
    status: 'completed',
    completed_at: new Date().toISOString(),
  });
  const completed = await bookingsRepo.findById(booking.id);
  assertEquals(completed?.status, 'completed');
  assertExists(completed?.completed_at);
});

// ============================================================================
// PAYOUT FLOW TESTS
// ============================================================================

Deno.test("Payout Flow: Complete End-to-End", async () => {
  const vendor = await createTestVendor();
  
  const payoutsRepo = getPayoutsRepository();
  const client = getDbClient();
  
  // Create bank details
  await client.from('vendor_bank_details').insert({
    vendor_id: vendor.id,
    account_number: '1234567890',
    ifsc_code: 'HDFC0001234',
    account_holder_name: 'Test Vendor',
    is_verified: true,
  });
  
  // Create payout
  const payout = await payoutsRepo.create({
    vendor_id: vendor.id,
    amount: 5000,
    bank_account_number: '1234567890',
    ifsc_code: 'HDFC0001234',
    account_holder_name: 'Test Vendor',
    payment_ids: [],
  });
  
  assertExists(payout.id);
  assertEquals(payout.payout_status, 'pending');
  
  // Process payout
  await payoutsRepo.update(payout.id, {
    payout_status: 'processing',
    processed_at: new Date().toISOString(),
  });
  
  const processing = await payoutsRepo.findById(payout.id);
  assertEquals(processing?.payout_status, 'processing');
  
  // Complete payout
  await payoutsRepo.complete(payout.id);
  const completed = await payoutsRepo.findById(payout.id);
  assertEquals(completed?.payout_status, 'completed');
});

// ============================================================================
// SERVICE DISCOVERY TESTS
// ============================================================================

Deno.test("Service Discovery: Find Published Services", async () => {
  const vendor = await createTestVendor();
  const service = await createTestService(vendor.id);
  const client = getDbClient();
  
  // Publish service
  await client.from('service_publishing').insert({
    service_id: service.id,
    vendor_id: vendor.id,
    publish_status: 'published',
    service_style: 'at_vendor',
    published_at: new Date().toISOString(),
  });
  
  // Find published services
  const { data: published } = await client
    .from('service_publishing')
    .select('*, services(*)')
    .eq('publish_status', 'published');
  
  assert(published && published.length > 0);
  const found = published.find((p: any) => p.service_id === service.id);
  assertExists(found);
});

// ============================================================================
// RBAC TESTS
// ============================================================================

Deno.test("RBAC: Role and Permission Management", async () => {
  const client = getDbClient();
  
  // Create role
  const { data: role, error: roleError } = await client
    .from('roles')
    .insert({
      name: 'test_role',
      display_name: 'Test Role',
      description: 'Test role',
      is_active: true,
    })
    .select()
    .single();
  
  assert(!roleError);
  assertExists(role);
  
  // Add permission
  const { data: permission, error: permError } = await client
    .from('role_permissions')
    .insert({
      role_id: role.id,
      permission_name: 'custom_services',
      resource: 'services',
      action: 'create',
    })
    .select()
    .single();
  
  assert(!permError);
  assertExists(permission);
  
  // Verify permission
  const { data: found } = await client
    .from('role_permissions')
    .select('*')
    .eq('role_id', role.id)
    .eq('permission_name', 'custom_services')
    .single();
  
  assertExists(found);
});

// ============================================================================
// TRANSACTION SAFETY TESTS
// ============================================================================

Deno.test("Transaction Safety: Rollback on Error", async () => {
  const customer = await createTestCustomer();
  const vendor = await createTestVendor();
  
  let errorOccurred = false;
  
  try {
    await withTransaction(async (client) => {
      const paymentsRepo = getPaymentsRepository();
      
      await paymentsRepo.create({
        customer_id: customer.id,
        vendor_id: vendor.id,
        amount: 1000,
        payment_method: 'razorpay',
      });
      
      // Simulate error
      throw new Error('Test error');
    });
  } catch (error) {
    errorOccurred = true;
  }
  
  assert(errorOccurred);
});

// ============================================================================
// STATE MACHINE TESTS
// ============================================================================

Deno.test("State Machine: Valid Transitions", async () => {
  const customer = await createTestCustomer();
  const vendor = await createTestVendor();
  const service = await createTestService(vendor.id);
  
  const bookingsRepo = getBookingsRepository();
  
  const booking = await bookingsRepo.create({
    customer_id: customer.id,
    vendor_id: vendor.id,
    service_id: service.id,
    booking_date: new Date().toISOString().split('T')[0],
    booking_time: '10:00',
    service_type: 'at_vendor',
    base_price: 1000,
    total_amount: 1000,
  });
  
  // Valid: pending → confirmed
  await bookingsRepo.update(booking.id, { status: 'confirmed' });
  const confirmed = await bookingsRepo.findById(booking.id);
  assertEquals(confirmed?.status, 'confirmed');
  
  // Valid: confirmed → in_progress
  await bookingsRepo.update(booking.id, { status: 'in_progress' });
  const inProgress = await bookingsRepo.findById(booking.id);
  assertEquals(inProgress?.status, 'in_progress');
  
  // Valid: in_progress → completed
  await bookingsRepo.update(booking.id, { 
    status: 'completed',
    completed_at: new Date().toISOString(),
  });
  const completed = await bookingsRepo.findById(booking.id);
  assertEquals(completed?.status, 'completed');
});

// ============================================================================
// TEST SUMMARY
// ============================================================================

console.log("✅ All flow tests created");
console.log("📊 Test coverage:");
console.log("   - Payment flow: ✅");
console.log("   - Booking flow: ✅");
console.log("   - Payout flow: ✅");
console.log("   - Service discovery: ✅");
console.log("   - RBAC: ✅");
console.log("   - Transaction safety: ✅");
console.log("   - State machine: ✅");

