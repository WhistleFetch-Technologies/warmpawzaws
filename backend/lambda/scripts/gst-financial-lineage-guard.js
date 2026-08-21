#!/usr/bin/env node
/**
 * GST financial-lineage guard.
 * Protects calculation/resolution/report CODE. Does not block Admin GST cards.
 *
 * Exit 1: missing required tests, missing declaration, or broken suite script.
 * Prints GST FINANCIAL-LINEAGE PROTECTED AREA CHANGED when source files change.
 *
 * Outputs (GitHub Actions): run_suite=true|false
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LAMBDA_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(LAMBDA_ROOT, '..', '..');

/** Implementation files — changing these requires GST-PROTECTED-CHANGE. */
const PROTECTED_SOURCE = [
  'backend/lambda/src/lib/services/gst-catalog-role-resolution.ts',
  'backend/lambda/src/lib/services/tax-calculation-service.ts',
  'backend/lambda/src/lib/gst-place-of-supply.ts',
  'backend/lambda/src/utils/tax-category-display-rate.ts',
  'backend/lambda/src/utils/calculate-authoritative-service-gst.ts',
  'backend/lambda/src/utils/resolve-service-booking-tax-item.ts',
  'backend/lambda/src/utils/gst-split.ts',
  'backend/lambda/src/utils/canonical-gst-snapshot.ts',
  'backend/lambda/src/utils/resolve-booking-list-price.ts',
  'backend/lambda/src/utils/booking-financial-gross.ts',
  'backend/lambda/src/utils/vendor-booking-earnings-report.ts',
  'backend/lambda/src/utils/vendor-accrual-fee-breakdown.ts',
  'backend/lambda/src/utils/package-session-earnings-allocation.ts',
  'backend/lambda/src/utils/funding-aware-ledger-correction.ts',
  'backend/lambda/src/utils/booking-invoice-amounts.ts',
  'backend/lambda/src/utils/invoice-row-gst.ts',
];

const REQUIRED_TEST_FILES = [
  'backend/lambda/src/lib/services/__tests__/gst-catalog-role-resolution.test.ts',
  'backend/lambda/src/lib/services/__tests__/tax-calculation-admin-gst-rate.test.ts',
  'backend/lambda/src/lib/__tests__/gst-place-of-supply.test.ts',
  'backend/lambda/src/utils/__tests__/tax-category-display-rate.test.ts',
  'backend/lambda/src/utils/__tests__/resolve-service-booking-tax-item.test.ts',
  'backend/lambda/src/utils/__tests__/gst-split.test.ts',
  'backend/lambda/src/utils/__tests__/canonical-gst-snapshot-lock.test.ts',
  'backend/lambda/src/utils/__tests__/authoritative-final-paid.test.ts',
  'backend/lambda/src/utils/__tests__/resolve-booking-list-price.test.ts',
  'backend/lambda/src/utils/__tests__/booking-financial-gross.test.ts',
  'backend/lambda/src/utils/__tests__/vendor-booking-earnings-report.test.ts',
  'backend/lambda/src/utils/__tests__/vendor-accrual-fee-breakdown.test.ts',
  'backend/lambda/src/utils/__tests__/package-session-earnings-allocation.test.ts',
  'backend/lambda/src/utils/__tests__/funding-aware-ledger-correction.test.ts',
  'backend/lambda/src/utils/__tests__/booking-invoice-amounts.test.ts',
  'backend/lambda/src/utils/__tests__/invoice-historical-gst-lineage.test.ts',
  'backend/lambda/src/utils/__tests__/gst-financial-lineage.test.ts',
  'backend/lambda/src/utils/__tests__/invoice-row-gst.test.ts',
  'backend/lambda/src/endpoints/__tests__/invoice-gst-rate.test.ts',
  'backend/lambda/src/utils/__tests__/vendor-earnings-settlement-snapshot.test.ts',
  'backend/lambda/src/utils/__tests__/gst-tax-lines.test.ts',
];

const REQUIRED_SUITE_TOKENS = [
  'vendor-booking-earnings-report',
  'booking-invoice-amounts',
  'invoice-historical-gst-lineage',
  'gst-financial-lineage',
  'gst-split',
  'canonical-gst-snapshot-lock',
  'authoritative-final-paid',
  'vendor-accrual-fee-breakdown',
  'package-session-earnings-allocation',
  'funding-aware-ledger-correction',
  'invoice-row-gst',
  'invoice-gst-rate',
  'gst-place-of-supply',
  'gst-catalog-role-resolution',
  'tax-calculation-admin-gst-rate',
  'resolve-booking-list-price',
  'resolve-service-booking-tax-item',
  'booking-financial-gross',
  'vendor-earnings-settlement-snapshot',
  'tax-category-display-rate',
  'gst-tax-lines',
];

const DECLARATION_RE = /GST-PROTECTED-CHANGE:\s+\S/;

function posix(p) {
  return String(p || '').replace(/\\/g, '/');
}

function git(args) {
  return execSync(`git ${args}`, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

function changedFiles() {
  const names = new Set();
  const baseRef = process.env.GST_GUARD_BASE || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/develop');
  try {
    git(`rev-parse --verify ${baseRef}`);
    git(`diff --name-only ${baseRef}...HEAD`)
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach((f) => names.add(posix(f)));
  } catch {
    /* first-time branch or missing base */
  }
  try {
    git('diff --name-only HEAD')
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach((f) => names.add(posix(f)));
  } catch {
    /* ignore */
  }
  return [...names];
}

function readPrBody() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) return '';
  try {
    const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
    return String(event.pull_request && event.pull_request.body ? event.pull_request.body : '');
  } catch {
    return '';
  }
}

function readCommitBodies() {
  const baseRef = process.env.GST_GUARD_BASE || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/develop');
  try {
    return git(`log --format=%B ${baseRef}...HEAD`);
  } catch {
    return '';
  }
}

function findDeclaration() {
  const texts = [readPrBody(), readCommitBodies()];
  if (process.env.GST_GUARD_ALLOW_ENV === '1' && process.env.GST_PROTECTED_CHANGE) {
    texts.push(process.env.GST_PROTECTED_CHANGE);
  }
  return texts.find((t) => DECLARATION_RE.test(t)) || '';
}

function writeOutput(runSuite) {
  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    fs.appendFileSync(out, `run_suite=${runSuite ? 'true' : 'false'}\n`);
  }
}

function main() {
  let failed = false;

  for (const rel of REQUIRED_TEST_FILES) {
    const full = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(full)) {
      console.error(`MISSING required GST regression file: ${rel}`);
      failed = true;
      continue;
    }
    const body = fs.readFileSync(full, 'utf8');
    if (!/\b(test|it)\s*\(/.test(body)) {
      console.error(`EMPTY or no tests in required GST regression file: ${rel}`);
      failed = true;
    }
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(LAMBDA_ROOT, 'package.json'), 'utf8'));
  const suite = String((pkg.scripts && pkg.scripts['test:gst-financial']) || '');
  if (!suite) {
    console.error('package.json is missing script test:gst-financial');
    failed = true;
  } else {
    for (const token of REQUIRED_SUITE_TOKENS) {
      if (!suite.includes(token)) {
        console.error(`test:gst-financial is missing required suite token: ${token}`);
        failed = true;
      }
    }
  }

  const changed = changedFiles();
  const protectedHits = changed.filter((f) => PROTECTED_SOURCE.includes(f));
  const requiredTestHits = changed.filter((f) => REQUIRED_TEST_FILES.includes(f));
  const runSuite = protectedHits.length > 0 || requiredTestHits.length > 0;

  if (protectedHits.length > 0) {
    console.log('GST FINANCIAL-LINEAGE PROTECTED AREA CHANGED');
    for (const f of protectedHits) console.log(`  ${f}`);
    const declaration = findDeclaration();
    if (!declaration) {
      console.error('');
      console.error('Protected GST/financial-lineage source changed without a declaration.');
      console.error('Add to the PR body or commit message:');
      console.error('  GST-PROTECTED-CHANGE: <why>');
      console.error('  GST-PROTECTED-INVARIANT: <invariant>');
      console.error('  GST-PROTECTED-TESTS: <suites>');
      console.error('See docs/GST_FINANCIAL_LINEAGE_GUARD.md');
      failed = true;
    } else {
      const line = declaration.split(/\r?\n/).find((l) => DECLARATION_RE.test(l)) || 'GST-PROTECTED-CHANGE: (present)';
      console.log(`Declaration recognized: ${line.trim()}`);
      console.log('Protected regression suite is required: npm run test:gst-financial');
    }
  } else {
    console.log('GST financial-lineage guard: no protected source files in this change set.');
  }

  if (requiredTestHits.length > 0) {
    console.log('Required GST regression tests changed — suite must run.');
  }

  writeOutput(runSuite);

  if (failed) {
    process.exit(1);
  }
  console.log('GST financial-lineage guard OK');
}

main();
