#!/usr/bin/env node

/**
 * WARMPAWZ E2E TEST - LIVE PROGRESS DASHBOARD
 * Shows real-time test execution progress
 */

const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'test-execution.log');
const total = 891;
const adminTotal = 180;
const customerTotal = 125;
const vendorTotal = 586;

function clearScreen() {
  process.stdout.write('\x1B[2J\x1B[0f');
}

function getStats() {
  if (!fs.existsSync(logFile)) {
    return {
      executed: 0,
      passed: 0,
      failed: 0,
      currentTests: [],
      recentErrors: [],
    };
  }

  const content = fs.readFileSync(logFile, 'utf-8');
  const lines = content.split('\n');
  
  // Count executions (including retries)
  const executed = (content.match(/🧪 Executing Test:/g) || []).length;
  const passed = (content.match(/✅ Test PASSED:/g) || []).length;
  const failed = (content.match(/❌ Test (FAILED|ERROR):/g) || []).length;
  
  // Get unique test IDs that completed
  const completedTests = new Set();
  const passedMatches = content.match(/✅ Test PASSED: .+? \(([^)]+)\)/g) || [];
  const failedMatches = content.match(/❌ Test (FAILED|ERROR): .+? \(([^)]+)\)/g) || [];
  const failedAfterMatches = content.match(/❌ Test ([^ ]+) failed after \d+ attempts/g) || [];
  
  // Extract passed test IDs
  passedMatches.forEach(m => {
    const match = m.match(/✅ Test PASSED: .+? \(([^)]+)\)/);
    if (match) completedTests.add(match[1]);
  });
  
  // Extract failed test IDs
  failedMatches.forEach(m => {
    const match = m.match(/❌ Test (FAILED|ERROR): .+? \(([^)]+)\)/);
    if (match && match[2]) completedTests.add(match[2]);
  });
  
  // Extract test IDs from "failed after X attempts"
  failedAfterMatches.forEach(m => {
    const match = m.match(/❌ Test ([^ ]+) failed after/);
    if (match) completedTests.add(match[1]);
  });
  
  const uniqueCompleted = completedTests.size;
  const uniquePassed = new Set(passedMatches.map(m => {
    const match = m.match(/✅ Test PASSED: .+? \(([^)]+)\)/);
    return match ? match[1] : null;
  }).filter(Boolean)).size;
  
  const uniqueFailed = uniqueCompleted - uniquePassed;

  // Get currently executing tests
  const currentTestMatches = content.match(/🧪 Executing Test: (.+?) \(([^)]+)\)/g) || [];
  const currentTests = currentTestMatches
    .slice(-5)
    .map(m => {
      const match = m.match(/🧪 Executing Test: (.+?) \(([^)]+)\)/);
      return match ? { id: match[2], name: match[1] } : null;
    })
    .filter(Boolean);

  // Get recent errors
  const recentErrors = lines
    .filter(line => line.includes('❌') && (line.includes('FAILED') || line.includes('ERROR')))
    .slice(-3)
    .map(line => {
      const match = line.match(/❌ Test (FAILED|ERROR): (.+?)(?: \(([^)]+)\))?/);
      if (match) {
        return match[3] ? `${match[3]}: ${match[2]}` : match[2];
      }
      return line.substring(0, 60).trim();
    });

  return {
    executed: uniqueCompleted,
    passed: uniquePassed,
    failed: uniqueFailed,
    currentTests,
    recentErrors,
    totalExecutions: executed, // Total including retries
  };
}

function createProgressBar(percentage, width = 50) {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function displayDashboard() {
  const stats = getStats();
  const { executed, passed, failed, currentTests, recentErrors } = stats;
  const remaining = total - executed;
  const progress = total > 0 ? Math.round((executed / total) * 100) : 0;
  const passRate = executed > 0 ? Math.round((passed / executed) * 100) : 0;
  const failRate = executed > 0 ? Math.round((failed / executed) * 100) : 0;

  clearScreen();

  // Header
  console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║              WARMPAWZ E2E TEST EXECUTION - LIVE PROGRESS DASHBOARD          ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  // Overall Progress
  console.log('📊 OVERALL PROGRESS');
  console.log('━'.repeat(70));
  const bar = createProgressBar(progress, 60);
  console.log(`   [${bar}] ${progress}%`);
  console.log(`   Executed: ${String(executed).padStart(4)} / ${total} tests`);
  console.log(`   Remaining: ${String(remaining).padStart(4)} tests\n`);

  // Test Results
  console.log('📈 TEST RESULTS');
  console.log('━'.repeat(70));
  console.log(`   ✅ Passed:    ${String(passed).padStart(4)} (${passRate}%)`);
  console.log(`   ❌ Failed:    ${String(failed).padStart(4)} (${failRate}%)`);
  console.log(`   📊 Completed: ${String(executed).padStart(4)}`);
  console.log(`   ⏳ Remaining: ${String(remaining).padStart(4)}\n`);

  // Currently Executing
  if (currentTests.length > 0) {
    console.log('🔄 CURRENTLY EXECUTING');
    console.log('━'.repeat(70));
    currentTests.forEach((test, i) => {
      const displayName = test.name.length > 55 ? test.name.substring(0, 52) + '...' : test.name;
      console.log(`   ${String(i + 1).padStart(2)}. [${test.id}] ${displayName}`);
    });
    console.log('');
  }

  // Recent Errors
  if (recentErrors.length > 0) {
    console.log('⚠️  RECENT ERRORS');
    console.log('━'.repeat(70));
    recentErrors.forEach((error, i) => {
      const displayError = error.length > 65 ? error.substring(0, 62) + '...' : error;
      console.log(`   ${String(i + 1).padStart(2)}. ${displayError}`);
    });
    console.log('');
  }

  // Execution Status
  console.log('⚙️  EXECUTION STATUS');
  console.log('━'.repeat(70));
  const status = executed < total ? '🟢 RUNNING' : '✅ COMPLETE';
  console.log(`   Status: ${status}`);
  console.log(`   Mode: Parallel (5 concurrent tests)`);
  console.log(`   Retry: Enabled (3 attempts per test)`);
  console.log(`   Browser: Playwright (headless)`);
  console.log(`   API: Real HTTP calls enabled\n`);

  // Footer
  console.log('━'.repeat(70));
  console.log('   Auto-refresh every 2 seconds | Press Ctrl+C to stop');
  console.log('━'.repeat(70));
}

// Main
console.log('🚀 Starting live progress dashboard...\n');
console.log('   Monitoring test execution...\n');

// Initial display
displayDashboard();

// Update every 2 seconds
const interval = setInterval(() => {
  displayDashboard();
}, 2000);

// Handle exit
process.on('SIGINT', () => {
  clearInterval(interval);
  clearScreen();
  console.log('\n📊 Dashboard stopped. Test execution continues in background.\n');
  process.exit(0);
});
