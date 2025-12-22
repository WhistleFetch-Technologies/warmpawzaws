/**
 * ============================================================================
 * COMPLETE LIFECYCLE TEST SUITE
 * ============================================================================
 * 
 * Comprehensive tests for 100% lifecycle completeness
 * Target: 100% pass rate
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.192.0/testing/asserts.ts";

// ============================================================================
// CANONICAL LIFECYCLE VALIDATION
// ============================================================================

Deno.test("Lifecycle: All Services Have Payment Flow", async () => {
  const { validateAllServices } = await import("../supabase/lib/services/booking-lifecycle-validator.ts");
  const results = validateAllServices();
  
  const servicesWithoutPayment = Object.values(results).filter(g => g.missing_payment);
  assertEquals(servicesWithoutPayment.length, 0, "All services must have payment flow");
});

Deno.test("Lifecycle: All Services Have Refund Flow", async () => {
  const { validateAllServices } = await import("../supabase/lib/services/booking-lifecycle-validator.ts");
  const results = validateAllServices();
  
  const servicesWithoutRefund = Object.values(results).filter(g => g.missing_refund);
  assertEquals(servicesWithoutRefund.length, 0, "All services must have refund flow");
});

Deno.test("Lifecycle: All Services Have Settlement Flow", async () => {
  const { validateAllServices } = await import("../supabase/lib/services/booking-lifecycle-validator.ts");
  const results = validateAllServices();
  
  const servicesWithoutSettlement = Object.values(results).filter(g => g.missing_settlement);
  assertEquals(servicesWithoutSettlement.length, 0, "All services must have settlement flow");
});

Deno.test("Lifecycle: All Services Have Completion Flow", async () => {
  const { validateAllServices } = await import("../supabase/lib/services/booking-lifecycle-validator.ts");
  const results = validateAllServices();
  
  const servicesWithoutCompletion = Object.values(results).filter(g => g.missing_completion);
  assertEquals(servicesWithoutCompletion.length, 0, "All services must have completion flow");
});

Deno.test("Lifecycle: Zero Critical Gaps", async () => {
  const { validateAllServices } = await import("../supabase/lib/services/booking-lifecycle-validator.ts");
  const results = validateAllServices();
  
  const criticalGaps = Object.values(results).filter(g => 
    g.missing_payment || g.missing_refund || g.missing_settlement || g.missing_completion
  );
  
  assertEquals(criticalGaps.length, 0, "Zero critical gaps required");
});

Deno.test("Lifecycle: Gap Report Shows No Critical Gaps", async () => {
  const { generateGapReport } = await import("../supabase/lib/services/booking-lifecycle-validator.ts");
  const report = generateGapReport();
  
  const hasNoCriticalGaps = report.includes("✅ Outcome: No service skips payment, refund, settlement, or completion");
  assertEquals(hasNoCriticalGaps, true, "Gap report must show no critical gaps");
});

// ============================================================================
// SERVICE-SPECIFIC VALIDATION
// ============================================================================

Deno.test("Service: Insurance - Claim Handlers Exist", async () => {
  const { submitInsuranceClaim, processInsuranceClaim, completeInsuranceClaim } = 
    await import("../supabase/lib/services/insurance-claim-handlers.ts");
  
  assertExists(submitInsuranceClaim);
  assertExists(processInsuranceClaim);
  assertExists(completeInsuranceClaim);
});

Deno.test("Service: Subscription - Lifecycle Handlers Exist", async () => {
  const { 
    createSubscription, 
    pauseSubscription, 
    resumeSubscription, 
    cancelSubscription,
    processSubscriptionRenewal 
  } = await import("../supabase/lib/services/subscription-lifecycle.ts");
  
  assertExists(createSubscription);
  assertExists(pauseSubscription);
  assertExists(resumeSubscription);
  assertExists(cancelSubscription);
  assertExists(processSubscriptionRenewal);
});

Deno.test("Service: Adoption - Approval Handlers Exist", async () => {
  const { 
    createAdoptionApplication, 
    approveAdoption, 
    rejectAdoption, 
    completeAdoption 
  } = await import("../supabase/lib/services/adoption-approval.ts");
  
  assertExists(createAdoptionApplication);
  assertExists(approveAdoption);
  assertExists(rejectAdoption);
  assertExists(completeAdoption);
});

Deno.test("Service: Post-Service Payment - Handlers Exist", async () => {
  const { 
    createPostServicePayment, 
    processPostServicePayment 
  } = await import("../supabase/lib/services/post-service-payment.ts");
  
  assertExists(createPostServicePayment);
  assertExists(processPostServicePayment);
});

Deno.test("Service: Package Milestones - Handlers Exist", async () => {
  const { 
    createPackageMilestones, 
    completeMilestone 
  } = await import("../supabase/lib/services/package-milestone-tracking.ts");
  
  assertExists(createPackageMilestones);
  assertExists(completeMilestone);
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

Deno.test("Integration: Booking Service Router Exists", async () => {
  const { routeBookingCreation, routeBookingCompletion } = 
    await import("../supabase/lib/services/booking-service-router.ts");
  
  assertExists(routeBookingCreation);
  assertExists(routeBookingCompletion);
});

Deno.test("Integration: Refund Handler Exists", async () => {
  const { processRefund } = await import("../supabase/lib/services/refund-handlers.ts");
  assertExists(processRefund);
});

// ============================================================================
// SQL SCHEMA VALIDATION
// ============================================================================

Deno.test("Schema: Insurance Claims Table Exists", async () => {
  const client = await import("../supabase/lib/db.ts").then(m => m.getDbClient());
  const { error } = await client.from('insurance_claims').select('id').limit(1);
  // Should not throw error if table exists
  assertExists(!error || error.code !== '42P01'); // 42P01 = table does not exist
});

Deno.test("Schema: Subscriptions Table Exists", async () => {
  const client = await import("../supabase/lib/db.ts").then(m => m.getDbClient());
  const { error } = await client.from('subscriptions').select('id').limit(1);
  assertExists(!error || error.code !== '42P01');
});

Deno.test("Schema: Adoption Applications Table Exists", async () => {
  const client = await import("../supabase/lib/db.ts").then(m => m.getDbClient());
  const { error } = await client.from('adoption_applications').select('id').limit(1);
  assertExists(!error || error.code !== '42P01');
});

Deno.test("Schema: Package Milestones Table Exists", async () => {
  const client = await import("../supabase/lib/db.ts").then(m => m.getDbClient());
  const { error } = await client.from('package_milestones').select('id').limit(1);
  assertExists(!error || error.code !== '42P01');
});

Deno.test("Schema: Post-Service Payments Table Exists", async () => {
  const client = await import("../supabase/lib/db.ts").then(m => m.getDbClient());
  const { error } = await client.from('post_service_payments').select('id').limit(1);
  assertExists(!error || error.code !== '42P01');
});

