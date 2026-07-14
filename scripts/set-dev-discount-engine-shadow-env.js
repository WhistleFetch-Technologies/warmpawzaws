#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const fn = process.env.LAMBDA_FUNCTION_NAME || 'warmpawz-dev-api-handler';
const region = process.env.AWS_REGION || 'ap-south-1';

const raw = execSync(
  `aws lambda get-function-configuration --function-name ${fn} --region ${region} --query Environment.Variables --output json`,
  { encoding: 'utf8' }
);
const vars = JSON.parse(raw);
vars.DISCOUNT_ENGINE_V2_PRIORITY_MODE = 'SHADOW';
vars.DISCOUNT_ENGINE_V2_STACK_MODE = 'SHADOW';
vars.DISCOUNT_ENGINE_V2_SETTLEMENT_MODE = 'SHADOW';
vars.DISCOUNT_ENGINE_V2_ANALYTICS_MODE = 'SHADOW';

const file = path.join(os.tmpdir(), 'lambda-env-shadow.json');
fs.writeFileSync(file, JSON.stringify({ Variables: vars }));

execSync(
  `aws lambda update-function-configuration --function-name ${fn} --region ${region} --environment file://${file.replace(/\\/g, '/')}`,
  { stdio: 'inherit' }
);
execSync(`aws lambda wait function-updated --function-name ${fn} --region ${region}`, { stdio: 'inherit' });

const check = execSync(
  `aws lambda get-function-configuration --function-name ${fn} --region ${region} --query Environment.Variables.{PRIORITY:DISCOUNT_ENGINE_V2_PRIORITY_MODE,STACK:DISCOUNT_ENGINE_V2_STACK_MODE,SETTLEMENT:DISCOUNT_ENGINE_V2_SETTLEMENT_MODE,ANALYTICS:DISCOUNT_ENGINE_V2_ANALYTICS_MODE} --output json`,
  { encoding: 'utf8' }
);
console.log('Discount engine flags on dev Lambda:', check);
