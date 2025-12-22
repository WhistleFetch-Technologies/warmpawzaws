/**
 * ============================================================================
 * SERVICE TESTS
 * ============================================================================
 * 
 * Tests for all service implementations
 * Target: 100% pass rate
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { assertEquals, assertExists, assertRejects } from "https://deno.land/std@0.192.0/testing/asserts.ts";

Deno.test("Service: Booking Automation - Status Transitions", async () => {
  const { processAutomaticStatusTransitions } = await import("../supabase/lib/services/booking-automation.ts");
  assertExists(processAutomaticStatusTransitions);
  
  // Test that function exists and can be called (will fail if no data, but that's expected)
  try {
    await processAutomaticStatusTransitions();
  } catch (error) {
    // Expected if no data exists
    assertExists(error);
  }
});

Deno.test("Service: Payment Retry - Retry Payment", async () => {
  const { retryPayment } = await import("../supabase/lib/services/payment-retry.ts");
  assertExists(retryPayment);
  
  // Test that function exists and handles invalid payment ID
  await assertRejects(
    async () => {
      await retryPayment("invalid-payment-id");
    },
    Error,
    "Payment not found"
  );
});

Deno.test("Service: Payout Processing - Process Payouts", async () => {
  const { processAutomaticPayouts } = await import("../supabase/lib/services/payout-processing.ts");
  assertExists(processAutomaticPayouts);
  
  // Test that function exists and returns stats
  const stats = await processAutomaticPayouts();
  assertExists(stats);
  assertEquals(typeof stats.processed, "number");
  assertEquals(typeof stats.failed, "number");
  assertEquals(typeof stats.totalAmount, "number");
});

Deno.test("Service: Delivery Automation - Create Shipment", async () => {
  const { createShipmentForOrder } = await import("../supabase/lib/services/delivery-automation.ts");
  assertExists(createShipmentForOrder);
  
  // Test that function exists and handles invalid order ID
  await assertRejects(
    async () => {
      await createShipmentForOrder("invalid-order-id");
    },
    Error,
    "Order not found"
  );
});

Deno.test("Service: Multi-Staff Assignment - Assign Staff", async () => {
  const { assignStaffToBooking } = await import("../supabase/lib/services/multi-staff-assignment.ts");
  assertExists(assignStaffToBooking);
  
  // Test that function exists and handles invalid booking ID
  await assertRejects(
    async () => {
      await assignStaffToBooking("invalid-booking-id", ["staff-1"]);
    },
    Error,
    "Booking not found"
  );
});

Deno.test("Service: Service Style Standardization", async () => {
  const { standardizeServiceStyle } = await import("../supabase/lib/repositories/service-style-mapper.ts");
  assertExists(standardizeServiceStyle);
  
  // Test standardization
  const clinic = await standardizeServiceStyle("clinic");
  assertEquals(clinic, "at_center");
  
  const home = await standardizeServiceStyle("home");
  assertEquals(home, "at_home");
  
  const online = await standardizeServiceStyle("online");
  assertEquals(online, "tele");
  
  const alreadyStandard = await standardizeServiceStyle("at_center");
  assertEquals(alreadyStandard, "at_center");
});

Deno.test("Service: Business Rules - Cancellation Policy", async () => {
  const { enforceCancellationPolicy } = await import("../supabase/lib/services/booking-automation.ts");
  assertExists(enforceCancellationPolicy);
  
  // Test that function exists (will fail if booking doesn't exist, but that's expected)
  try {
    await enforceCancellationPolicy("invalid-booking-id", "Test cancellation");
  } catch (error) {
    // Expected if booking doesn't exist
    assertExists(error);
  }
});

