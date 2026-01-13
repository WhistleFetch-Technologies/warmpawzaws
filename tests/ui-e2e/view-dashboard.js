#!/usr/bin/env node

/**
 * WARMPAWZ E2E TEST DASHBOARD
 * Quick dashboard viewer
 */

const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'test-execution.log');
const total = 891;

function getStats() {
  if (!fs.existsSync(logFile)) {
    return {
      executed: 0,
      passed: 0,
      failed: 0,
      currentTests: [],
    };
  }

  const content = fs.readFileSync(logFile, 'utf-8');
  const executed = (content.match(/🧪 Executing Test:/g) || []).length;
  const passed = (content.match(/✅ Test PASSED:/g) || []).length;
  const failed = (content.match(/❌ Test (FAILED|ERROR):/g) || []).length;

  // Get recent tests
  const testMatches = content.match(/🧪 Executing Test: (.+?) \(([^)]+)\)/g) || [];
  const currentTests = testMatches.slice(-5).map(m => {
    const match = m.match(/🧪 Executing Test: (.+?) \(([^)]+)\)/);
    return match ? `${match[2]}: ${match[1]}` : '';
  }).filter(Boolean);

  return { executed, passed, failed, currentTests };
}

function displayDashboard() {
  const { executed, passed, failed, currentTests } = getStats();
  const progress = total > 0 ? Math.round((executed / total) * 100) : 0;
  const barLength = 50;
  const filled = Math.round((progress / 100) * barLength);
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
  const passRate = executed > 0 ? Math.round((passed / executed) * 100) : 0;

  console.log('\n╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    WARMPAWZ E2E TEST EXECUTION DASHBOARD                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');
  
  console.log('📊 OVERALL PROGRESS');
  console.log('━'.repeat(70));
  console.log(`   [${bar}] ${progress}%`);
  console.log(`   Executed: ${executed} / ${total} tests`);
  console.log(`   Remaining: ${total - executed} tests\n`);
  
  console.log('📈 TEST RESULTS');
  console.log('━'.repeat(70));
  console.log(`   ✅ Passed:    ${String(passed).padStart(4)} (${passRate}%)`);
  console.log(`   ❌ Failed:    ${String(failed).padStart(4)}`);
  console.log(`   📊 Total:     ${String(executed).padStart(4)}\n`);
  
  if (currentTests.length > 0) {
    console.log('🔄 CURRENTLY EXECUTING');
    console.log('━'.repeat(70));
    currentTests.forEach((test, i) => {
      console.log(`   ${i + 1}. ${test}`);
    });
    console.log('');
  }
  
  console.log('⚙️  EXECUTION STATUS');
  console.log('━'.repeat(70));
  console.log(`   Status: ${executed < total ? '🟢 RUNNING' : '✅ COMPLETE'}`);
  console.log('   Mode: Parallel (5 concurrent)');
  console.log('   Retry: Enabled (3 attempts)\n');
}

// Run once or watch mode
if (process.argv.includes('--watch')) {
  displayDashboard();
  setInterval(() => {
    process.stdout.write('\x1B[2J\x1B[0f');
    displayDashboard();
  }, 2000);
} else {
  displayDashboard();
}
