#!/usr/bin/env node
/**
 * Phase 8: Full forensic suite – runs all phase scripts in order.
 * Staff is decommissioned; solo providers are discovered via discover-services for at_home/tele.
 * Usage: TEST_API_URL=<base> node scripts/run-forensic-full-suite.js
 */

const { spawn } = require('child_process');
const path = require('path');

const SCRIPTS = [
  'forensic-phase0-discovery-validation.js',
  'forensic-vet-center-e2e.js',
  'forensic-grooming-e2e.js',
  'forensic-walker-e2e.js',
  'forensic-training-e2e.js',
  'forensic-reschedule-slots-e2e.js',
  'forensic-payment-dynamic-e2e.js',
  'forensic-phase7-style-flows-e2e.js',
];

const base = process.env.TEST_API_URL || process.env.API_BASE_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

function run(script) {
  return new Promise((resolve) => {
    const child = spawn('node', [path.join(__dirname, script)], {
      stdio: 'inherit',
      env: { ...process.env, TEST_API_URL: base, API_BASE_URL: base },
    });
    child.on('close', (code) => resolve(code));
  });
}

async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log('PHASE 8: Full forensic suite');
  console.log('═'.repeat(70));
  console.log(`TEST_API_URL=${base}`);
  console.log('═'.repeat(70));

  let failed = 0;
  for (const script of SCRIPTS) {
    console.log(`\n▶ Running ${script}...`);
    const code = await run(script);
    if (code !== 0) {
      failed++;
      console.log(`✗ ${script} exited with ${code}`);
    } else {
      console.log(`✓ ${script} passed`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`Full suite: ${failed === 0 ? 'PASSED' : 'FAILED'} (${failed} script(s) failed)`);
  console.log('═'.repeat(70) + '\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
