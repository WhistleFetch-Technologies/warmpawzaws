#!/usr/bin/env node
/**
 * Force re-resolve ecommerce order commission using current vendor/product config.
 *
 * Usage:
 *   ENVIRONMENT=dev node scripts/re-resolve-order-commission.js --order-id <uuid>
 *   ENVIRONMENT=dev node scripts/re-resolve-order-commission.js --phone 9886729131
 *   ENVIRONMENT=dev node scripts/re-resolve-order-commission.js --order-id <uuid> --dry-run
 *   ENVIRONMENT=dev node scripts/re-resolve-order-commission.js --order-id <uuid> --force
 */

const path = require('path');
const { spawnSync } = require('child_process');

const useDataApi = process.argv.includes('--use-data-api');
const filteredArgs = process.argv.slice(2).filter((a) => a !== '--use-data-api');

if (useDataApi || process.env.USE_RDS_DATA_API === 'true') {
  const dataApiScript = path.join(__dirname, 're-resolve-order-commission-data-api.js');
  const result = spawnSync(process.execPath, [dataApiScript, ...filteredArgs], {
    stdio: 'inherit',
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

const scriptPath = path.join(__dirname, '../backend/lambda/scripts/re-resolve-order-commission.ts');
const lambdaDir = path.join(__dirname, '../backend/lambda');

async function runTs() {
  const { bootstrapRdsEnv } = require('./lib/bootstrap-rds-env');
  await bootstrapRdsEnv();
  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['ts-node', '--transpile-only', scriptPath, ...filteredArgs],
    { stdio: 'inherit', cwd: lambdaDir, env: process.env }
  );
  process.exit(result.status ?? 1);
}

runTs().catch((err) => {
  console.warn('TypeScript re-resolve failed:', err.message);
  console.warn('Retrying with RDS Data API...\n');
  const dataApiScript = path.join(__dirname, 're-resolve-order-commission-data-api.js');
  const result = spawnSync(process.execPath, [dataApiScript, ...filteredArgs], {
    stdio: 'inherit',
    env: process.env,
  });
  process.exit(result.status ?? 1);
});
