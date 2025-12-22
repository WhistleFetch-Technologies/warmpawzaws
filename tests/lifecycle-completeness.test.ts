/**
 * ============================================================================
 * LIFECYCLE COMPLETENESS TESTS
 * ============================================================================
 * 
 * Tests for all lifecycle completeness handlers
 * Target: 100% pass rate
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { assertEquals, assertExists, assertRejects } from "https://deno.land/std@0.192.0/testing/asserts.ts";

Deno.test("Lifecycle: Insurance Claim - Submit Claim", async () => {
  const { submitInsuranceClaim } = await import("../supabase/lib/services/insurance-claim-handlers.ts");
  assertExists(submitInsuranceClaim);
  
  // Test that function exists and handles invalid booking
  await assertRejects(
    async () => {
      await submitInsuranceClaim("invalid-booking-id", {
        claim_type: "medical",
        claim_amount: 1000,
        claim_description: "Test claim",
      });
    },
    Error,
    "Booking not found"
  );
});

Deno.test("Lifecycle: Insurance Claim - Process Claim", async () => {
  const { processInsuranceClaim } = await import("../supabase/lib/services/insurance-claim-handlers.ts");
  assertExists(processInsuranceClaim);
  
  // Test that function exists and handles invalid claim
  await assertRejects(
    async () => {
      await processInsuranceClaim("invalid-claim-id", "approve", "admin-1");
    },
    Error,
    "Claim not found"
  );
});

Deno.test("Lifecycle: Subscription - Create Subscription", async () => {
  const { createSubscription } = await import("../supabase/lib/services/subscription-lifecycle.ts");
  assertExists(createSubscription);
  
  // Test that function exists and handles invalid booking
  await assertRejects(
    async () => {
      await createSubscription("invalid-booking-id", {
        subscription_type: "monthly",
        billing_amount: 1000,
        start_date: new Date().toISOString().split("T")[0],
      });
    },
    Error,
    "Booking not found"
  );
});

Deno.test("Lifecycle: Subscription - Pause/Resume", async () => {
  const { pauseSubscription, resumeSubscription } = await import("../supabase/lib/services/subscription-lifecycle.ts");
  assertExists(pauseSubscription);
  assertExists(resumeSubscription);
  
  // Test that functions exist
  await assertRejects(
    async () => {
      await pauseSubscription("invalid-subscription-id");
    },
    Error
  );
});

Deno.test("Lifecycle: Subscription - Process Renewals", async () => {
  const { processPendingRenewals } = await import("../supabase/lib/services/subscription-lifecycle.ts");
  assertExists(processPendingRenewals);
  
  // Test that function exists and returns stats
  const stats = await processPendingRenewals();
  assertExists(stats);
  assertEquals(typeof stats.processed, "number");
  assertEquals(typeof stats.failed, "number");
});

Deno.test("Lifecycle: Adoption - Create Application", async () => {
  const { createAdoptionApplication } = await import("../supabase/lib/services/adoption-approval.ts");
  assertExists(createAdoptionApplication);
  
  // Test that function exists and handles invalid booking
  await assertRejects(
    async () => {
      await createAdoptionApplication("invalid-booking-id", {
        pet_id: "pet-1",
        application_data: {},
      });
    },
    Error,
    "Booking not found"
  );
});

Deno.test("Lifecycle: Adoption - Approve/Reject", async () => {
  const { approveAdoption, rejectAdoption } = await import("../supabase/lib/services/adoption-approval.ts");
  assertExists(approveAdoption);
  assertExists(rejectAdoption);
  
  // Test that functions exist
  await assertRejects(
    async () => {
      await approveAdoption("invalid-application-id", "admin-1");
    },
    Error
  );
});

Deno.test("Lifecycle: Post-Service Payment - Create Payment", async () => {
  const { createPostServicePayment } = await import("../supabase/lib/services/post-service-payment.ts");
  assertExists(createPostServicePayment);
  
  // Test that function exists and handles invalid booking
  await assertRejects(
    async () => {
      await createPostServicePayment("invalid-booking-id", 1000);
    },
    Error,
    "Booking not found"
  );
});

Deno.test("Lifecycle: Package Milestones - Create Milestones", async () => {
  const { createPackageMilestones } = await import("../supabase/lib/services/package-milestone-tracking.ts");
  assertExists(createPackageMilestones);
  
  // Test that function exists and handles invalid booking
  await assertRejects(
    async () => {
      await createPackageMilestones("invalid-booking-id", {
        total_milestones: 5,
        milestone_type: "day",
        start_date: new Date().toISOString().split("T")[0],
      });
    },
    Error,
    "Booking not found"
  );
});

Deno.test("Lifecycle: Package Milestones - Complete Milestone", async () => {
  const { completeMilestone } = await import("../supabase/lib/services/package-milestone-tracking.ts");
  assertExists(completeMilestone);
  
  // Test that function exists
  await assertRejects(
    async () => {
      await completeMilestone("invalid-milestone-id", "staff-1");
    },
    Error,
    "Milestone not found"
  );
});

Deno.test("Lifecycle: Refund Handler - Process Refund", async () => {
  const { processRefund } = await import("../supabase/lib/services/refund-handlers.ts");
  assertExists(processRefund);
  
  // Test that function exists and handles invalid payment
  const result = await processRefund("invalid-payment-id", {
    reason: "Test refund",
  });
  
  assertEquals(result.success, false);
  assertExists(result.error);
});

Deno.test("Lifecycle: Validator - Validate All Services", async () => {
  const { validateAllServices } = await import("../supabase/lib/services/booking-lifecycle-validator.ts");
  assertExists(validateAllServices);
  
  const results = validateAllServices();
  assertExists(results);
  
  // Check that all services are validated
  const serviceCount = Object.keys(results).length;
  assertEquals(serviceCount, 13);
  
  // Check that no service has critical gaps
  const servicesWithCriticalGaps = Object.values(results).filter(g => 
    g.missing_payment || g.missing_refund || g.missing_settlement || g.missing_completion
  );
  
  assertEquals(servicesWithCriticalGaps.length, 0, "All services should have complete lifecycle");
});

Deno.test("Lifecycle: Validator - Generate Gap Report", async () => {
  const { generateGapReport } = await import("../supabase/lib/services/booking-lifecycle-validator.ts");
  assertExists(generateGapReport);
  
  const report = generateGapReport();
  assertExists(report);
  assertEquals(typeof report, "string");
  assertEquals(report.length > 0, true);
  
  // Check that report indicates no critical gaps
  const hasNoCriticalGaps = report.includes("✅ Outcome: No service skips payment, refund, settlement, or completion");
  assertEquals(hasNoCriticalGaps, true, "Report should indicate no critical gaps");
});

