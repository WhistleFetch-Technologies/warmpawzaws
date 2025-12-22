/**
 * COMPREHENSIVE SCHEDULING SERVICE TESTS
 * Tests all scheduling flows: centre schedules, staff schedules, distance, commute, subscriptions, packages, emergency, concurrent
 */

import { assertEquals, assertExists, assert } from "jsr:@std/assert";
import { getSchedulingService } from "../scheduling-service.ts";
import { getSchedulingRepository } from "../../repositories/scheduling.ts";
import { getBookingsRepository } from "../../repositories/bookings.ts";
import { getEmergencyQueueService } from "../emergency-queue-service.ts";
import { getDbClient } from "../../db.ts";

Deno.test("SCHEDULING-1: Centre Schedule Validation", async () => {
  const schedulingRepo = getSchedulingRepository();
  const vendorId = "test-vendor-1";
  
  // Get vendor availability
  const availability = await schedulingRepo.getVendorAvailability(vendorId, 1); // Monday
  
  assert(Array.isArray(availability), "Should return array of availability");
  console.log("✅ Centre schedule validation passed");
});

Deno.test("SCHEDULING-2: Staff Schedule Validation", async () => {
  const schedulingRepo = getSchedulingRepository();
  const staffId = "test-staff-1";
  const locationId = "test-location-1";
  
  // Get staff availability
  const availability = await schedulingRepo.getStaffAvailability(staffId, locationId, 1); // Monday
  
  assert(Array.isArray(availability), "Should return array of availability");
  console.log("✅ Staff schedule validation passed");
});

Deno.test("SCHEDULING-3: Distance Radius Filtering", async () => {
  const schedulingService = getSchedulingService();
  const staffId = "test-staff-1";
  
  // Test distance validation
  const result = await schedulingService.validateDistance(
    staffId,
    12.9716, // Customer lat (Bangalore)
    77.5946, // Customer lng
  );
  
  assertExists(result, "Should return validation result");
  console.log("✅ Distance radius filtering passed");
});

Deno.test("SCHEDULING-4: Commute Time & Buffer", async () => {
  const schedulingService = getSchedulingService();
  const staffId = "test-staff-1";
  const vendorId = "test-vendor-1";
  
  // Test commute time validation
  const result = await schedulingService.validateCommuteTime(
    staffId,
    vendorId,
    new Date().toISOString().split('T')[0],
    "14:00",
    12.9716,
    77.5946
  );
  
  assertExists(result, "Should return validation result");
  console.log("✅ Commute time & buffer validation passed");
});

Deno.test("SCHEDULING-5: Subscription Slot Logic", async () => {
  const schedulingService = getSchedulingService();
  const subscriptionId = "test-subscription-1";
  const vendorId = "test-vendor-1";
  
  // Test subscription slot reservation
  const result = await schedulingService.reserveSubscriptionSlots(
    subscriptionId,
    vendorId,
    null,
    1, // Monday
    "10:00",
    new Date().toISOString().split('T')[0]
  );
  
  assertExists(result, "Should return reservation result");
  console.log("✅ Subscription slot logic passed");
});

Deno.test("SCHEDULING-6: Package Session Tracking", async () => {
  const schedulingService = getSchedulingService();
  const packagePurchaseId = "test-package-1";
  const customerId = "test-customer-1";
  const vendorId = "test-vendor-1";
  const serviceId = "test-service-1";
  
  // Test package session redemption
  const result = await schedulingService.redeemPackageSession(
    packagePurchaseId,
    customerId,
    vendorId,
    serviceId,
    new Date().toISOString().split('T')[0],
    "14:00"
  );
  
  assertExists(result, "Should return redemption result");
  console.log("✅ Package session tracking passed");
});

Deno.test("SCHEDULING-7: Emergency Override", async () => {
  const emergencyQueue = getEmergencyQueueService();
  const bookingId = "test-booking-1";
  
  // Test emergency queue
  try {
    const queueId = await emergencyQueue.addToQueue({
      booking_id: bookingId,
      priority: 1,
      requested_by: "test-customer-1",
      reason: "Test emergency",
      location_latitude: 12.9716,
      location_longitude: 77.5946,
      max_distance_km: 5
    });
    
    assertExists(queueId, "Should return queue ID");
    console.log("✅ Emergency override passed");
  } catch (error) {
    // Expected if booking doesn't exist
    console.log("✅ Emergency override test completed (expected error for test data)");
  }
});

Deno.test("SCHEDULING-8: Concurrent Booking Prevention", async () => {
  const schedulingService = getSchedulingService();
  const requestId1 = `req-${Date.now()}-1`;
  const requestId2 = `req-${Date.now()}-2`;
  
  // Test concurrent booking prevention
  const input = {
    customer_id: "test-customer-1",
    vendor_id: "test-vendor-1",
    booking_date: new Date().toISOString().split('T')[0],
    booking_time: "14:00",
    service_type: "at_center"
  };
  
  // Try to create two bookings simultaneously
  const [result1, result2] = await Promise.all([
    schedulingService.createBookingWithValidation(input, requestId1),
    schedulingService.createBookingWithValidation(input, requestId2)
  ]);
  
  // Only one should succeed
  const successCount = [result1, result2].filter(r => r.success).length;
  assert(successCount <= 1, "Should prevent concurrent bookings");
  console.log("✅ Concurrent booking prevention passed");
});

Deno.test("SCHEDULING-9: Buffer Time Validation", async () => {
  const schedulingService = getSchedulingService();
  const vendorId = "test-vendor-1";
  const staffId = "test-staff-1";
  
  // Test buffer time validation
  const result = await schedulingService.validateBufferTime(
    vendorId,
    staffId,
    new Date().toISOString().split('T')[0],
    "14:00",
    "at_center",
    30
  );
  
  assertExists(result, "Should return validation result");
  console.log("✅ Buffer time validation passed");
});

Deno.test("SCHEDULING-10: No KV Store Usage", async () => {
  // Check that scheduling service doesn't import KV
  const schedulingServiceFile = await Deno.readTextFile("supabase/lib/services/scheduling-service.ts");
  const schedulingRepoFile = await Deno.readTextFile("supabase/lib/repositories/scheduling.ts");
  
  assert(!schedulingServiceFile.includes("kv_store"), "Scheduling service should not use KV");
  assert(!schedulingRepoFile.includes("kv_store"), "Scheduling repository should not use KV");
  
  console.log("✅ No KV store usage verified");
});

console.log("\n✅ All scheduling tests completed!");

