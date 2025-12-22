#!/usr/bin/env -S deno run --allow-all
/**
 * ============================================================================
 * LIFECYCLE COMPLETENESS VALIDATION SCRIPT
 * ============================================================================
 * 
 * Validates that all services have complete lifecycle
 * Run: deno run --allow-all validate-lifecycle-completeness.ts
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { validateAllServices, generateGapReport } from "./supabase/lib/services/booking-lifecycle-validator.ts";

console.log("🔍 Validating Lifecycle Completeness...\n");

const results = validateAllServices();
const report = generateGapReport();

// Count gaps
let criticalGaps = 0;
let totalGaps = 0;

for (const [serviceKey, gap] of Object.entries(results)) {
  const serviceGaps = [
    gap.missing_payment,
    gap.missing_refund,
    gap.missing_settlement,
    gap.missing_completion,
    gap.missing_states.length > 0,
    gap.invalid_transitions.length > 0,
    gap.missing_handlers.length > 0,
  ].filter(Boolean).length;
  
  if (serviceGaps > 0) {
    totalGaps += serviceGaps;
    if (gap.missing_payment || gap.missing_refund || gap.missing_settlement || gap.missing_completion) {
      criticalGaps++;
    }
  }
}

console.log("📊 Validation Results:");
console.log(`   Total Services: ${Object.keys(results).length}`);
console.log(`   Services with Gaps: ${Object.values(results).filter(g => 
  g.missing_payment || g.missing_refund || g.missing_settlement || g.missing_completion ||
  g.missing_states.length > 0 || g.invalid_transitions.length > 0 || g.missing_handlers.length > 0
).length}`);
console.log(`   Critical Gaps: ${criticalGaps}`);
console.log(`   Total Gaps: ${totalGaps}\n`);

if (criticalGaps === 0 && totalGaps === 0) {
  console.log("✅ SUCCESS: All services have complete lifecycle!");
  console.log("✅ No service skips payment, refund, settlement, or completion");
  console.log("\n📄 Full Report:");
  console.log(report);
  Deno.exit(0);
} else {
  console.log("❌ FAILURE: Some services have gaps");
  console.log("\n📄 Full Report:");
  console.log(report);
  Deno.exit(1);
}

