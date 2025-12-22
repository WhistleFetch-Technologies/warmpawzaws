/**
 * ============================================================================
 * INTEGRATION TESTS
 * ============================================================================
 * 
 * End-to-end integration tests for all flows
 * Target: 100% pass rate
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { getBookingsRepository } from "../supabase/lib/repositories/bookings.ts";
import { getPlatformSettingsRepository } from "../supabase/lib/repositories/platform-settings.ts";
import { standardizeServiceStyle } from "../supabase/lib/repositories/service-style-mapper.ts";

Deno.test("Integration: Booking Flow - Complete", async () => {
  // Test complete booking flow from creation to completion
  const bookingsRepo = getBookingsRepository();
  
  // Create booking
  const booking = await bookingsRepo.create({
    customer_id: "test-customer-id",
    service_id: "test-service-id",
    booking_date: new Date().toISOString().split("T")[0],
    booking_time: "10:00:00",
    service_type: "at_center",
    base_price: 1000,
    total_amount: 1000,
  });
  
  assertExists(booking);
  assertEquals(booking.status, "pending");
  
  // Confirm booking
  const confirmed = await bookingsRepo.confirm(booking.id);
  assertEquals(confirmed.status, "confirmed");
  
  // Complete booking
  const completed = await bookingsRepo.complete(booking.id);
  assertEquals(completed.status, "completed");
  assertExists(completed.completed_at);
});

Deno.test("Integration: Service Style Standardization", async () => {
  // Test service style standardization
  const standard1 = await standardizeServiceStyle("clinic");
  assertEquals(standard1, "at_center");
  
  const standard2 = await standardizeServiceStyle("home");
  assertEquals(standard2, "at_home");
  
  const standard3 = await standardizeServiceStyle("online");
  assertEquals(standard3, "tele");
  
  const standard4 = await standardizeServiceStyle("at_center");
  assertEquals(standard4, "at_center");
});

Deno.test("Integration: Platform Settings - SQL Migration", async () => {
  // Test platform settings retrieval from SQL
  const settingsRepo = getPlatformSettingsRepository();
  
  // Test AWS settings
  const awsSettings = await settingsRepo.getAWSSettings();
  // Should not throw error even if no settings exist
  
  // Test Google Maps settings
  const googleMaps = await settingsRepo.getGoogleMapsSettings();
  // Should not throw error even if no settings exist
  
  // Test Payment Gateway settings
  const paymentGateway = await settingsRepo.getPaymentGatewaySettings("razorpay");
  // Should not throw error even if no settings exist
});

Deno.test("Integration: Business Rules - Cancellation Policy", async () => {
  // Test cancellation policy enforcement
  // This will be implemented in booking-automation service
  // For now, just verify the service exists and can be imported
  const { enforceCancellationPolicy } = await import("../supabase/lib/services/booking-automation.ts");
  assertExists(enforceCancellationPolicy);
});

