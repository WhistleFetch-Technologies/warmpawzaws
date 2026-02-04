#!/usr/bin/env node
/**
 * Run Migration 535: Fix Missing vendor_identity
 * Quick wrapper to run the migration
 */

const { execSync } = require('child_process');
const path = require('path');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const migrationFile = '535_fix_missing_vendor_identity.sql';

console.log('🚀 Running Migration 535: Fix Missing vendor_identity');
console.log(`Environment: ${ENVIRONMENT}`);
console.log('');

// Use the existing run-migration-rds-node.js script
const scriptPath = path.join(__dirname, 'run-migration-rds-node.js');
const migrationPath = path.join(__dirname, '..', 'db', 'migrations', migrationFile);

try {
  // Set environment and run
  process.env.ENVIRONMENT = ENVIRONMENT;
  require(scriptPath);
  
  // Pass migration file as argument
  process.argv[2] = migrationFile;
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
