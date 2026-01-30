/**
 * ============================================================================
 * E2E TEST RUNNER - ALL SUITES
 * ============================================================================
 * 
 * Runs all E2E test suites and generates a comprehensive report.
 * 
 * Run: npx ts-node tests/e2e/run-all-e2e-tests.ts
 * Date: 2026-01-28
 * ============================================================================
 */

import { execSync, spawn } from 'child_process';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const TEST_SUITES = [
  {
    name: 'Authentication & Security',
    file: 'auth-security.test.ts',
    description: 'Tests OTP auth, rate limiting, admin auth, and input validation',
  },
  {
    name: 'Comprehensive Booking Flow',
    file: 'booking-flow-comprehensive.test.ts',
    description: 'Tests service catalog, single/multiple service booking, status transitions',
  },
  {
    name: 'Payment Integration',
    file: 'payment-integration.test.ts',
    description: 'Tests Razorpay orders, wallet, settlements, and refunds',
  },
  {
    name: 'Vendor Onboarding',
    file: 'vendor-onboarding-comprehensive.test.ts',
    description: 'Tests complete vendor onboarding workflow from role selection to activation',
  },
  {
    name: 'Booking Lifecycle (Legacy)',
    file: 'booking-lifecycle.test.ts',
    description: 'Original booking lifecycle tests',
  },
];

interface TestResult {
  suite: string;
  passed: boolean;
  duration: number;
  output: string;
  error?: string;
}

// ============================================================================
// TEST RUNNER
// ============================================================================

async function runTestFile(filePath: string): Promise<{ success: boolean; output: string; duration: number }> {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    let output = '';
    let error = '';

    const proc = spawn('npx', ['ts-node', filePath], {
      cwd: path.dirname(filePath),
      env: { ...process.env, FORCE_COLOR: '1' },
      shell: true,
    });

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      error += text;
      process.stderr.write(text);
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        output: output + error,
        duration: Date.now() - startTime,
      });
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        output: error + '\n' + err.message,
        duration: Date.now() - startTime,
      });
    });
  });
}

async function runAllTests(): Promise<void> {
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(25) + 'WARMPAWZ E2E TEST SUITE' + ' '.repeat(30) + '║');
  console.log('║' + ' '.repeat(78) + '║');
  console.log('║' + ' '.repeat(20) + `Started at: ${new Date().toISOString()}` + ' '.repeat(20) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  console.log();

  const results: TestResult[] = [];
  const totalStartTime = Date.now();
  const e2eDir = __dirname;

  for (const suite of TEST_SUITES) {
    console.log('\n' + '┌' + '─'.repeat(78) + '┐');
    console.log(`│ 📋 ${suite.name.padEnd(72)} │`);
    console.log(`│    ${suite.description.padEnd(72)} │`);
    console.log('└' + '─'.repeat(78) + '┘\n');

    const filePath = path.join(e2eDir, suite.file);
    
    try {
      const result = await runTestFile(filePath);
      
      results.push({
        suite: suite.name,
        passed: result.success,
        duration: result.duration,
        output: result.output,
      });

      console.log(`\n${result.success ? '✅' : '❌'} ${suite.name} - ${result.success ? 'PASSED' : 'FAILED'} (${Math.round(result.duration / 1000)}s)`);
    } catch (err) {
      results.push({
        suite: suite.name,
        passed: false,
        duration: 0,
        output: '',
        error: err instanceof Error ? err.message : String(err),
      });

      console.log(`\n❌ ${suite.name} - FAILED TO RUN: ${err}`);
    }
  }

  // Generate Summary
  const totalDuration = Date.now() - totalStartTime;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n\n' + '╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(30) + 'FINAL SUMMARY' + ' '.repeat(35) + '║');
  console.log('╠' + '═'.repeat(78) + '╣');

  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    const status = result.passed ? 'PASSED' : 'FAILED';
    const duration = `${Math.round(result.duration / 1000)}s`;
    console.log(`║ ${icon} ${result.suite.padEnd(50)} ${status.padEnd(10)} ${duration.padStart(8)} ║`);
  }

  console.log('╠' + '═'.repeat(78) + '╣');
  console.log(`║ TOTAL: ${passed} passed, ${failed} failed`.padEnd(60) + `Duration: ${Math.round(totalDuration / 1000)}s`.padStart(18) + ' ║');
  console.log('╚' + '═'.repeat(78) + '╝');

  // Print pass rate
  const passRate = ((passed / results.length) * 100).toFixed(1);
  console.log(`\n📊 Pass Rate: ${passRate}% (${passed}/${results.length})`);

  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Please review the output above for details.');
    console.log('\nFailed suites:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.suite}${r.error ? ': ' + r.error : ''}`);
    });
  }

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Alternative: Run tests sequentially with simple execution
async function runTestsSimple(): Promise<void> {
  console.log('═'.repeat(60));
  console.log('WARMPAWZ E2E TEST SUITE - COMPREHENSIVE');
  console.log('═'.repeat(60));
  console.log(`API URL: ${process.env.TEST_API_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com'}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('═'.repeat(60));

  const results: { name: string; passed: boolean }[] = [];
  const e2eDir = __dirname;

  for (const suite of TEST_SUITES) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📋 Running: ${suite.name}`);
    console.log(`   File: ${suite.file}`);
    console.log('─'.repeat(60));

    try {
      const output = execSync(
        `npx ts-node ${path.join(e2eDir, suite.file)}`,
        {
          encoding: 'utf8',
          timeout: 300000, // 5 minutes
          stdio: 'inherit',
        }
      );
      
      results.push({ name: suite.name, passed: true });
    } catch (error) {
      results.push({ name: suite.name, passed: false });
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('OVERALL SUMMARY');
  console.log('═'.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(r => {
    console.log(`${r.passed ? '✅' : '❌'} ${r.name}`);
  });

  console.log('\n' + '─'.repeat(60));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`Pass Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log('═'.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

// Run
const simpleMode = process.argv.includes('--simple');
if (simpleMode) {
  runTestsSimple().catch(console.error);
} else {
  runAllTests().catch(console.error);
}
