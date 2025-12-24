/**
 * ============================================================================
 * BOOKING MANAGEMENT AUDIT TEST
 * ============================================================================
 * 
 * Tests booking management to ensure:
 * 1. SQL table exists (bookings)
 * 2. Repository methods work correctly
 * 3. Endpoints use SQL only (no KV)
 * 4. Status transitions are valid
 * 5. Lifecycle management works
 * 
 * Target: 100% pass rate
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { assertEquals, assertExists, assert } from "jsr:@std/assert@0.224.0";
import { getBookingsRepository } from "../supabase/lib/repositories/bookings.ts";
import { getDbClient } from "../supabase/lib/db.ts";

Deno.test("Booking Management - SQL Table Exists", async () => {
  const supabase = getDbClient();
  
  // Check bookings table
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*')
    .limit(1);
  
  assert(!error, `bookings table should exist: ${error?.message}`);
  console.log("✅ bookings table exists");
});

Deno.test("Booking Management - No KV Usage", async () => {
  // Check booking endpoints
  const bookingFile = await Deno.readTextFile(
    "supabase/functions/make-server-3dd53475/booking-endpoints-refactored.tsx"
  );
  
  assert(!bookingFile.includes("kv_store"), "Booking endpoints should not import kv_store");
  assert(!bookingFile.includes("kv.get"), "Booking endpoints should not use kv.get");
  assert(!bookingFile.includes("kv.set"), "Booking endpoints should not use kv.set");
  assert(bookingFile.includes("BookingsRepository"), "Booking endpoints should use BookingsRepository");
  console.log("✅ Booking endpoints use SQL only (no KV)");
});

Deno.test("Booking Management - Repository Methods", async () => {
  const bookingsRepo = getBookingsRepository();
  
  // Test repository methods exist
  assert(typeof bookingsRepo.create === 'function', "BookingsRepository should have create method");
  assert(typeof bookingsRepo.findById === 'function', "BookingsRepository should have findById method");
  assert(typeof bookingsRepo.findByCustomer === 'function', "BookingsRepository should have findByCustomer method");
  assert(typeof bookingsRepo.confirm === 'function', "BookingsRepository should have confirm method");
  assert(typeof bookingsRepo.complete === 'function', "BookingsRepository should have complete method");
  assert(typeof bookingsRepo.cancel === 'function', "BookingsRepository should have cancel method");
  console.log("✅ BookingsRepository methods exist");
});

Deno.test("Booking Management - Status Transitions", async () => {
  const bookingsRepo = getBookingsRepository();
  const testCustomerId = "test-customer-booking";
  const testServiceId = "test-service-id";
  
  // Create booking
  const booking = await bookingsRepo.create({
    customer_id: testCustomerId,
    service_id: testServiceId,
    booking_date: new Date().toISOString().split("T")[0],
    booking_time: "10:00:00",
    service_type: "at_center",
    base_price: 1000,
    total_amount: 1000,
  });
  
  assertExists(booking.id, "Booking should have an ID");
  assertEquals(booking.status, "pending", "New booking should have pending status");
  console.log(`✅ Booking created: ${booking.id}, status: ${booking.status}`);
  
  // Confirm booking
  const confirmed = await bookingsRepo.confirm(booking.id);
  assertEquals(confirmed.status, "confirmed", "Confirmed booking should have confirmed status");
  assertExists(confirmed.confirmed_at, "Confirmed booking should have confirmed_at timestamp");
  console.log(`✅ Booking confirmed: ${confirmed.id}, status: ${confirmed.status}`);
  
  // Complete booking
  const completed = await bookingsRepo.complete(booking.id);
  assertEquals(completed.status, "completed", "Completed booking should have completed status");
  assertExists(completed.completed_at, "Completed booking should have completed_at timestamp");
  console.log(`✅ Booking completed: ${completed.id}, status: ${completed.status}`);
});

Deno.test("Booking Management - Lifecycle Validation", async () => {
  const bookingsRepo = getBookingsRepository();
  const testCustomerId = "test-customer-lifecycle";
  
  // Create booking
  const booking = await bookingsRepo.create({
    customer_id: testCustomerId,
    service_id: "test-service",
    booking_date: new Date().toISOString().split("T")[0],
    booking_time: "10:00:00",
    service_type: "at_center",
    base_price: 1000,
    total_amount: 1000,
  });
  
  // Verify lifecycle stages
  const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'refunded'];
  assert(validStatuses.includes(booking.status), `Booking status should be one of: ${validStatuses.join(', ')}`);
  console.log(`✅ Booking lifecycle validated: ${booking.status}`);
  
  // Test cancellation
  const cancelled = await bookingsRepo.cancel(booking.id, "Test cancellation");
  assertEquals(cancelled.status, "cancelled", "Cancelled booking should have cancelled status");
  assertExists(cancelled.cancelled_at, "Cancelled booking should have cancelled_at timestamp");
  console.log(`✅ Booking cancellation validated: ${cancelled.status}`);
});

console.log("✅ All booking management audit tests defined");

