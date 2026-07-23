#!/usr/bin/env node
/**
 * Validates commerce-switch module import boundaries.
 * commerce-switch/ must not import booking, payment, razorpay, or finance endpoints.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src', 'commerce-switch');
const FORBIDDEN = [
  /endpoints\/booking/,
  /payments-enhanced/,
  /razorpay/,
  /finance\//,
  /vendor-earnings/,
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) files.push(full);
  }
  return files;
}

let violations = 0;
for (const file of walk(ROOT)) {
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of FORBIDDEN) {
    if (pattern.test(content)) {
      console.error(`FORBIDDEN IMPORT in ${path.relative(process.cwd(), file)}: ${pattern}`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`Commerce Switch layer compliance FAILED (${violations} violation(s))`);
  process.exit(1);
}

console.log('Commerce Switch layer compliance OK');
