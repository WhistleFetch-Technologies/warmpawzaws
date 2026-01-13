/**
 * FIX AND TEST RUNNER
 * 
 * Runs tests one by one, fixes failures, then moves to next
 */

import { TestExecutionEngine, TestResult } from './test-execution-engine';
import { adminTests } from './test-scenarios/admin-tests';
import * as fs from 'fs';
import * as path from 'path';

// Load environment
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '.env') });

const config = {
  testResultsDir: './test-results/ui-e2e',
  reportDir: './test-results/reports',
};

// Focus on first failing tests
const failingTests = [
  'admin-001', // View Vendor List
  'admin-050', // Configure Refund Policy
  'admin-051', // Configure Cancellation Policy
  'admin-052', // Configure GST Slabs
  'admin-053', // Configure Commission Tiers
  'admin-055', // Manual Settlement Override
  'admin-200', // View Revenue Analytics
];

async function fixAndTest() {
  const engine = new TestExecutionEngine();
  await engine.initialize();

  console.log('\n🔧 FIX AND TEST MODE');
  console.log('='.repeat(60));
  console.log(`Focusing on ${failingTests.length} failing tests\n`);

  const results: TestResult[] = [];

  for (const testId of failingTests) {
    const test = adminTests.find(t => t.id === testId);
    if (!test) {
      console.log(`⚠️  Test ${testId} not found, skipping`);
      continue;
    }

    console.log(`\n🔍 Testing: ${test.name} (${test.id})`);
    console.log('-'.repeat(60));

    try {
      const result = await engine.executeTest(test);
      results.push(result);

      if (result.status === 'passed') {
        console.log(`✅ PASSED: ${test.name}`);
      } else {
        console.log(`❌ FAILED: ${test.name}`);
        console.log(`   Error: ${result.error || 'Unknown error'}`);
        
        // Show API results
        if (result.apiResults.length > 0) {
          result.apiResults.forEach(apiResult => {
            console.log(`   API: ${apiResult.endpoint} - Status: ${apiResult.status} - ${apiResult.passed ? '✅' : '❌'}`);
            if (!apiResult.passed && apiResult.error) {
              console.log(`      Error: ${apiResult.error}`);
            }
          });
        }

        // Don't proceed to next test until this one passes
        console.log(`\n⏸️  Stopping - Fix required for ${test.id} before proceeding`);
        break;
      }
    } catch (error: any) {
      console.error(`❌ ERROR: ${test.name}`, error.message);
      break;
    }
  }

  await engine.cleanup();

  // Summary
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;

  console.log('\n' + '='.repeat(60));
  console.log('📊 FIX AND TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📊 Total: ${results.length}`);
  console.log('='.repeat(60));
}

fixAndTest().catch(console.error);
