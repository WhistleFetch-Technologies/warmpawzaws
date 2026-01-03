#!/usr/bin/env ts-node
/**
 * ============================================================================
 * COMPREHENSIVE TEST RUNNER
 * ============================================================================
 * 
 * Runs all endpoint tests against the Lambda handlers
 * 
 * Usage:
 *   npx ts-node tests/run-all-tests.ts
 *   TEST_API_URL=http://localhost:3000 npx ts-node tests/run-all-tests.ts
 * 
 * ============================================================================
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = path.join(__dirname, 'endpoints');
const API_URL = process.env.TEST_API_URL || 'http://localhost:3000';

interface TestResult {
  file: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  errors: string[];
}

async function runTests(): Promise<void> {
  console.log('============================================');
  console.log('  WARMPAWZ COMPREHENSIVE TEST SUITE');
  console.log('============================================');
  console.log(`API URL: ${API_URL}`);
  console.log(`Test Directory: ${TEST_DIR}`);
  console.log('');

  // Get all test files
  const testFiles = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.test.ts'));
  console.log(`Found ${testFiles.length} test files\n`);

  const results: TestResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const file of testFiles) {
    const filePath = path.join(TEST_DIR, file);
    console.log(`Running: ${file}`);
    console.log('-'.repeat(50));

    const startTime = Date.now();
    
    try {
      const output = execSync(
        `npx jest ${filePath} --json --silent`,
        {
          encoding: 'utf8',
          env: { ...process.env, TEST_API_URL: API_URL },
        }
      );

      const result = JSON.parse(output);
      const duration = Date.now() - startTime;

      const passed = result.numPassedTests || 0;
      const failed = result.numFailedTests || 0;
      const skipped = result.numPendingTests || 0;

      results.push({
        file,
        passed,
        failed,
        skipped,
        duration,
        errors: result.testResults?.[0]?.message ? [result.testResults[0].message] : [],
      });

      totalPassed += passed;
      totalFailed += failed;
      totalSkipped += skipped;

      console.log(`  ✅ Passed: ${passed}`);
      console.log(`  ❌ Failed: ${failed}`);
      console.log(`  ⏭️  Skipped: ${skipped}`);
      console.log(`  ⏱️  Duration: ${duration}ms`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Jest exits with non-zero on failures, try to parse output
      if (error.stdout) {
        try {
          const result = JSON.parse(error.stdout);
          const passed = result.numPassedTests || 0;
          const failed = result.numFailedTests || 0;
          const skipped = result.numPendingTests || 0;

          results.push({
            file,
            passed,
            failed,
            skipped,
            duration,
            errors: result.testResults?.flatMap((r: any) => 
              r.assertionResults?.filter((a: any) => a.status === 'failed')
                .map((a: any) => a.failureMessages?.join('\n')) || []
            ) || [],
          });

          totalPassed += passed;
          totalFailed += failed;
          totalSkipped += skipped;

          console.log(`  ✅ Passed: ${passed}`);
          console.log(`  ❌ Failed: ${failed}`);
          console.log(`  ⏭️  Skipped: ${skipped}`);
          console.log(`  ⏱️  Duration: ${duration}ms`);
        } catch {
          results.push({
            file,
            passed: 0,
            failed: 1,
            skipped: 0,
            duration,
            errors: [error.message || 'Unknown error'],
          });
          totalFailed++;
          console.log(`  ❌ Error: ${error.message}`);
        }
      } else {
        results.push({
          file,
          passed: 0,
          failed: 1,
          skipped: 0,
          duration,
          errors: [error.message || 'Unknown error'],
        });
        totalFailed++;
        console.log(`  ❌ Error: ${error.message}`);
      }
    }

    console.log('');
  }

  // Summary
  console.log('============================================');
  console.log('  TEST SUMMARY');
  console.log('============================================');
  console.log(`Total Tests: ${totalPassed + totalFailed + totalSkipped}`);
  console.log(`✅ Passed: ${totalPassed}`);
  console.log(`❌ Failed: ${totalFailed}`);
  console.log(`⏭️  Skipped: ${totalSkipped}`);
  console.log('');
  console.log(`Coverage: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
  console.log('');

  // Generate report
  const reportPath = path.join(__dirname, '..', 'test-results', 'report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    apiUrl: API_URL,
    summary: {
      totalPassed,
      totalFailed,
      totalSkipped,
      coverage: ((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1) + '%',
    },
    results,
  }, null, 2));

  console.log(`Report saved to: ${reportPath}`);

  // Exit with appropriate code
  process.exit(totalFailed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(console.error);

