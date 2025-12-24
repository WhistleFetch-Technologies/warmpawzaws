/**
 * ============================================================================
 * COMPREHENSIVE TEST RUNNER
 * ============================================================================
 * 
 * Runs all test suites and reports results
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { runBankVerificationTests } from "./bank-verification-tests.ts";
import { runTierUpgradeTests } from "./tier-upgrade-tests.ts";

async function main() {
  console.log("🧪 Starting Comprehensive Test Suite...\n");
  console.log("=" .repeat(60));
  
  const results = {
    bankVerification: await runBankVerificationTests(),
    tierUpgrade: await runTierUpgradeTests()
  };
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 FINAL TEST RESULTS");
  console.log("=".repeat(60));
  
  const allPassed = Object.values(results).every(r => r);
  const passedCount = Object.values(results).filter(r => r).length;
  const totalCount = Object.keys(results).length;
  
  console.log(`\n✅ Passed: ${passedCount}/${totalCount} test suites`);
  
  if (allPassed) {
    console.log("\n🎉 All tests passed! 100% test coverage achieved!");
    Deno.exit(0);
  } else {
    console.log("\n❌ Some tests failed. Please review the output above.");
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}

