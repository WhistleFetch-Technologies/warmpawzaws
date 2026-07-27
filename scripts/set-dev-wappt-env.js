#!/usr/bin/env node
/** Enable Warmpawz Appointments feature flags on dev Lambda API handler. */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const fn = process.env.LAMBDA_FUNCTION_NAME || 'warmpawz-dev-api-handler';
const region = process.env.AWS_REGION || 'ap-south-1';

const raw = execSync(
  `aws lambda get-function-configuration --function-name ${fn} --region ${region} --query Environment.Variables --output json`,
  { encoding: 'utf8' },
);
const vars = JSON.parse(raw);
vars.WARMPAWZ_APPOINTMENTS_ENABLED = 'true';
vars.WARMPAWZ_APPOINTMENTS_ADMIN_ENABLED = 'true';

const file = path.join(os.tmpdir(), 'lambda-env-wappt.json');
fs.writeFileSync(file, JSON.stringify({ Variables: vars }));

execSync(
  `aws lambda update-function-configuration --function-name ${fn} --region ${region} --environment file://${file.replace(/\\/g, '/')}`,
  { stdio: 'inherit' },
);
execSync(`aws lambda wait function-updated --function-name ${fn} --region ${region}`, { stdio: 'inherit' });

const check = execSync(
  `aws lambda get-function-configuration --function-name ${fn} --region ${region} --query Environment.Variables.{WAPPT:WARMPAWZ_APPOINTMENTS_ENABLED,WAPPT_ADMIN:WARMPAWZ_APPOINTMENTS_ADMIN_ENABLED} --output json`,
  { encoding: 'utf8' },
);
console.log('Warmpawz Appointments flags on dev Lambda:', check);
