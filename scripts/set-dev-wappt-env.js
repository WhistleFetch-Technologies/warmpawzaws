#!/usr/bin/env node
/**
 * Set Warmpawz Appointments feature flags on dev API Lambda.
 * Usage: node scripts/set-dev-wappt-env.js
 */
const { execSync } = require('child_process');

const FUNCTION = process.env.LAMBDA_FUNCTION_NAME || 'warmpawz-dev-api-handler';
const REGION = process.env.AWS_REGION || 'ap-south-1';

function main() {
  const raw = execSync(
    `aws lambda get-function-configuration --function-name ${FUNCTION} --region ${REGION} --output json`,
    { encoding: 'utf8' },
  );
  const cfg = JSON.parse(raw);
  const env = { ...(cfg.Environment?.Variables || {}) };
  env.WARMPAWZ_APPOINTMENTS_ENABLED = 'true';
  env.WARMPAWZ_APPOINTMENTS_ADMIN_ENABLED = 'true';

  const payload = JSON.stringify({
    FunctionName: FUNCTION,
    Environment: { Variables: env },
  });
  const tmp = require('path').join(require('os').tmpdir(), 'wappt-lambda-env.json');
  require('fs').writeFileSync(tmp, payload);
  execSync(
    `aws lambda update-function-configuration --region ${REGION} --cli-input-json file://${tmp.replace(/\\/g, '/')}`,
    { stdio: 'inherit' },
  );
  console.log('Updated Lambda env:', FUNCTION);
}

main();
