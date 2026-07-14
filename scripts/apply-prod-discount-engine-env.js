#!/usr/bin/env node
/**
 * Align warmpawz-prod-api-handler Discount Engine env vars with
 * infra/envs/prod/main.tf common_env_vars (OFF / safe defaults).
 *
 * Does NOT deploy Lambda code. Merges into existing environment.
 *
 * Usage:
 *   node scripts/apply-prod-discount-engine-env.js
 *   node scripts/apply-prod-discount-engine-env.js --dry-run
 */

const { execSync } = require('child_process');

const FUNCTION_NAME = process.env.LAMBDA_FUNCTION_NAME || 'warmpawz-prod-api-handler';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const DRY_RUN = process.argv.includes('--dry-run');

/** Matches infra/envs/prod/main.tf Commercial Engine V2 block. */
const TERRAFORM_PROD_DISCOUNT_FLAGS = {
  DISCOUNT_ENGINE_V2_RESOLVER_MODE: 'OFF',
  DISCOUNT_ENGINE_V2_PRIORITY_MODE: 'AUTHORITATIVE',
  DISCOUNT_ENGINE_V2_STACK_MODE: 'OFF',
  DISCOUNT_ENGINE_V2_SETTLEMENT_MODE: 'OFF',
  DISCOUNT_ENGINE_V2_ANALYTICS_MODE: 'OFF',
  DISCOUNT_ENGINE_V2_CAMPAIGN_MODE: 'OFF',
  COMMERCIAL_AI_COPILOT_ENABLED: 'false',
  UAT_MODE: 'false',
};

function main() {
  const raw = execSync(
    `aws lambda get-function-configuration --function-name ${FUNCTION_NAME} --region ${REGION} --query Environment.Variables --output json`,
    { encoding: 'utf8' },
  );
  const current = JSON.parse(raw || '{}') || {};
  const merged = { ...current, ...TERRAFORM_PROD_DISCOUNT_FLAGS };

  console.log(`Function: ${FUNCTION_NAME}`);
  console.log('Discount / UAT flags to set (Terraform prod):');
  for (const [k, v] of Object.entries(TERRAFORM_PROD_DISCOUNT_FLAGS)) {
    const before = current[k] === undefined ? '(unset)' : JSON.stringify(current[k]);
    console.log(`  ${k}: ${before} → ${JSON.stringify(v)}`);
  }

  if (DRY_RUN) {
    console.log('\n--dry-run: no changes written.');
    return;
  }

  // Write env file for AWS CLI (Variables=file://…)
  const fs = require('fs');
  const path = require('path');
  const outPath = path.join(__dirname, '_lambda-env-update-prod-discount.json');
  fs.writeFileSync(outPath, JSON.stringify({ Variables: merged }));
  try {
    execSync(
      `aws lambda update-function-configuration --function-name ${FUNCTION_NAME} --region ${REGION} --environment file://${outPath.replace(/\\/g, '/')}`,
      { stdio: 'inherit' },
    );
    console.log('\nUpdated Lambda environment (code unchanged).');
  } finally {
    try {
      fs.unlinkSync(outPath);
    } catch {
      /* ignore */
    }
  }
}

main();
