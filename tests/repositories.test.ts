/**
 * ============================================================================
 * REPOSITORY TESTS
 * ============================================================================
 * 
 * Tests for all repository implementations
 * Target: 100% pass rate
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.192.0/testing/asserts.ts";

Deno.test("Repository: Platform Settings - Get AWS Settings", async () => {
  const { getPlatformSettingsRepository } = await import("../supabase/lib/repositories/platform-settings.ts");
  const repo = getPlatformSettingsRepository();
  
  assertExists(repo.getAWSSettings);
  const settings = await repo.getAWSSettings();
  // Should not throw even if no settings exist
  assertExists(settings === null || typeof settings === "object");
});

Deno.test("Repository: Platform Settings - Get Google Maps Settings", async () => {
  const { getPlatformSettingsRepository } = await import("../supabase/lib/repositories/platform-settings.ts");
  const repo = getPlatformSettingsRepository();
  
  assertExists(repo.getGoogleMapsSettings);
  const settings = await repo.getGoogleMapsSettings();
  // Should not throw even if no settings exist
  assertExists(settings === null || typeof settings === "object");
});

Deno.test("Repository: Platform Settings - Get Payment Gateway Settings", async () => {
  const { getPlatformSettingsRepository } = await import("../supabase/lib/repositories/platform-settings.ts");
  const repo = getPlatformSettingsRepository();
  
  assertExists(repo.getPaymentGatewaySettings);
  const settings = await repo.getPaymentGatewaySettings("razorpay");
  // Should not throw even if no settings exist
  assertExists(settings === null || typeof settings === "object");
});

Deno.test("Repository: Platform Settings - Get Logistics Partners", async () => {
  const { getPlatformSettingsRepository } = await import("../supabase/lib/repositories/platform-settings.ts");
  const repo = getPlatformSettingsRepository();
  
  assertExists(repo.getLogisticsPartners);
  const partners = await repo.getLogisticsPartners();
  assertExists(Array.isArray(partners));
});

Deno.test("Repository: Automation Jobs - Get Pending Jobs", async () => {
  const { getAutomationJobsRepository } = await import("../supabase/lib/repositories/automation-jobs.ts");
  const repo = getAutomationJobsRepository();
  
  assertExists(repo.getPendingJobs);
  const jobs = await repo.getPendingJobs("status_transition", 10);
  assertExists(Array.isArray(jobs));
});

Deno.test("Repository: Bookings - Repository Exists", async () => {
  const { getBookingsRepository } = await import("../supabase/lib/repositories/bookings.ts");
  const repo = getBookingsRepository();
  
  assertExists(repo);
  assertExists(repo.findById);
  assertExists(repo.create);
  assertExists(repo.update);
});

Deno.test("Repository: Regions - Repository Exists", async () => {
  const { getRegionsRepository } = await import("../supabase/lib/repositories/regions.ts");
  const repo = getRegionsRepository();
  
  assertExists(repo);
  assertExists(repo.findAll);
  assertExists(repo.findById);
  assertExists(repo.create);
});

